package com.mellowpet.nearby

import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Encontro por NFC, lado "cartão" (HCE).
 *
 * Android não tem mais troca direta entre celulares por NFC (o Android Beam
 * saiu no Android 10). Então um celular emula um cartão e o outro o lê:
 * - SELECT do AID do MellowPet → 90 00
 * - comando 80 10 com o cartão do leitor nos dados → devolve o nosso cartão
 * Uma encostada, os dois recebem o cartão do outro.
 *
 * Só responde enquanto o app está com encontros ativos (a Home aberta); fora
 * disso devolve "não encontrado" e o leitor desiste.
 */
class PetCardApduService : HostApduService() {

  override fun processCommandApdu(command: ByteArray, extras: Bundle?): ByteArray {
    val card = NfcCards.ownCard ?: return SW_NOT_FOUND
    if (isSelect(command)) return SW_OK
    if (command.size >= 5 && command[0] == 0x80.toByte() && command[1] == INS_EXCHANGE) {
      val length = command[4].toInt() and 0xff
      if (length > 0 && command.size >= 5 + length) {
        val theirs = String(command, 5, length, Charsets.UTF_8)
        NfcCards.onReceived?.invoke(theirs)
      }
      return card + SW_OK
    }
    return SW_NOT_FOUND
  }

  override fun onDeactivated(reason: Int) = Unit

  private fun isSelect(c: ByteArray): Boolean {
    if (c.size < 5 + AID.size || c[0] != 0x00.toByte() || c[1] != 0xA4.toByte()) return false
    return c.copyOfRange(5, 5 + AID.size).contentEquals(AID)
  }

  companion object {
    /** AID proprietário (F0 + "MELLOW"); o mesmo do res/xml/apduservice.xml. */
    val AID = byteArrayOf(0xF0.toByte(), 0x4D, 0x45, 0x4C, 0x4C, 0x4F, 0x57)
    const val INS_EXCHANGE: Byte = 0x10
    val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
    val SW_NOT_FOUND = byteArrayOf(0x6A, 0x82.toByte())
  }
}

/** Estado compartilhado entre o módulo (JS) e o serviço HCE, no mesmo processo. */
object NfcCards {
  /** Cartão do nosso pet em bytes; null = encontros desligados. */
  @Volatile var ownCard: ByteArray? = null
  /** Recebe o cartão de quem encostou. */
  @Volatile var onReceived: ((String) -> Unit)? = null
}
