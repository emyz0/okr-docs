/**
 * 📄 MULTI-FORMAT DOCUMENT PROCESSING
 * 
 * PDF, Excel, Word, TXT dosyalarından metin çıkarma
 * 
 * Desteklenen formatlar:
 * - PDF (.pdf) - PDFLoader ile
 * - Excel (.xlsx, .xls) - xlsx ile
 * - Word (.docx) - mammoth ile
 * - Text (.txt) - fs ile
 */

import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Excel dosyasından metin çıkart
 * @param filePath - Excel dosya yolu
 * @returns Tablo verileri metin formatında
 */
export async function extractTextFromExcel(filePath: string): Promise<string> {
  try {
    console.log(`📊 Excel dosyası okunuyor: ${path.basename(filePath)}`);
    
    // Dosyayı buffer olarak oku
    const buffer = readFileSync(filePath);
    
    // Excel dosyasını buffer'dan yükle
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let fullText = '';
    
    // Her sheet'i işle
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      
      // Sheet'i CSV formatına dönüştür (daha okunaklı)
      const csv = XLSX.utils.sheet_to_csv(sheet);
      
      fullText += `\n--- Sheet: ${sheetName} ---\n${csv}`;
    });
    
    console.log(`✅ Excel okundu: ${workbook.SheetNames.length} sheet, ${fullText.length} karakter`);
    return fullText.trim();
  } catch (error) {
    console.error(`❌ Excel işleme hatası: ${error}`);
    return '';
  }
}

/**
 * Word (.docx) dosyasından metin çıkart
 * @param filePath - Word dosya yolu
 * @returns Metin içeriği
 */
export async function extractTextFromWord(filePath: string): Promise<string> {
  try {
    console.log(`📝 Word dosyası okunuyor: ${path.basename(filePath)}`);
    
    // Dosyayı Buffer'a oku
    const buffer = readFileSync(filePath);
    
    // Mammoth ile metin çıkart
    const result = await mammoth.extractRawText({ buffer });
    
    const text = result.value || '';
    
    console.log(`✅ Word okundu: ${text.length} karakter`);
    return text.trim();
  } catch (error) {
    console.error(`❌ Word işleme hatası: ${error}`);
    return '';
  }
}

/**
 * Text (.txt) dosyasından metin çıkart
 * @param filePath - Text dosya yolu
 * @returns Metin içeriği
 */
export async function extractTextFromTxt(filePath: string): Promise<string> {
  try {
    console.log(`📄 Text dosyası okunuyor: ${path.basename(filePath)}`);
    
    // Dosyayı okuyabilirlik test edilerek oku
    let text = readFileSync(filePath, 'utf-8');
    
    // Encoding sorunlarını düzelt
    text = text
      .replace(/\ufeff/g, '') // BOM karakteri kaldır
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Kontrol karakterleri kaldır
    
    console.log(`✅ Text okundu: ${text.length} karakter`);
    return text.trim();
  } catch (error) {
    console.error(`❌ Text işleme hatası: ${error}`);
    
    // UTF-8 başarısız olursa diğer encodingleri dene
    try {
      const buffer = readFileSync(filePath);
      const latin1Text = buffer.toString('latin1');
      console.log(`✅ Text okundu (latin1): ${latin1Text.length} karakter`);
      return latin1Text.trim();
    } catch (fallbackError) {
      console.error(`❌ Text fallback hatası: ${fallbackError}`);
      return '';
    }
  }
}

/**
 * Dosya tipine göre metin çıkart
 * @param filePath - Dosya yolu
 * @param mimeType - MIME type (opsiyonel)
 * @returns Çıkarılan metin
 */
export async function extractTextByFileType(
  filePath: string,
  mimeType?: string
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);
  
  // MIME type'ına göre tespit et
  const type = mimeType || ext;
  
  console.log(`🔍 Dosya tipi tespit: ${fileName} (${type})`);
  
  // Excel formatları
  if (type.includes('spreadsheet') || ext === '.xlsx' || ext === '.xls') {
    return await extractTextFromExcel(filePath);
  }
  
  // Word formatları
  if (type.includes('word') || type.includes('document') || ext === '.docx') {
    return await extractTextFromWord(filePath);
  }
  
  // Text formatları
  if (type.includes('text') || ext === '.txt') {
    return await extractTextFromTxt(filePath);
  }
  
  console.warn(`⚠️  Bilinmeyen dosya tipi: ${type}`);
  return '';
}

/**
 * Desteklenen dosya tipleri
 */
export const SUPPORTED_FILE_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

/**
 * Accept attribute'u için MIME types string'i
 */
export const ACCEPTED_MIME_TYPES = Object.values(SUPPORTED_FILE_TYPES).join(',');

/**
 * Accept attribute'u için file extensions string'i
 */
export const ACCEPTED_FILE_EXTENSIONS = '.pdf,.xlsx,.xls,.docx,.txt';
