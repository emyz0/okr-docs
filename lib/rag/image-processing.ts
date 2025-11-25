/**
 * 📸 IMAGE & TABLE PROCESSING UTILITY
 * 
 * PDF'den çıkarılan görsellerdeki metni Tesseract.js ile okur (OCR)
 * ve tabloları yapılandırılmış formata dönüştürür.
 * 
 * Kullanım:
 * - extractTextFromImage(): Resimden metin çıkart (OCR)
 * - convertTableToMarkdown(): Tablo verilerini Markdown'a dönüştür
 */

import Tesseract from 'tesseract.js'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Resimden metin çıkart (OCR - Optical Character Recognition)
 * 
 * @param imagePath - İmaj dosyasının yolu
 * @param language - Dil kodu (örn: 'tur' Türkçe, 'eng' İngilizce)
 * @returns Çıkarılan metin
 * 
 * Tesseract.js açıklaması:
 * - Google'ın Tesseract OCR engine'inin JavaScript versiyonu
 * - Görsel -> Metin dönüşümü yapar
 * - Kutuları, tabloları, el yazısını da kısmen tanır
 * - CPU intensif olduğu için tarayıcıda yavaş olabilir
 */
export async function extractTextFromImage(
  imagePath: string,
  language: string = 'tur+eng' // Türkçe + İngilizce desteği
): Promise<string> {
  try {
    console.log(`🖼️  OCR başladı: ${path.basename(imagePath)}`);
    
    // Tesseract worker'ı başlat
    const worker = await Tesseract.createWorker()
    
    try {
      // Görüntüyü işle (options objesi gerekli)
      const result = await worker.recognize(imagePath)
      const text = result.data.text || ''
      
      console.log(`✅ OCR tamamlandı: ${text.substring(0, 100)}...`)
      return text.trim()
    } finally {
      // Worker'ı temizle (bellek tasarrufu)
      await worker.terminate()
    }
  } catch (error) {
    console.error(`❌ OCR hatası: ${error}`)
    return '' // Hata durumunda boş string döndür
  }
}

/**
 * Tablo verisini Markdown formatına dönüştür
 * 
 * Örnek input:
 * {
 *   headers: ['Ad', 'Soyadı', 'Maaş'],
 *   rows: [
 *     ['Ali', 'Yılmaz', '5000'],
 *     ['Ayşe', 'Demir', '6000']
 *   ]
 * }
 * 
 * Örnek output:
 * | Ad  | Soyadı | Maaş  |
 * |-----|--------|-------|
 * | Ali | Yılmaz | 5000  |
 * | Ayşe| Demir  | 6000  |
 * 
 * @param table - Tablo verisi (headers + rows)
 * @returns Markdown formatında tablo
 */
export function convertTableToMarkdown(table: {
  headers: string[]
  rows: string[][]
}): string {
  if (!table.headers || !table.rows) {
    return ''
  }
  
  // Başlık satırı
  let markdown = `| ${table.headers.join(' | ')} |\n`
  
  // Ayırıcı satır
  markdown += `| ${table.headers.map(() => '---').join(' | ')} |\n`
  
  // Veri satırları
  for (const row of table.rows) {
    markdown += `| ${row.join(' | ')} |\n`
  }
  
  return markdown.trim()
}

/**
 * PDF'den çıkarılan metin + tablo + OCR sonuçlarını birleştir
 * 
 * @param pageText - PDF'den çıkarılan metin (normal)
 * @param tableData - Bulunmuş tablo verileri
 * @param ocrResults - Resimlerden çıkarılan metin
 * @returns Birleştirilmiş içerik
 */
export function mergeContentSources(
  pageText: string,
  tableData?: string[],
  ocrResults?: string[]
): string {
  const parts: string[] = []
  
  // Normal metin
  if (pageText && pageText.trim()) {
    parts.push(pageText)
  }
  
  // Tablo veriler
  if (tableData && tableData.length > 0) {
    parts.push('\n--- TABLOLAR ---')
    parts.push(...tableData)
  }
  
  // OCR sonuçları
  if (ocrResults && ocrResults.length > 0) {
    parts.push('\n--- GÖRSELLERDEKİ METİN (OCR) ---')
    parts.push(...ocrResults)
  }
  
  return parts.join('\n\n')
}

/**
 * UYARI: Tesseract.js performansı
 * 
 * - Tesseract.js, tarayıcıda çalıştığında CPU yükü çoktur
 * - Server-side (Node.js) ortamda daha hızlıdır
 * - Large PDF'ler için çok zaman alabilir
 * 
 * Alternatifler:
 * 1. Python (pytesseract) - Daha hızlı, server-side API olarak
 * 2. AWS Textract - Cloud-based, doğru ve hızlı
 * 3. Google Cloud Vision - Tablo ve el yazısı tanıma
 * 4. Azure Computer Vision - Resim ve tablo tanıma
 * 
 * Şu anda: Tesseract.js kullanıyoruz (ücretsiz, açık kaynak)
 */
