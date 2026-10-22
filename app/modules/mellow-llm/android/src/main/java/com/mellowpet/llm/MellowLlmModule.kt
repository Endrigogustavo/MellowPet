package com.mellowpet.llm

import android.content.Context
import com.google.mediapipe.tasks.genai.llminference.LlmInference
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Modelo de linguagem rodando no aparelho (MediaPipe LLM Inference).
 *
 * É o que responde no chat quando não há token de IA no servidor, ou quando a
 * pessoa escolhe "nada sai do aparelho". O modelo é baixado uma vez para o
 * armazenamento interno do app, verificado por SHA-256, e daí em diante tudo
 * roda offline — nem a pergunta nem a resposta deixam o celular.
 */
class MellowLlmModule : Module() {

  private var llm: LlmInference? = null
  private var loadedFile: String? = null
  private val worker = Executors.newSingleThreadExecutor()
  private val downloading = AtomicBoolean(false)
  private val cancelDownload = AtomicBoolean(false)

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun modelFile(name: String): File {
    // Só o nome do arquivo, sem caminho: o JS não escolhe onde se escreve.
    val safe = name.substringAfterLast('/').substringAfterLast('\\')
    require(safe.endsWith(".task") && safe.length in 6..160) { "nome de modelo inválido" }
    return File(File(context.filesDir, "models").apply { mkdirs() }, safe)
  }

  override fun definition() = ModuleDefinition {
    Name("MellowLlm")
    Events("onDownloadProgress", "onToken", "onDone", "onError")

    Function("status") { fileName: String ->
      val file = modelFile(fileName)
      mapOf(
        "downloaded" to file.exists(),
        "bytes" to (if (file.exists()) file.length() else 0L),
        "loaded" to (loadedFile == fileName && llm != null),
        "downloading" to downloading.get(),
      )
    }

    /** Baixa o modelo. Resolve com o caminho quando o SHA-256 confere. */
    AsyncFunction("download") { url: String, sha256: String, fileName: String, promise: Promise ->
      if (!url.startsWith("https://")) {
        promise.reject("bad_url", "Só baixo modelo por HTTPS.", null)
        return@AsyncFunction
      }
      if (!downloading.compareAndSet(false, true)) {
        promise.reject("busy", "Já há um download em andamento.", null)
        return@AsyncFunction
      }
      cancelDownload.set(false)
      worker.execute {
        val target = modelFile(fileName)
        val tmp = File(target.parentFile, "$fileName.part")
        try {
          val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 20_000
            readTimeout = 30_000
          }
          val total = conn.contentLengthLong
          val digest = MessageDigest.getInstance("SHA-256")
          var done = 0L
          var lastEmit = 0L
          conn.inputStream.use { input ->
            FileOutputStream(tmp).use { out ->
              val buf = ByteArray(1 shl 16)
              while (true) {
                if (cancelDownload.get()) throw InterruptedException("cancelado")
                val n = input.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                digest.update(buf, 0, n)
                done += n
                if (done - lastEmit > 4_000_000 || done == total) {
                  lastEmit = done
                  sendEvent("onDownloadProgress", mapOf("done" to done, "total" to total))
                }
              }
            }
          }
          val got = digest.digest().joinToString("") { "%02x".format(it) }
          if (!got.equals(sha256, ignoreCase = true)) {
            tmp.delete()
            promise.reject("checksum", "O arquivo baixado não confere com o esperado.", null)
            return@execute
          }
          if (target.exists()) target.delete()
          tmp.renameTo(target)
          promise.resolve(target.absolutePath)
        } catch (e: InterruptedException) {
          tmp.delete()
          promise.reject("cancelled", "Download cancelado.", null)
        } catch (e: Exception) {
          tmp.delete()
          promise.reject("download_failed", e.message ?: "Falha no download.", e)
        } finally {
          downloading.set(false)
        }
      }
    }

    Function("cancelDownload") { cancelDownload.set(true) }

    Function("deleteModel") { fileName: String ->
      if (loadedFile == fileName) {
        llm?.close()
        llm = null
        loadedFile = null
      }
      modelFile(fileName).delete()
    }

    /** Carrega na memória. Demora alguns segundos; fazer antes da primeira pergunta. */
    AsyncFunction("load") { fileName: String, maxTokens: Int, promise: Promise ->
      worker.execute {
        try {
          if (loadedFile == fileName && llm != null) {
            promise.resolve(true)
            return@execute
          }
          llm?.close()
          val file = modelFile(fileName)
          if (!file.exists()) {
            promise.reject("missing", "Modelo ainda não baixado.", null)
            return@execute
          }
          val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(file.absolutePath)
            .setMaxTokens(maxTokens)
            .setMaxTopK(40)
            .build()
          llm = LlmInference.createFromOptions(context, options)
          loadedFile = fileName
          promise.resolve(true)
        } catch (e: Exception) {
          llm = null
          loadedFile = null
          promise.reject("load_failed", e.message ?: "Não foi possível carregar o modelo.", e)
        }
      }
    }

    /**
     * Gera a resposta. Os pedaços chegam por `onToken` (texto acumulado) e o
     * final por `onDone`. Uma geração por vez.
     */
    Function("generate") { requestId: String, prompt: String ->
      val engine = llm ?: run {
        sendEvent("onError", mapOf("requestId" to requestId, "message" to "Modelo não carregado."))
        return@Function false
      }
      val text = StringBuilder()
      try {
        engine.generateResponseAsync(prompt) { partial, done ->
          if (partial != null) {
            text.append(partial)
            sendEvent("onToken", mapOf("requestId" to requestId, "text" to text.toString()))
          }
          if (done) sendEvent("onDone", mapOf("requestId" to requestId, "text" to text.toString()))
        }
      } catch (e: Exception) {
        sendEvent("onError", mapOf("requestId" to requestId, "message" to (e.message ?: "Falha na geração.")))
        return@Function false
      }
      true
    }

    Function("unload") {
      llm?.close()
      llm = null
      loadedFile = null
    }

    OnDestroy {
      llm?.close()
      llm = null
      worker.shutdown()
    }
  }
}
