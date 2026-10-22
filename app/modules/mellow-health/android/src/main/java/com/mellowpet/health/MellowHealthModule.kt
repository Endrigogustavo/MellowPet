package com.mellowpet.health

import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Duration
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

private const val REQUEST_HEALTH = 0x4D48 // "MH"

/**
 * Sono e passos do Health Connect, só leitura.
 *
 * Devolve um resumo por dia (minutos de sono que terminaram naquele dia e
 * total de passos). Nada é enviado: o cruzamento com o humor é feito no app.
 */
class MellowHealthModule : Module() {

  private val permissions = setOf(
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(StepsRecord::class),
  )
  private val contract = PermissionController.createRequestPermissionResultContract()
  private var pending: Promise? = null

  /** Resolve o pedido pendente uma única vez. */
  private fun settle(value: Boolean) {
    val p = pending ?: return
    pending = null
    p.resolve(value)
  }

  private fun context() = appContext.reactContext ?: throw IllegalStateException("sem contexto")

  private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context())

  override fun definition() = ModuleDefinition {
    Name("MellowHealth")

    /** "ok", "needs_update" (instalar/atualizar o Health Connect) ou "unavailable". */
    Function("status") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return@Function "unavailable"
      when (HealthConnectClient.getSdkStatus(context())) {
        HealthConnectClient.SDK_AVAILABLE -> "ok"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needs_update"
        else -> "unavailable"
      }
    }

    AsyncFunction("hasPermissions") Coroutine { ->
      client().permissionController.getGrantedPermissions().containsAll(permissions)
    }

    // Abrir tela de outro app precisa da thread principal; fora dela a
    // permissão voltava na hora e a promessa era resolvida duas vezes (crash).
    AsyncFunction("requestPermissions") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      // Pedido antigo pendurado (a pessoa saiu da tela): encerra como "não".
      settle(false)
      pending = promise
      try {
        activity.startActivityForResult(contract.createIntent(activity, permissions), REQUEST_HEALTH)
      } catch (e: Exception) {
        settle(false)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_HEALTH) return@OnActivityResult
      val granted = try {
        contract.parseResult(payload.resultCode, payload.data)
      } catch (_: Exception) {
        emptySet()
      }
      settle(granted.containsAll(permissions))
    }

    /** Últimos `days` dias: [{ day: "AAAA-MM-DD", sleepMinutes, steps }]. */
    AsyncFunction("readDays") Coroutine { days: Int ->
      val zone = ZoneId.systemDefault()
      val today = LocalDate.now(zone)
      val start = today.minusDays((days - 1).toLong()).atStartOfDay()
      val end = today.plusDays(1).atStartOfDay()
      val c = client()

      val sleepByDay = HashMap<String, Long>()
      val sleeps = c.readRecords(
        ReadRecordsRequest(
          SleepSessionRecord::class,
          TimeRangeFilter.between(start.atZone(zone).toInstant(), end.atZone(zone).toInstant()),
        )
      ).records
      for (s in sleeps) {
        // O sono conta no dia em que a pessoa acordou.
        val day = s.endTime.atZone(zone).toLocalDate().toString()
        sleepByDay[day] = (sleepByDay[day] ?: 0L) + Duration.between(s.startTime, s.endTime).toMinutes()
      }

      val stepsByDay = HashMap<String, Long>()
      val groups = c.aggregateGroupByPeriod(
        AggregateGroupByPeriodRequest(
          metrics = setOf(StepsRecord.COUNT_TOTAL),
          timeRangeFilter = TimeRangeFilter.between(start, end),
          timeRangeSlicer = Period.ofDays(1),
        )
      )
      for (g in groups) {
        stepsByDay[g.startTime.toLocalDate().toString()] = g.result[StepsRecord.COUNT_TOTAL] ?: 0L
      }

      (0 until days).map { i ->
        val day = today.minusDays((days - 1 - i).toLong()).toString()
        mapOf(
          "day" to day,
          "sleepMinutes" to (sleepByDay[day]?.toInt()),
          "steps" to (stepsByDay[day]?.toInt()),
        )
      }
    }
  }
}
