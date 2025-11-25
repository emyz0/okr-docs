/**
 * 📄 DOKÜMAN OCR PROCESSOR
 * 
 * Tesseract.js ile görüntülerdeki metni okuyan modül
 * Base64 görüntüleri OCR'a gönderir
 */

import Tesseract from 'tesseract.js'

/**
 * Görüntüyü OCR ile oku (Base64 format)
 * @param base64Image - Base64 formatında görüntü
 * @param language - Dil (tur+eng = Türkçe + İngilizce)
 * @returns OCR metin ve güven skoru
 */
export async function recognizeImageText(
  base64Image: string,
  language: string = 'tur+eng'
): Promise<{ text: string; confidence: number }> {
  try {
    console.log(`�️  OCR başladı (${base64Image.substring(0, 30)}...)`)

    const worker = await Tesseract.createWorker()

    try {
      const result = await worker.recognize(base64Image)
      
      const text = result.data.text || ''
      const confidence = result.data.confidence || 0

      console.log(`✅ OCR tamamlandı: %${Math.round(confidence)}, ${text.length} karakter`)

      return {
        text: text.trim(),
        confidence,
      }
    } finally {
      await worker.terminate()
    }
  } catch (error) {
    console.error(`❌ OCR hatası: ${error}`)
    return { text: '', confidence: 0 }
  }
}

/**
 * Batch OCR - Çok sayıda görüntü işle
 * @param images - Base64 görüntü dizisi
 * @returns OCR sonuçları
 */
export async function batchRecognizeImages(
  images: string[]
): Promise<Array<{ text: string; confidence: number }>> {
  const results: Array<{ text: string; confidence: number }> = []

  for (let i = 0; i < images.length; i++) {
    console.log(`📸 Görüntü ${i + 1}/${images.length} işleniyor...`)
    const result = await recognizeImageText(images[i])
    results.push(result)

    // Rate limiting
    if (i < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  console.log(`✅ Batch OCR tamamlandı: ${results.length} görüntü`)
  return results
}

/**
 * OCR sonuçlarını metin olarak birleştir
 * @param results - OCR sonuçları
 * @returns Birleştirilmiş metin
 */
export function mergeOCRResults(
  results: Array<{ text: string; confidence: number }>
): string {
  return results
    .filter((r) => r.text && r.text.length > 0)
    .map((r, idx) => `[Görüntü ${idx + 1} - %${Math.round(r.confidence)} güven]\n${r.text}`)
    .join('\n\n---\n\n')
}

