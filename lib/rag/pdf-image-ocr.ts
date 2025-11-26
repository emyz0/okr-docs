/**
 * 📄 PDF IMAGE & TABLE OCR
 * 
 * PDF sayfalarını render edip OCR ile metin çıkaran modül
 * Görseller ve tabloların içindeki metni okur
 */

import { createCanvas } from 'canvas'
import Tesseract from 'tesseract.js'
import { recognizeImageText } from './pdf-ocr-processor'

/**
 * PDF sayfasını canvas'a render et ve Base64'e çevir
 * @param pdfDoc - PDF document (any type)
 * @param pageNum - Sayfa numarası
 * @returns Base64 resim
 */
async function renderPdfPageToBase64(
  pdfDoc: any,
  pageNum: number
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })

    // Canvas oluştur
    const canvas = createCanvas(viewport.width, viewport.height)
    const context = canvas.getContext('2d')

    // Sayfayı render et
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise

    // Base64'e çevir
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error(`❌ Sayfa ${pageNum} render hatası: ${error}`)
    return ''
  }
}

/**
 * PDF'deki sayfalarda OCR çalıştır
 * @param pdfPath - PDF dosya yolu
 * @param maxPages - Max kaç sayfa işlenecek
 * @returns OCR sonuçları (sayfa bazında)
 * 
 * Örnek output:
 * [
 *   { pageNum: 1, text: "Sayfadaki metin", confidence: 85 },
 *   { pageNum: 2, text: "Tablo metni", confidence: 72 },
 * ]
 */
export async function extractOCRFromPdf(
  pdfPath: string,
  maxPages: number = 50
): Promise<Array<{ pageNum: number; text: string; confidence: number }>> {
  try {
    console.log(`📄 PDF OCR başlıyor: ${pdfPath} (max ${maxPages} sayfa)`)

    // pdfjs-dist'i require et (dynamic import)
    const pdfjs = await import('pdfjs-dist')
    
    // Worker ayarla
    pdfjs.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

    // PDF'i oku
    const fs = await import('fs')
    const data = fs.readFileSync(pdfPath)
    const pdf = await pdfjs.getDocument({ data }).promise

    const results: Array<{ pageNum: number; text: string; confidence: number }> = []
    const totalPages = Math.min(pdf.numPages, maxPages)

    console.log(`📖 PDF ${totalPages} sayfa bulundu, OCR işleniyor...`)

    // Her sayfa için OCR çalıştır
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        console.log(`📸 Sayfa ${pageNum}/${totalPages} işleniyor...`)

        // Sayfayı render et
        const base64Image = await renderPdfPageToBase64(pdf, pageNum)
        
        if (!base64Image) {
          console.warn(`⚠️  Sayfa ${pageNum} render edilemedi`)
          continue
        }

        // OCR çalıştır
        const ocrResult = await recognizeImageText(base64Image)
        
        results.push({
          pageNum,
          text: ocrResult.text,
          confidence: ocrResult.confidence,
        })

        console.log(`✅ Sayfa ${pageNum}: ${ocrResult.text.substring(0, 40)}... (${Math.round(ocrResult.confidence)}%)`)

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (pageError) {
        console.warn(`⚠️  Sayfa ${pageNum} OCR hatası: ${pageError}`)
      }
    }

    console.log(`✅ PDF OCR tamamlandı: ${results.length} sayfa işlendi`)
    return results
  } catch (error) {
    console.error(`❌ PDF OCR genel hatası: ${error}`)
    return []
  }
}

/**
 * OCR sonuçlarından görsel içeren sayfaları filtrele
 * @param results - OCR sonuçları
 * @returns Sadece görsel/tablo içeren sayfalar
 */
export function filterImagePages(
  results: Array<{ pageNum: number; text: string; confidence: number }>
): typeof results {
  // Düşük güven = daha çok görsel/tablo
  return results.filter((r) => r.confidence < 70 && r.text.length > 0)
}

/**
 * OCR sonuçlarını chunk olarak formatla
 * @param results - OCR sonuçları
 * @param sourceFile - Kaynak dosya adı
 * @returns Chunk formatında metin
 */
export function formatOCRChunks(
  results: Array<{ pageNum: number; text: string; confidence: number }>,
  sourceFile: string
): Array<{
  pageNum: number
  content: string
  metadata: {
    source: string
    type: 'ocr'
    confidence: number
    page: number
  }
}> {
  return results
    .filter((r) => r.text.trim().length > 0)
    .map((r) => ({
      pageNum: r.pageNum,
      content: r.text,
      metadata: {
        source: sourceFile,
        type: 'ocr',
        confidence: r.confidence,
        page: r.pageNum,
      },
    }))
}
