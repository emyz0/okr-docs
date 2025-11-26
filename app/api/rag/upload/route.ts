// Next.js API Route: /api/rag/upload endpoint'i
// POST isteğini handle eder ve FARKLI DOSYA TIPLERINI işler
// Desteklenen formatlar: PDF, Excel (.xlsx, .xls), Word (.docx), Text (.txt)
import { NextRequest, NextResponse } from 'next/server'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { OpenAIEmbeddings } from "@langchain/openai"
import { pool } from '@/lib/rag/db'
import { recognizeImageText } from '@/lib/rag/pdf-ocr-processor'
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
          
          // 🖼️ OCR ile görselleri de oku
          try {
            const { extractOCRFromPdf } = await import('@/lib/rag/pdf-image-ocr')
            const ocrResults = await extractOCRFromPdf(tempPath, 20) // İlk 20 sayfa
            
            if (ocrResults.length > 0) {
              console.log(`✅ OCR: ${ocrResults.length} sayfadan metin çıkarıldı`)
              
              // OCR sonuçlarını dokümanlara ekle
              ocrResults.forEach((ocr) => {
                docs.push({
                  pageContent: `[OCR - Sayfa ${ocr.pageNum}]\n${ocr.text}`,
                  metadata: {
                    source: file.name,
                    type: 'ocr',
                    page: ocr.pageNum,
                    confidence: ocr.confidence,
                    has_images: true
                  }
                })
              })
              
              console.log(`📊 OCR chunk'ları eklendi: toplam ${docs.length} dokuman`)
            }
          } catch (ocrError) {
            console.warn(`⚠️  OCR hatası (devam etme): ${ocrError}`)
          }
        } 
        else if (ext === '.xlsx' || ext === '.xls') {
          // Excel işleme
          const excelText = await extractTextFromExcel(tempPath)
          if (excelText) {
            docs = [{
              pageContent: excelText,
              metadata: { source: file.name, type: 'excel' }
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
              metadata: { source: file.name, type: 'word' }
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
              metadata: { source: file.name, type: 'text' }
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
              file_type: ext,  // Dosya tipi
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
    
    // 🆔 Her dosya grubu için file_id'yi bir kez belirle
    const fileIdMap = new Map<string, number>()
    for (const [file, ] of fileMap.entries()) {
      // Bu dosya için file_id'yi belirle (MAX + 1)
      const result = await pool.query(
        'SELECT COALESCE(MAX(file_id), 0) + 1 as next_file_id FROM documents WHERE user_id = $1',
        [userId]
      )
      fileIdMap.set(file, result.rows[0].next_file_id)
      console.log(`📁 ${file}: file_id = ${result.rows[0].next_file_id}`)
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
    return NextResponse.json({ 
      success: true, 
      count: insertedCount,
      message: ` ${insertedCount}/${splitDocs.length} chunk başarıyla kaydedildi`
    })
  } catch (err: any) {
    console.error('Yükleme hatası:', err)
    return NextResponse.json({ error: err.message || 'İşleme hatası' }, { status: 500 })
  }
}
