// Next.js API Route: /api/rag/upload endpoint'i
// POST isteğini handle eder ve FARKLI DOSYA TIPLERINI işler
// Desteklenen formatlar: PDF, Excel (.xlsx, .xls), Word (.docx), Text (.txt)

// 🔧 DOMMatrix polyfill (pdfjs-dist + canvas için Node.js ortamında gerekli)
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class DOMMatrix {
    // Temel properties
    a: number = 1; 
    b: number = 0; 
    c: number = 0; 
    d: number = 1; 
    e: number = 0; 
    f: number = 0;
    
    // SVG transform matrix properties
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    
    // Matrix flags
    is2D = true;
    isIdentity = true;
    
    constructor(values?: any) {
      if (values) {
        Object.assign(this, values);
      }
    }
    
    // Matrix operations (pdfjs compat)
    multiply(other: any) { return this; }
    inverse() { return this; }
    translate(x: number, y: number) { return this; }
    scale(x: number, y: number) { return this; }
    rotate(angle: number) { return this; }
    skewX(angle: number) { return this; }
    skewY(angle: number) { return this; }
    flipX() { return this; }
    flipY() { return this; }
  };
}

import { NextRequest, NextResponse } from 'next/server'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { OpenAIEmbeddings } from "@langchain/openai"
import { pool } from '@/lib/rag/db'
import fs from 'fs'
import path from 'path'
import { extractTextFromExcel, extractTextFromWord, extractTextFromTxt } from '@/lib/rag/document-parser'

export async function POST(req: NextRequest) {
  // FormData'yı parse et (dosyaları ve userId'yi oku)
  const formData = await req.formData()
  // formData.getAll('files'): Seçilen tüm PDF dosyalarını array olarak döndürür
  const files = formData.getAll('files') as File[]
  // userId: Hangi kullanıcı için dosya yükleniyorsa onun ID'si
  const userId = formData.get('userId')?.toString() || 'demo-user'

  // Validasyon: En az 1 PDF dosyası seçilmiş mi?
  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'PDF bulunamadı' }, { status: 400 })
  }

  console.log('Upload başladı:', { userId, fileCount: files.length })

  try {
    // OpenAI embedding modeli başlat
    // text-embedding-3-small: Küçük ve hızlı model (1536 boyutlu vektör üretir)
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY!,
      modelName: "text-embedding-3-small",
    })

    // Her dosya için ayrı bir veri array'i tutuyoruz (chunk'ları dosya başına sayabilmek için)
    const allDocs: Array<{file: string, doc: any}> = []

    // ✅ HER DOSYA TIPINI İŞLE (PDF, Excel, Word, TXT)
    for (const file of files) {
      try {
        // Dosyayı buffer'a dönüştür
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Geçici dosya oluştur /tmp klasöründe
        // Dosya adında boşluk ve special karakterleri underscore ile değiştir
        const sanitizedName = file.name
          .replace(/\s+/g, '_')  // Boşlukları underscore yap
          .replace(/[^\w.-]/g, '_')  // Word karakterleri, nokta, tire hariç hepsini underscore yap
        const tempPath = path.join('/tmp', sanitizedName)
        console.log(`📁 Temp dosya: ${tempPath}`)
        fs.writeFileSync(tempPath, buffer)
        
        // Dosyanın yazıldığını kontrol et
        if (!fs.existsSync(tempPath)) {
          console.error(`❌ Dosya yazılamadı: ${tempPath}`)
          continue
        }
        console.log(`✅ Dosya yazıldı: ${fs.statSync(tempPath).size} byte`)

        const ext = path.extname(file.name).toLowerCase()
        let docs: any[] = []

        // 📄 DOSYA TIPINE GÖRE İŞLE
        if (ext === '.pdf') {
          // PDF işleme
          const loader = new PDFLoader(tempPath)
          docs = await loader.load()
          console.log(`📑 PDF: ${file.name} - ${docs.length} sayfa`)
          
          // 🖼️ VLM ile görselleri ve tabloları analiz et (ZORUNLU - hem tablo hem grafik)
          console.log(`🔍 VLM analizi başlanıyor...`)
          try {
            // VLM server'ı check et
            const healthCheck = await fetch('http://localhost:8001/health')
              .then(r => r.ok ? true : false)
              .catch(() => false)
            
            if (!healthCheck) {
              throw new Error('VLM server 8001 portunda erişilemez')
            }
            
            console.log(`✅ VLM server sağlıklı, analiz ediliyor...`)
            // VLM sunucusuna PDF sayfalarını gönder ve tablo/grafikleri çıkart
            const vlmResults: any[] = []
            
            // Her PDF sayfası için VLM'e sor
            for (let pageIdx = 0; pageIdx < docs.length; pageIdx++) {
              const page = docs[pageIdx];
              try {
                console.log(`  📄 Sayfa ${pageIdx + 1}/${docs.length} analiz ediliyor...`)
                // VLM'e gönder (sadece text-based analiz, görsel parsing PDFLoader'dan)
                const vlmResponse = await fetch('http://localhost:8001/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    page_content: page.pageContent,
                    page_number: pageIdx + 1,
                    file_name: file.name
                  }),
                  signal: AbortSignal.timeout(5000) // 5 saniye timeout
                }).catch(() => null)
                
                if (vlmResponse && vlmResponse.ok) {
                  const vlmData = await vlmResponse.json()
                  if (vlmData.tables && vlmData.tables.length > 0) {
                    vlmResults.push({
                      page: pageIdx + 1,
                      tables: vlmData.tables,
                      has_analysis: true
                    })
                    console.log(`    ✅ ${vlmData.tables.length} tablo bulundu`)
                  }
                }
              } catch (pageError) {
                console.warn(`  ⚠️ Sayfa ${pageIdx + 1} VLM analizi atlandı`)
              }
            }
            
            if (vlmResults.length === 0) {
              console.log(`ℹ️ VLM: Tablo analizi yapılmadı (belgede tablo yok veya VLM analiz etmedi)`)
            } else {
              console.log(`✅ VLM: ${vlmResults.length} sayfada tablo/grafik analizi yapıldı`)
              
              // VLM sonuçlarını dokümanlara ekle
              const { formatVLMChunks } = await import('@/lib/rag/pdf-vlm-analyzer')
              const vlmChunks = await formatVLMChunks(vlmResults, file.name)
              vlmChunks.forEach((chunk) => {
                docs.push({
                  pageContent: chunk.content,
                  metadata: chunk.metadata
                })
              })
              
              console.log(`✅ VLM chunks eklendi: toplam ${docs.length} dokuman`)
            }
          } catch (vlmError) {
            console.warn(`⚠️ VLM analizi atlandı:`, vlmError instanceof Error ? vlmError.message : String(vlmError))
            // VLM hatası upload'ı durdurmaz, devam et
          }
        } 
        else if (ext === '.xlsx' || ext === '.xls') {
          // Excel işleme
          const excelText = await extractTextFromExcel(tempPath)
          if (excelText) {
            docs = [{
              pageContent: excelText,
              metadata: { 
                source: file.name, 
                type: 'excel',     // ✅ Excel chunks için "excel"
                file_type: ext 
              }
            }]
            console.log(`📊 Excel: ${file.name} - 1 dokuman (${excelText.length} karakter)`)
          }
        }
        else if (ext === '.docx') {
          // Word işleme
          const wordText = await extractTextFromWord(tempPath)
          if (wordText) {
            docs = [{
              pageContent: wordText,
              metadata: { 
                source: file.name, 
                type: 'word',      // ✅ Word chunks için "word"
                file_type: ext 
              }
            }]
            console.log(`📝 Word: ${file.name} - 1 dokuman`)
          }
        } 
        else if (ext === '.txt') {
          // Text işleme
          const txtText = await extractTextFromTxt(tempPath)
          if (txtText) {
            docs = [{
              pageContent: txtText,
              metadata: { 
                source: file.name, 
                type: 'text',      // ✅ Text chunks için "text"
                file_type: ext 
              }
            }]
            console.log(`📄 Text: ${file.name} - 1 dokuman`)
          }
        }

        if (docs.length === 0) {
          console.warn(`⚠️  ${file.name}: Dokuman çıkarılamadı`)
          continue
        }

        // Excel dosyaları için satırları ayır (CSV satırlarını dokümanlara böl)
        if (ext === '.xlsx' || ext === '.xls') {
          // CSV satırlarını dokümanlara dönüştür
          const lines = docs[0].pageContent.split('\n').filter((line: string) => line.trim())
          const splitExcelDocs = lines.map((line: string, idx: number) => ({
            pageContent: line,
            metadata: {
              source: file.name,
              file_type: ext,
              page_index: idx + 1,
              has_images: false
            }
          }))
          allDocs.push(...splitExcelDocs.map((doc: any) => ({ file: file.name, doc })))
          continue
        }

        // 📋 METADATA'YA KAYNAK BİLGİSİ EKLE (PDF, Word, TXT için)
        const docsWithSource = docs.map((d, pageIdx) => {
          const meta = (d.metadata as any) || {}
          
          // Görselleri algıla
          const hasImages = d.pageContent.includes('[Image]') || 
                           d.pageContent.includes('table') ||
                           d.pageContent.includes('Tablo')
          
          return {
            ...d,
            metadata: { 
              ...meta, 
              source: file.name,
              type: 'pdf',         // ✅ Tür: PDF chunks
              file_type: ext,      // Dosya tipi
              has_images: hasImages,
              page_index: pageIdx + 1
            },
          }
        })
        
        allDocs.push(...docsWithSource.map(doc => ({ file: file.name, doc })))

        // Geçici dosyayı sil
        fs.unlinkSync(tempPath)
      } catch (fileError: any) {
        console.error(`❌ ${file.name} işleme hatası: ${fileError.message}`)
        // Hata olsa da devam et
      }
    }

    // Metin splitter başlat
    // Uzun metni daha küçük parçalara (chunk'lara) böler
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,        // Her chunk maksimum 1000 karakter
      chunkOverlap: 200,      // Chunk'lar arasında 200 karakter örtüşme (context kaybını azaltmak için)
    })
    
    // Her dosya için ayrı chunk'lama yap
    // Böylece her dosyanın chunk'ları 1'den başlayarak numaralanır
    const splitDocs: any[] = []
    // Dosya ismine göre dokümantları gruplaştır
    const fileMap = new Map<string, any[]>()
    
    // allDocs'taki tüm dokümantları dosya ismine göre grupla
    for (const { file, doc } of allDocs) {
      if (!fileMap.has(file)) fileMap.set(file, [])
      fileMap.get(file)!.push(doc)
    }
    
    // Her dosya grubunu ayrı ayrı chunk'la
    for (const [file, fileDocs] of fileMap.entries()) {
      // Bu dosyaya ait dokümantları chunk'la
      const fileChunks = await splitter.splitDocuments(fileDocs)
      // Her chunk'a 1'den başlayan numara ver (bu dosya için)
      fileChunks.forEach((chunk, idx) => {
        chunk.metadata = { ...chunk.metadata, chunk: idx + 1 }
        splitDocs.push(chunk)
      })
    }

    // PostgreSQL'e kaydet
    // Tüm chunk'ları veritabanına insert et
    let insertedCount = 0
    
    // 🆔 Her dosya grubu için file_id'yi bir kez belirle (BAŞI'NDA)
    // Döngü içinde MAX sorgusu çalıştırırsan, her döngüde sonuç değişebilir
    const fileIdMap = new Map<string, number>()
    const maxFileIdResult = await pool.query(
      'SELECT COALESCE(MAX(file_id), 0) as max_file_id FROM documents WHERE user_id = $1',
      [userId]
    )
    let nextFileId = (maxFileIdResult.rows[0]?.max_file_id ?? 0) + 1
    
    for (const [file, ] of fileMap.entries()) {
      // Her dosyaya sırayla artan file_id ver
      fileIdMap.set(file, nextFileId)
      console.log(`📁 ${file}: file_id = ${nextFileId}`)
      nextFileId++  // Sonraki dosya için ID'yi artır
    }
    
    for (let i = 0; i < splitDocs.length; i++) {
      const doc = splitDocs[i]
      // Metadata'dan bilgiler oku
      const baseMeta = (doc.metadata as any) || {}
      // PDF'in hangi sayfasından geldiğini belirle
      const page = baseMeta.loc?.pageNumber ?? baseMeta.page ?? 'N/A'
      // Satır numarasını belirle (eğer varsa)
      const lineNumber = baseMeta.loc?.lines?.from ?? 'N/A'
      // Chunk numarası daha önce set edilmiş, onu koru
      const chunkNum = baseMeta.chunk || 'N/A'
      // Metadata'yı hazırla
      doc.metadata = { ...baseMeta, chunk: chunkNum, page, lineNumber }
      
      try {
        // Bu chunk'ı embedding modeline gönder (vektör halinde kodla)
        // Önce metni temizle: null karakterleri ve kontrol karakterlerini kaldır
        let cleanContent = doc.pageContent
          .replace(/\u0000/g, '')           // Null karakterleri kaldır
          .replace(/[\x00-\x1F\x7F]/g, '')  // Kontrol karakterlerini kaldır
          .replace(/[\uFEFF]/g, '')          // BOM karakterini kaldır
          .replace(/[^\x20-\x7E\xA0-\xFF]/g, '') // Baskı yapılamayan karakterleri kaldır
          .trim();
        
        // Boş metin kontrol et
        if (!cleanContent) {
          console.warn('⚠️ Chunk temizlendikten sonra boş');
          continue;
        }
        
        const embedding = await embeddings.embedQuery(cleanContent)
        
        // Embedding başarılı mı kontrol et
        if (!embedding || embedding.length === 0) {
          console.error(' Embedding boş:', cleanContent.substring(0, 50))
          continue
        }

        console.log(' Embedding boyutu:', embedding.length, 'User:', userId)
        
        // Metadata'yı da temizle (null karakterleri kaldır)
        let cleanMetadata = JSON.stringify(doc.metadata)
          .replace(/\u0000/g, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
          .replace(/[\uFEFF]/g, '')
          .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
        
        // JSON geçerliliğini kontrol et
        try {
          JSON.parse(cleanMetadata);
        } catch (e) {
          console.warn('⚠️ Metadata JSON hata, temizleniyor');
          cleanMetadata = JSON.stringify({ source: doc.metadata?.source || 'unknown', chunk: doc.metadata?.chunk || 'N/A' });
        }
        
        // Veritabanına insert et
        // 🆔 file_id: Her dosya için SABIT (tüm chunks bu ID'yi paylaşır)
        // file_id dosya başında belirlenmiş ve map'te tutuluyor
        const fileId = fileIdMap.get(doc.metadata.source) || 1
        const result = await pool.query(
          `INSERT INTO public.documents (user_id, content, metadata, embedding, file_id)
           VALUES ($1, $2, $3::jsonb, $4::vector, $5)
           RETURNING id, file_id`,
          [userId, cleanContent, cleanMetadata, JSON.stringify(embedding), fileId]
        )
        insertedCount++
        console.log(` Chunk kaydedildi: ID=${result.rows[0]?.id}, FileID=${result.rows[0]?.file_id}`)
      } catch (insertErr: any) {
        // Eğer bu chunk insert edilemezse, hata yaz ama devam et
        console.error(' Chunk insert hatası:', insertErr.message)
        console.error('   Error Code:', insertErr.code)
        console.error('   SQL:', insertErr.detail)
      }
    }

    // Başarı cevabı döndür
    // Kaç chunk'ın başarıyla kaydedildiğini bildir
    console.log("\n" + "=".repeat(80));
    console.log("✅ UPLOAD COMPLETE");
    console.log("=".repeat(80));
    console.log(`📊 Toplam chunk: ${insertedCount}/${splitDocs.length}`);
    console.log(`👤 UserID: ${userId}`);
    console.log(`📁 File groups: ${fileMap.size}`);
    for (const [file, ] of fileMap.entries()) {
      const fileId = fileIdMap.get(file);
      console.log(`   - ${file}: file_id=${fileId}`);
    }
    console.log("=".repeat(80) + "\n");
    
    return NextResponse.json({ 
      success: true, 
      count: insertedCount,
      message: `✅ ${insertedCount}/${splitDocs.length} chunk başarıyla kaydedildi`
    })
  } catch (err: any) {
    console.error('Yükleme hatası:', err)
    return NextResponse.json({ error: err.message || 'İşleme hatası' }, { status: 500 })
  }
}
