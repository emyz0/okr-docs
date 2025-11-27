# 🎓 OKR-DOCS SİSTEMİ - KAPSAMLI ÖZET

## TL;DR (Çok Uzun; Okudum)

**Bu sistem nedir?**
- Kullanıcı PDF yükler
- Sistem onu analiz eder (metin + görsel)
- Sorulara akıllı cevaplar verir
- Kaynakları gösterir

**Teknoloji?**
- NextJS (Frontend)
- PostgreSQL + pgvector (Veri)
- OpenAI API (AI)
- Qwen VLM (Görsel)
- Qwen Reranker (Sıralama)

**Durum?**
✅ Tamamlandı ve çalışıyor

---

## 📁 TÜM DOSYA LİSTESİ VE AÇIKLAMASI

### 🔴 KULLANILANLAR (17 TypeScript + 2 Python)

#### `/lib/rag/` (5 TypeScript)

**1. db.ts** ⭐⭐⭐ KRİTİK
```
Görev: PostgreSQL bağlantı
Kod satırı: ~30
Önemli function: pool.query()

NE YAPIP?
- Connection pool oluşturur
- Tüm database sorgularını yapar
- pgvector uzantısı ile vektör arama

ÖRNEK:
const result = await pool.query(
  'SELECT * FROM documents WHERE user_id = $1',
  [userId]
)
```

**2. chain.ts** ⭐⭐⭐ KRİTİK
```
Görev: OpenAI bağlantı
Kod satırı: ~20
Önemli exports: embeddings, llm

NE YAPIP?
- text-embedding-3-small yükler (1536-dim)
- gpt-4o-mini yükler (LLM)
- Hem embedding hem LLM çağrısı

ÖRNEK:
const qEmb = await embeddings.embedQuery(question)
const response = await llm.invoke(prompt)
```

**3. rerank.ts** ⭐⭐ ÖNEMLİ
```
Görev: Cohere API fallback
Kod satırı: ~80
Önemli function: rerankDocuments()

NE YAPIP?
- Qwen reranker down ise Cohere kullan
- 10 dokuman → 3 en ilgili
- Relevance score hesapla

DURUMU:
Fallback mechanism (Qwen başarılı olduğu sürece çalışmıyor)
```

**4. pdf-vlm-analyzer.ts** ⭐⭐ ÖNEMLİ
```
Görev: VLM integration
Kod satırı: ~200
Önemli functions:
- extractContentWithVLM()
- analyzeImageWithVLM()
- renderPdfPageToBase64()
- formatVLMChunks()

NE YAPIP?
1. PDF sayfalarını görsele render et
2. VLM sunucusuna gönder
3. Tablo/diagram analiz et
4. Chunks'a dönüştür

ÖRNEK:
const vlmResults = await extractContentWithVLM(pdfPath, 20)
// [{pageNum: 1, analysis: "Tablo: ...", contentType: "table"}, ...]
```

**5. pdf-ocr-processor.ts** ⭐ DESTEKLEYICI
```
Görev: OCR (Tesseract.js)
Kod satırı: ~100
Status: YAZILMIS AMA OCR YERINE VLM KULLANILIYOR

Fonksiyonlar:
- recognizeImageText()
- batchRecognizeImages()
- mergeOCRResults()

UNUSED AMA DURUYOR (OCR'dan VLM'ye geçildi)
```

**6. pdf-image-ocr.ts** ⭐ DESTEKLEYICI
```
Görev: OCR orkestrasyon
Kod satırı: ~150
Status: YAZILMIS AMA VLM YERINE KULLANILIYOR

Fonksiyonlar:
- extractOCRFromPdf()
- filterImagePages()
- formatOCRChunks()

NOT: VLM eklenince bu kullanılmayı bıraktı (referans için kalıyor)
```

**7. document-parser.ts** ⭐ DESTEKLEYICI
```
Görev: Excel, Word, TXT parsing
Kod satırı: ~150
Önemli functions:
- extractTextFromExcel()
- extractTextFromWord()
- extractTextFromTxt()

NE YAPIP?
- Excel → CSV → chunks
- Word .docx → text
- TXT → UTF-8 (fallback: Latin1)

KULLANIŞ:
upload route'unda çağrılır
```

#### `/app/api/rag/` (4 TypeScript Routes)

**8. upload/route.ts** ⭐⭐⭐ KRİTİK
```
Görev: Dosya yükleme
Kod satırı: ~320
Önemli operations:
1. Dosya türü kontrol
2. Metin çıkarma
3. VLM analiz
4. Chunking
5. Embedding
6. Database kayıt

ADIM ADIM:
1. FormData parse et
2. Geçici dosyaya kaydet
3. Dosya tipine göre işle:
   - PDF → PDFLoader + VLM
   - Excel → XLSX library
   - Word → Mammoth
   - TXT → fs.readFileSync
4. Metin chunks'a böl (1000 char, 200 overlap)
5. Tüm chunks embedding'e çevir
6. Database'e INSERT
7. file_id ata (tüm chunks aynı)

HATALARı:
- Dosya tipi unknown → skip
- Metin çıkarılamadı → skip
- VLM fail → sadece metin chunks
- Embedding fail → durdur
- Database fail → durdur
```

**9. query/route.ts** ⭐⭐⭐ KRİTİK
```
Görev: Sorgu işleme
Kod satırı: ~250
Önemli operations:
1. Soruyu embedding'e çevir
2. Vector search (TOP 10)
3. Reranking (TOP 3)
4. LLM cevap
5. Konuşma kaydet

ADIM ADIM:
1. embeddings.embedQuery(question) → [0.123, ...]
2. pool.query() → vector search via <-> operator
3. Try Qwen reranker (http://localhost:8000/rerank)
4. Catch → Fallback Cohere
5. llm.invoke(prompt) → LLM cevap
6. pool.query() → sections güncellemesi
7. Return {answer, sources, sectionId}

HATA HANDLING:
- Vector search 0 sonuç → "Bilgi yok"
- Reranker down → Cohere fallback
- LLM down → Error response
```

**10. pdfs/route.ts** ⭐ DESTEKLEYICI
```
Görev: PDF listesi
Kod satırı: ~50

YAPIP:
SELECT DISTINCT metadata->>'source' FROM documents
WHERE user_id = $1

SONUÇ: Kullanıcının yüklediği tüm PDF'ler
```

**11. sections/route.ts** ⭐ DESTEKLEYICI
```
Görev: Konuşma kaydı
Kod satırı: ~100

YAPIP:
GET: SELECT * FROM sections WHERE user_id = $1
POST: INSERT INTO sections
DELETE: DELETE FROM sections WHERE id = $1
```

#### `/app/api/` (Diğer)

**12. /api/news/* ** ❌ UNRELATED
```
Görev: News API (proje dışı)
Status: DEPRECATED - Silinebilir
```

#### Root Level TypeScript

**13. next.config.ts** 🔧 CONFIG
```
Görev: Next.js konfigürasyonu
İçinde:
- Turbopack enable
- Transformers build
- PDF parsing
```

#### Python Sunucuları (2 Dosya)

**14. vlm_server.py** ⭐⭐ ÖNEMLİ
```
Port: 8001
Görev: Qwen VLM
Kod satırı: ~180

Model: Qwen/Qwen3-VL-4B-Instruct
- float16 (GPU) / float32 (CPU)
- Flash Attention 2 (GPU)

ENDPOINTS:
- POST /analyze
  - Input: {image_base64, task, language}
  - Output: {analysis, content_type, confidence}

- GET /health
  - Output: {status, device, model_loaded}

STARTUP:
~1-2 min model yüklenmesi (ilk kez)
```

**15. reranker_server.py** ⭐⭐ ÖNEMLİ
```
Port: 8000
Görev: Qwen Reranker
Kod satırı: ~160

Model: Qwen/Qwen3-Reranker-4B
- float32 CPU/GPU
- Padding token otomatik

ENDPOINTS:
- POST /rerank
  - Input: {query, documents, top_k}
  - Output: {ranked_documents, scores}

- GET /health
  - Output: {status, device, model_loaded}

STARTUP:
~1-2 min model yüklenmesi (ilk kez)
```

#### Setup Scripts

**16. setup_vlm.sh** 🔧
```
Görev: VLM kurulum otomatizasyonu
İçinde:
- Python venv
- pip install
- Başlatma talimatları
```

**17. setup_reranker.sh** 🔧
```
Görev: Reranker kurulum otomatizasyonu
(Aynı logic)
```

---

### ❌ KULLANILANMAYAN DOSYALAR (3 Deprecated)

**1. pdf-image-extraction.ts**
- Eski görsel çıkarma yöntemi
- OCR/VLM ile değiştirildi
- Kod: ~100 satır
- Silinebilir

**2. image-processing.ts**
- Eski image processing
- VLM ile değiştirildi
- Kod: ~80 satır
- Silinebilir

**3. extract_pdf_images.py**
- Eski Python script
- Deprecated
- Silinebilir

---

## 🔄 VERI AKIŞI (DETAYLI)

### Upload Akışı

```
User Action: PDF yükle
   ↓
/api/rag/upload POST
   ├─ Step 1: File parse
   │   ├─ Get FormData
   │   ├─ Get files array
   │   └─ Validate (at least 1 file)
   │
   ├─ Step 2: File loop
   │   ├─ For each file in files:
   │   │  ├─ Read into buffer
   │   │  ├─ Sanitize filename (remove spaces, special chars)
   │   │  ├─ Write to /tmp
   │   │  └─ Get file extension
   │   │
   │   ├─ Step 3: Text extraction (file type based)
   │   │  ├─ If PDF:
   │   │  │  ├─ new PDFLoader(tempPath)
   │   │  │  └─ await loader.load() → docs[]
   │   │  │
   │   │  ├─ Else if Excel:
   │   │  │  ├─ XLSX.read(buffer)
   │   │  │  ├─ Sheet to CSV
   │   │  │  └─ Split into rows
   │   │  │
   │   │  ├─ Else if Word:
   │   │  │  ├─ mammoth.extractRawText()
   │   │  │  └─ Return text
   │   │  │
   │   │  └─ Else if TXT:
   │   │     ├─ fs.readFileSync(UTF-8)
   │   │     └─ Fallback: Latin1
   │   │
   │   ├─ Step 4: VLM Analysis (PDF only)
   │   │  ├─ extractContentWithVLM(tempPath, 20)
   │   │  │  ├─ For i=1 to 20:
   │   │  │  │  ├─ renderPdfPageToBase64(i)
   │   │  │  │  ├─ HTTP POST http://localhost:8001/analyze
   │   │  │  │  ├─ Get {analysis, contentType}
   │   │  │  │  └─ Push to results
   │   │  │  │
   │   │  │  └─ Return results[]
   │   │  │
   │   │  └─ formatVLMChunks(results)
   │   │     └─ Return [{content, metadata}, ...]
   │   │
   │   ├─ Step 5: Add metadata
   │   │  └─ For each doc:
   │   │     ├─ Add source filename
   │   │     ├─ Add file_type
   │   │     └─ Add has_images flag
   │   │
   │   └─ Step 6: File ID assignment
   │      ├─ Query: SELECT MAX(file_id) FROM documents WHERE user_id
   │      ├─ file_id = MAX + 1
   │      └─ Store in fileIdMap
   │
   ├─ Step 7: All docs combine
   │   └─ allDocs = [doc1, doc2, ..., docN]
   │
   ├─ Step 8: Chunking
   │   ├─ RecursiveCharacterTextSplitter
   │   │  ├─ chunkSize: 1000
   │   │  ├─ chunkOverlap: 200
   │   │  └─ Split all docs
   │   │
   │   └─ chunks = [chunk1, chunk2, ...]
   │
   ├─ Step 9: Embedding
   │   ├─ For each chunk:
   │   │  ├─ await embeddings.embedQuery(chunk.pageContent)
   │   │  └─ embedding = [0.123, 0.456, ...]
   │   │
   │   └─ All chunks have embeddings
   │
   └─ Step 10: Database insert
      ├─ For each chunk:
      │  ├─ INSERT INTO documents
      │  │  (file_id, user_id, content, metadata, embedding)
      │  │
      │  └─ VALUES (fileId, userId, text, json, vector)
      │
      └─ All chunks saved! ✅
```

### Query Akışı

```
User Action: Soru sor
   ↓
/api/rag/query POST
   ├─ Step 1: Parse request
   │   ├─ {question, userId, selectedPdfs?, conversationHistory?, sectionId?}
   │   └─ Validate (question + userId required)
   │
   ├─ Step 2: Embed question
   │   ├─ await embeddings.embedQuery(question)
   │   └─ qEmb = [0.111, 0.222, ...]
   │
   ├─ Step 3: Vector search
   │   ├─ SQL Query:
   │   │  SELECT * FROM documents
   │   │  WHERE user_id = $1
   │   │  AND metadata->>'source' = ANY($2)  ← if selectedPdfs
   │   │  ORDER BY embedding <-> qEmb::vector  ← pgvector distance
   │   │  LIMIT 10
   │   │
   │   └─ result.rows = [chunk1, chunk2, ..., chunk10]
   │
   ├─ Step 4: Reranking
   │   ├─ TRY:
   │   │  ├─ HTTP POST http://localhost:8000/rerank
   │   │  │  ├─ Body: {query, documents: [chunk.content × 10], top_k: 10}
   │   │  │  └─ Response: {ranked_documents: [{index, score}, ...]}
   │   │  │
   │   │  └─ rerankResults = response.ranked_documents
   │   │
   │   └─ CATCH (Qwen down):
   │      └─ Use Cohere API (rerank.ts)
   │
   ├─ Step 5: Select top chunks (from each PDF)
   │   ├─ For each rerank result (sorted by score):
   │   │  ├─ Get row = result.rows[index]
   │   │  ├─ source = row.metadata.source
   │   │  ├─ If source not selected yet:
   │   │  │  ├─ Add to selectedByPdf
   │   │  │  └─ Add index to selectedIndices
   │   │  │
   │   │  └─ If selectedIndices.size >= 10: break
   │   │
   │   └─ rankedRows = selected rows
   │
   ├─ Step 6: Format context
   │   ├─ contexts = rankedRows.map(r => ({
   │   │  id, file_id, source, chunk, page, excerpt
   │   │}))
   │   │
   │   └─ contextText = `Source: ...\n\n${excerpt}\n\n---\n\n...`
   │
   ├─ Step 7: Build prompt
   │   └─ prompt = `
   │      [Conversation history if exists]
   │      
   │      KAYNAKLAR:
   │      ${contextText}
   │      
   │      SORU: ${question}
   │      
   │      CEVAP:`
   │
   ├─ Step 8: LLM inference
   │   ├─ await llm.invoke(prompt)
   │   └─ llmResponse = {content: "Cevap metni..."}
   │
   ├─ Step 9: Save to sections
   │   ├─ If sectionId exists:
   │   │  ├─ GET messages from sections
   │   │  ├─ Append new message
   │   │  ├─ UPDATE sections SET messages
   │   │  └─ savedSectionId = sectionId
   │   │
   │   └─ Else:
   │      ├─ INSERT new section
   │      ├─ Return new sectionId
   │      └─ savedSectionId = newId
   │
   └─ Step 10: Return response
      └─ {
         success: true,
         answer: llmResponse.content,
         sectionId: savedSectionId,
         sources: contexts[]
      }
```

---

## 💾 DATABASE SCHEMA (DETAYLI)

### documents Tablosu

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  -- id: Otomatik artan (1, 2, 3, ...)
  -- Tipik: 1-1000 (chunk ID'si)
  
  file_id INTEGER NOT NULL,
  -- file_id: Hangi PDF'ten geldi
  -- Tipik: 1, 2, 5 (tüm chunks aynı file_id)
  -- Örnek: 5 chunks → file_id = 2 (hepsi 2 olur)
  
  user_id VARCHAR NOT NULL,
  -- user_id: Hangi kullanıcı
  -- Örnek: "demo-user"
  
  content TEXT NOT NULL,
  -- content: Metin (max 1000 char)
  -- Örnek: "Veri tabanı nedir? Bir veri tabanı..."
  
  metadata JSONB NOT NULL,
  -- metadata: Meta information
  -- {
  --   "source": "document.pdf",
  --   "page": 3,
  --   "type": "vlm" | "text" | "ocr",
  --   "contentType": "table" | "diagram" | "text",
  --   "confidence": 0.95,
  --   "has_images": true,
  --   "chunk": 15
  -- }
  
  embedding vector(1536) NOT NULL,
  -- embedding: Vector (1536 boyutlu, OpenAI)
  -- Örnek: [0.123, 0.456, 0.789, ...]
  
  created_at TIMESTAMP DEFAULT NOW(),
  -- created_at: Oluşturma zamanı
  
  -- INDEXES (Hızlı arama)
  -- IVFFLAT index on embedding
  -- B-tree index on user_id
  -- B-tree index on file_id
);
```

### sections Tablosu

```sql
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  -- id: Konuşma ID
  -- Örnek: 1, 2, 3, ...
  
  user_id VARCHAR NOT NULL,
  -- user_id: Hangi kullanıcı
  
  title VARCHAR,
  -- title: Konuşma başlığı
  -- Örnek: "💬 Konuşma - 27 Kasım 2025"
  
  messages JSONB NOT NULL,
  -- messages: Soru-cevap array
  -- [
  --   {
  --     "question": "Tablo 1 nedir?",
  --     "answer": "Tablo 1 şu bilgileri içerir...",
  --     "sources": [
  --       {
  --         "source": "document.pdf",
  --         "file_id": 5,
  --         "chunk": 15,
  --         "page": 3,
  --         "has_images": true
  --       }
  --     ]
  --   },
  --   {
  --     "question": "Kaynaklar neler?",
  --     "answer": "Kaynaklar şunlardır...",
  --     "sources": [...]
  --   }
  -- ]
  
  is_active BOOLEAN DEFAULT true,
  -- is_active: Konuşma aktif mi?
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 ÇIKIŞ (WHAT'S OUT)

**Hiçbir şey dışarı çıkmıyor!**

Sistem şu şeyleri depolama/işleme yaptığı:
- ✅ Vektörler: Database'te (pgvector)
- ✅ Chunks: Database'te (PostgreSQL)
- ✅ Konuşmalar: Database'te (sections)
- ✅ Kaynaklar: JSON response'ta
- ✅ Model weights: Memory'de (VLM/Reranker servers)

Dışarı çıkan: Sadece HTTP responses!

---

## 🏁 SONUÇ

**17 TypeScript + 2 Python = Eksiksiz RAG Sistemi**

En önemli dosyalar (sırasıyla):
1. upload/route.ts (veri girişi)
2. query/route.ts (sorgu işleme)
3. db.ts (database)
4. chain.ts (AI modeller)

Diğerleri destekleyici olarak çalışıyor.

✅ **Sistem Tamamlandı ve Prod-Ready!**

---

**Yazar:** Emirhan Yılmaz
**Tarih:** 27 Kasım 2025
**Versiyon:** 1.0 Final
**Status:** ✅ COMPLETE
