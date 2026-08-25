package com.mellowpet.vision

import android.graphics.Bitmap
import android.graphics.Color
import android.media.Image
import kotlin.math.max

/**
 * YUV_420_888 → ARGB respeitando row/pixel stride.
 *
 * Extraído de MellowVisionView para o serviço de leitura em segundo plano
 * usar a mesma conversão — sem passar por JPEG, que adicionaria compressão
 * com perdas antes do modelo e latência de encode/decode.
 */
internal object YuvConverter {
  fun toBitmap(image: Image): Bitmap {
    val width = image.width
    val height = image.height
    val yPlane = image.planes[0]
    val uPlane = image.planes[1]
    val vPlane = image.planes[2]
    val yBuffer = yPlane.buffer
    val uBuffer = uPlane.buffer
    val vBuffer = vPlane.buffer
    val yStart = yBuffer.position()
    val uStart = uBuffer.position()
    val vStart = vBuffer.position()
    val pixels = IntArray(width * height)

    for (row in 0 until height) {
      val yRow = yStart + row * yPlane.rowStride
      val uvRow = row / 2
      val uRow = uStart + uvRow * uPlane.rowStride
      val vRow = vStart + uvRow * vPlane.rowStride
      for (col in 0 until width) {
        val y = yBuffer.get(yRow + col * yPlane.pixelStride).toInt() and 0xff
        val uvCol = col / 2
        val u = uBuffer.get(uRow + uvCol * uPlane.pixelStride).toInt() and 0xff
        val v = vBuffer.get(vRow + uvCol * vPlane.pixelStride).toInt() and 0xff

        val c = max(0, y - 16)
        val d = u - 128
        val e = v - 128
        val red = ((298 * c + 409 * e + 128) shr 8).coerceIn(0, 255)
        val green = ((298 * c - 100 * d - 208 * e + 128) shr 8).coerceIn(0, 255)
        val blue = ((298 * c + 516 * d + 128) shr 8).coerceIn(0, 255)
        pixels[row * width + col] = Color.rgb(red, green, blue)
      }
    }
    return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
  }
}
