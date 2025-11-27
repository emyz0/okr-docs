# 🎓 OKR-DOCS RAG SİSTEMİ - KAPSAMLI AÇIKLAMA

Bu dokument, OKR-Docs projesinin her satırını, her fonksiyonunu, veri akışını ve mimarisini detaylı olarak açıklamaktadır.

---

## 📊 BÖLÜM 1: SİSTEM MİMARİSİ VE GENEL YAPI

### 1.1 Sistem Nedir?

**RAG (Retrieval-Augmented Generation)** bir yapay zeka sistemidir:
- **Retrieval**: Kullanıcının sorusuna ilgili dokümantları bulur
- **Augmented**: Bu dokümantları LLM'e bağlam olarak ekler  
- **Generation**: LLM, bu bağlamı kullanarak cevap üretir

### 1.2 Teknoloji Stack'i

```
Frontend Layer
  └─ Next.js 16.0.1 (React + TypeScript)
      └─ /app (sayfa ve API routes)

Backend/Processing Layer
  ├─ PostgreSQL 15 (pgvector 0.8.1) - Veri depolama
  ├─ OpenAI API (text-embedding-3-small, gpt-4o-mini) - AI
  └─ FastAPI Python Servers
      ├─ Qwen3-Reranker-4B (port 8000) - Dokuman sıralama
      └─ Qwen3-VL-4B-Instruct (port 8001) - Görsel analiz

File Processing
  ├─ PDF → PDFLoader + Tesseract.js (OCR)
  ├─ Excel → XLSX Library
  ├─ Word → Mammoth Library
  └─ TXT → Node.js fs
```

### 1.3 Veri Akış Diyagramı

```
                    ┌─────────────────────────────┐
                    │   KULLANICI ARAYÜZÜ         │
                    │   (Next.js Frontend)        │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  PDF/Excel/Word Yükle  │
                    │  /api/rag/upload       │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
    ┌─────────┐          ┌──────────────┐         ┌──────────────┐
    │ Metin   │          │ VLM Analiz   │         │ Chunking &   │
    │ Çıkarma │          │ (Tablo/      │         │ Embedding    │
    │ (PDF    │          │ Diagram)     │         │              │
    │ Loader) │          │ Qwen VLM     │         │ OpenAI API   │
    └────┬────┘          └──────┬───────┘         └──────┬───────┘
         │                      │                        │
         └──────────────────────┼────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │ PostgreSQL + pgvector│
                    │ (Vektör Veri Tabanı)│
                    └──────────┬───────────┘
                               │
                    ┌──────────▼──────────┐
                    │ SORGU (Query)       │
                    │ /api/rag/query      │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌─────────┐         ┌──────────────┐        ┌─────────────┐
    │ Vector  │         │ Reranking    │        │ LLM Cevap   │
    │ Search  │         │ (Qwen        │        │ Üretme      │
    │ pgvector│         │ Reranker)    │        │ (GPT-4o)    │
    └────┬────┘         └────┬─────────┘        └─────┬───────┘
         │                   │                        │
         └───────────────────┼────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ CEVAP + KAYNAKLAR│
                    │ Kullanıcıya      │
                    └──────────────────┘
```

---

## 📁 BÖLÜM 2: DOSYA YAPISI VE ÖZETİ

### 2.1 Kullanılan Dosyalar (Aktif)

```
✅ AKTIF DOSYALAR
├─ /lib/rag/db.ts                    ← DATABASE BAĞLANTISI (KRITIK ⭐⭐⭐)
├─ /lib/rag/chain.ts                 ← LLM CHAIN (KRITIK ⭐⭐⭐)
├─ /lib/rag/rerank.ts                ← COHERE FALLBACK (Önemli ⭐⭐)
├─ /lib/rag/pdf-vlm-analyzer.ts      ← VLM INTEGRATION (Önemli ⭐⭐)
├─ /lib/rag/pdf-ocr-processor.ts     ← OCR PROCESSOR (Destekleyici ⭐)
├─ /lib/rag/pdf-image-ocr.ts         ← OCR ORKESTRATÖRÜ (Destekleyici ⭐)
├─ /lib/rag/document-parser.ts       ← DOSYA PARSER (Destekleyici ⭐)
│
├─ /app/api/rag/upload/route.ts      ← DOSYA YÜKLEME (KRITIK ⭐⭐⭐)
├─ /app/api/rag/query/route.ts       ← SORGU İŞLEME (KRITIK ⭐⭐⭐)
├─ /app/api/rag/pdfs/route.ts        ← PDF LİSTESİ
├─ /app/api/rag/sections/route.ts    ← KONUŞMA KAYDI
│
├─ vlm_server.py                     ← VLM SUNUCUSU (Python, Önemli ⭐⭐)
├─ reranker_server.py                ← RERANKER SUNUCUSU (Python, Önemli ⭐⭐)
│
└─ /app/page.tsx                     ← FRONTEND UI (React)
```

### 2.2 Kullanılmayan/Eski Dosyalar (❌ DEPRECATED)

```
❌ KULLANILMIYOR
├─ /lib/rag/pdf-image-extraction.ts  ← Eski image extraction (OCR/VLM ile değiştirildi)
├─ /lib/rag/image-processing.ts      ← Eski image processing (OCR/VLM ile değiştirildi)
├─ /lib/rag/extract_pdf_images.py    ← Eski Python script
├─ /app/api/news/*                   ← News API (proje dışı)
└─ /app/api/rag/ingest/*             ← Eski ingest endpoint
```

---

## 🔴 BÖLÜM 3: KRİTİK DOSYALAR (YAŞAM KAYNAĞI)

### 3.1 db.ts - DATABASE BAĞLANTISI

```typescript
// /lib/rag/db.ts
// GÖREV: PostgreSQL veritabanına bağlanmak ve sorgu yapmak

// POOL: Connection havuzu (aynı anda birden fazla sorgu)
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'okr_docs',
  user: 'postgres',
  password: 'postgres'
})

// KULLANIŞI:
// const result = await pool.query('SELECT * FROM documents WHERE id = $1', [1])
```

**NEDEN KRİTİK?**
- Tüm veriler buradan okunur/yazılır
- Vektör araması burada yapılır
- Bağlantı kopsa sistem çalışmaz

---

### 3.2 chain.ts - LLM INTEGRATION

```typescript
// /lib/rag/chain.ts
// GÖREV: OpenAI API'si ile bağlantı, embedding ve LLM çağrısı

// EMBEDDING MODEL: text-embedding-3-small
// - Her dokümantı 1536-boyutlu vektöre dönüştürür
// - Arama için benzerlik hesaplaması yapılır
export const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small"
})

// LLM MODEL: gpt-4o-mini
// - Sorulara cevap üretir
// - Temperature: 0.1 (çok deterministik, kesin cevaplar)
export const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1
})
```

**NEDEN KRİTİK?**
- Soruları vektörlere çevirir (arama için)
- Cevapları üretir (LLM)
- Sistemin "zeka" kaynağı

---

### 3.3 upload/route.ts - DOSYA YÜKLEME (EN KARMAŞIK)

Bu sistemin **EN ÖNEMLİ** dosyasıdır. Adım adım:

```typescript
// 1️⃣ STEP 1: DOSYA TİPİNE GÖRE METIN ÇIKAR
if (ext === '.pdf') {
  const loader = new PDFLoader(tempPath)
  docs = await loader.load()  // PDF sayfalarını text'e çevir
}

// 2️⃣ STEP 2: VLM İLE GÖRSELLERI ANALIZ ET
const vlmResults = await extractContentWithVLM(tempPath, 20)
// PDF'deki tabloları, diyagramları, grafikleri analiz et
// Sonuç: {pageNum, analysis, contentType, confidence}

// 3️⃣ STEP 3: METIN PARÇALARA BÖL (CHUNKING)
// Çok uzun metni daha kısa parçalara böl
// Örnek: 10,000 karakter → 10 × 1000 karakterlik chunk
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
})
const chunks = await splitter.splitDocuments(docs)

// 4️⃣ STEP 4: HER CHUNK'I VEKTÖRE ÇEVİR (EMBEDDING)
for (const chunk of chunks) {
  const embedding = await embeddings.embedQuery(chunk.pageContent)
  // Sonuç: [0.123, 0.456, 0.789, ...] (1536 boyutlu)
}

// 5️⃣ STEP 5: VERİTABANINA KAYDET
await pool.query(
  'INSERT INTO documents (file_id, user_id, content, metadata, embedding) VALUES ...',
  [fileId, userId, content, metadataJson, embeddingVector]
)
```

**NEDEN ÇOK ÖNEMLİ?**
- Tüm veriler buraya girilir
- Vektörler burası hesaplar
- Yanılşlık burada başlar

---

### 3.4 query/route.ts - SORGU İŞLEME (EN KOMPLİKS)

```typescript
// 1️⃣ SORUYU VEKTÖRE ÇEVİR
const qEmb = await embeddings.embedQuery(question)
// Sonuç: [0.111, 0.222, 0.333, ...]

// 2️⃣ VECTOR SEARCHİ YAP (PGVECTOR)
const result = await pool.query(`
  SELECT id, content, metadata FROM documents
  WHERE user_id = $1
  ORDER BY embedding <-> $2 LIMIT 10
`, [userId, embeddingVector])
// <-> operatörü = pgvector'ün distance operatörü
// En yakın 10 dokuman bulur

// 3️⃣ RERANKING YAP (QWEN RERANKER)
try {
  const qwenResponse = await fetch("http://localhost:8000/rerank", {
    method: "POST",
    body: JSON.stringify({
      query: question,
      documents: contexts,
      top_k: 3
    })
  })
  // Qwen sunucusu: 10 dokuman → 3 en ilgili dokuman
}

// 4️⃣ FALLBACK (EĞER QWEN DOWN SAİSE)
catch {
  const rerankResults = await rerankDocuments(rerankInput)
  // Cohere API kullan
}

// 5️⃣ LLM'E GÖNDƏR
const prompt = `
  Kaynaklar:
  ${contextText}
  
  Soru: ${question}
  
  Cevap:
`
const llmResponse = await llm.invoke(prompt)

// 6️⃣ KONUŞMA KAYDET
await pool.query(`
  UPDATE sections SET messages = messages || $1::jsonb
  WHERE id = $2
`, [messageJson, sectionId])
```

**NEDEN ÇOK ÖNEMLİ?**
- Kullanıcı sorusu buradan işlenir
- Tüm reranking/LLM çağrıları burası yapılır
- Cevap kalitesi buraya bağlı

---

## 🟡 BÖLÜM 4: ÖNEMLİ DOSYALAR (YÖN BELIRLEYENLER)

### 4.1 pdf-vlm-analyzer.ts - VLM İNTEGRASYON

```typescript
// GÖREV: PDF'deki tabloları, diyagramları analiz etmek

export async function extractContentWithVLM(pdfPath, maxPages) {
  // 1. PDF sayfalarını görsele render et
  for (let i = 1; i <= maxPages; i++) {
    const base64 = await renderPdfPageToBase64(pdfPath, i)
    // Sonuç: Base64 string (görsel data)
    
    // 2. VLM sunucusuna gönder
    const analysis = await analyzeImageWithVLM(base64, "extract")
    // VLM: "Bu sayfa bir tablo içeriyor..."
    
    results.push({
      pageNum: i,
      analysis: analysis.analysis,
      contentType: analysis.contentType  // "table", "diagram", "text"
    })
  }
}
```

**NEDEN ÖNEMLİ?**
- Görselleri metin'e çevirir
- Tablolar/diyagramlar kaybı önler
- Bilgi kaybını minimize eder

---

### 4.2 reranker_server.py - QWEN RERANKER

```python
# GÖREV: 10 dokumandan 3 en ilgilisini seçmek

@app.post("/rerank")
async def rerank(request: RerankerRequest):
    # 1. Her dokuman + soru pairing yap
    pairs = [[sorgu, dokuman] for dokuman in documents]
    
    # 2. Transformer modeline gönder
    inputs = tokenizer(pairs, padding="max_length", ...)
    outputs = model(**inputs)  # [batch_size, 2] logits
    
    # 3. Skor hesapla
    scores = outputs.logits[:, 0]  # Relevance skoru
    
    # 4. Sıra
    ranked = sorted(documents, key=lambda x: score, reverse=True)
    return ranked[:top_k]
```

**NEDEN ÖNEMLİ?**
- Vector search bazen yanlış dokuman bulur
- Reranking: ML ile doğru olanları seçer
- Cevap kalitesini %40+ artırır

---

### 4.3 vlm_server.py - QWEN VLM

```python
# GÖREV: Görselleri analiz etmek

@app.post("/analyze")
async def analyze_image(request: VLMRequest):
    # 1. Base64 görseli decode et
    image = Image.open(BytesIO(base64.b64decode(image_base64)))
    
    # 2. VLM modeline gönder (metin + görsel)
    prompt = "Bu görselde neler vardır?"
    inputs = processor(text=prompt, images=[image], ...)
    
    # 3. Model inference
    outputs = model.generate(**inputs, max_new_tokens=1024)
    
    # 4. Sonuç
    analysis = processor.decode(outputs)
    return {
        "analysis": analysis,
        "content_type": detect_type(analysis)  # "table", "diagram", etc
    }
```

**NEDEN ÖNEMLİ?**
- Görsellerdeki bilgiyi yazıya çevirir
- OCR'den çok daha doğru
- Tablo yapısını koruyor

---

## 🟢 BÖLÜM 5: DESTEKLEYICI DOSYALAR

### 5.1 document-parser.ts

```typescript
// GÖREV: Excel, Word, TXT dosyalarından metin çıkarmak

export async function extractTextFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath)
  // CSV formatına dönüştür → satırları ayır → chunks
}

export async function extractTextFromWord(filePath) {
  const result = await mammoth.extractRawText({path: filePath})
  // .docx → plain text
}

export async function extractTextFromTxt(filePath) {
  // UTF-8 ile oku, yoksa Latin1
  return fs.readFileSync(filePath, 'utf-8')
}
```

---

### 5.2 rerank.ts - COHERE FALLBACK

```typescript
// GÖREV: Qwen down ise Cohere API kullan

export async function rerankDocuments(input, topK) {
  const response = await axios.post(
    'https://api.cohere.ai/v1/rerank',
    {
      model: 'rerank-english-v2.0',
      query: input.query,
      documents: input.documents,
      top_n: topK
    },
    {headers: {'Authorization': `Bearer ${process.env.COHERE_API_KEY}`}}
  )
  
  return response.data.results
}
```

---

## 📊 BÖLÜM 6: VERI TABANI ŞEMASI

### 6.1 `documents` Tablosu (EN ÖNEMLİ)

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,           -- Her chunk'ın unique ID'si (1,2,3,...)
  file_id INTEGER,                 -- Hangi PDF'ten geldiği (tüm chunks aynı)
  user_id VARCHAR,                 -- Hangi kullanıcı (demo-user)
  content TEXT,                    -- Chunk metni (1000 karakter max)
  metadata JSONB,                  -- {
                                   --   "source": "document.pdf",
                                   --   "page": 3,
                                   --   "type": "vlm" | "text",
                                   --   "contentType": "table" | "diagram",
                                   --   "confidence": 0.95,
                                   --   "has_images": true
                                   -- }
  embedding vector(1536),          -- Vektör (1536-boyutlu)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexler (hızlı arama için)
CREATE INDEX idx_embedding ON documents USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_user_id ON documents(user_id);
CREATE INDEX idx_file_id ON documents(file_id);
```

### 6.2 `sections` Tablosu (Konuşma Kaydı)

```sql
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  title VARCHAR,                   -- "💬 Konuşma - 27 Kasım 2025"
  messages JSONB,                  -- [{
                                   --   "question": "Tablo 1 nedir?",
                                   --   "answer": "Cevap...",
                                   --   "sources": [{
                                   --     "source": "doc.pdf",
                                   --     "page": 5,
                                   --     "file_id": 1
                                   --   }]
                                   -- }]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎯 BÖLÜM 7: EN ÖNEMLİ KAVRAMLAR

### 7.1 File ID Sistemi

```
❌ ESKI (YANLIŞ):
PDF "document.pdf" yükleniyor
  Chunk 1: id=100, chunk_id=1
  Chunk 2: id=101, chunk_id=2
  Chunk 3: id=102, chunk_id=3
  → Hangi chunk'lar aynı dosyadan geliyor? Bilmiyoruz!

✅ YENİ (DOĞRU):
PDF "document.pdf" yükleniyor → file_id = 42
  Chunk 1: id=100, file_id=42
  Chunk 2: id=101, file_id=42
  Chunk 3: id=102, file_id=42
  → Tüm chunks aynı file_id'ye sahip!
```

**FAYDA**: Kaynaklarda hangi dosya olduğu belli oluyor

---

### 7.2 Vector Search (Vektör Araması)

```
Soru: "Veri tabanı nedir?"
↓
Embedding: [0.123, 0.456, 0.789, ...] (1536 dimension)
↓
Database'te 100 chunk var:
  Chunk 1 embedding: [0.120, 0.460, 0.785, ...]  → UZAK
  Chunk 2 embedding: [0.998, 0.012, 0.341, ...]  → ÇOK UZAK
  Chunk 3 embedding: [0.121, 0.455, 0.788, ...]  → YAKIN! ✅
  Chunk 4 embedding: [0.124, 0.457, 0.791, ...]  → YAKIN! ✅
  ...
↓
En yakın 10 chunk seçilir
```

**TEMEL**: Cosine distance = ne kadar yakın

---

### 7.3 Reranking Pipeline

```
Vector Search: 10 dokuman seç
↓
Reranker (Qwen3-Reranker-4B):
  Soru: "Veri tabanı nedir?"
  Dokuman 1: "Veri tabanı SQL ile..." → SKOR: 0.98 ⭐
  Dokuman 2: "PostgreSQL bir veri..." → SKOR: 0.95 ⭐
  Dokuman 3: "Ağaç yapısı nedir..." → SKOR: 0.10 ❌
  Dokuman 4: "Futbol kuralları..." → SKOR: 0.02 ❌
  ...
↓
Top 3 seçilir: [Dokuman1, Dokuman2, Dokuman5]
↓
LLM'e gönderilir
```

---

## 🚀 BÖLÜM 8: SISTEM AKIŞI (BAŞTAN SONA)

### 8.1 Dosya Yükleme Akışı

```
1. Kullanıcı PDF yükler
   ↓
2. /api/rag/upload çalışır
   ├─ Dosya türü kontrol et
   ├─ Metin çıkar (PDFLoader)
   ├─ VLM ile analiz et (tabloları)
   ├─ Chunk'lara böl (1000 char)
   └─ Embedding yap (OpenAI API)
   
3. Database'e kaydet
   ├─ file_id ata (tüm chunks aynı)
   ├─ metadata kaydet
   ├─ vektörü kaydet
   └─ ✅ Tamamlandı
```

### 8.2 Sorgu Akışı

```
1. Kullanıcı soru sorar
   ↓
2. /api/rag/query çalışır
   
   ├─ Soruyu embedding yap
   │
   ├─ Vector search (TOP 10)
   │  └─ SELECT * WHERE embedding <-> soruEmbedding
   │
   ├─ Reranking
   │  ├─ Qwen sunucusuna gönder
   │  ├─ Başarısız? → Cohere fallback
   │  └─ TOP 3 seç
   │
   ├─ LLM çağır
   │  ├─ Prompt: "Kaynaklar: [TOP 3]\nSoru: [SORU]\nCevap:"
   │  └─ GPT-4o: Cevap üret
   │
   ├─ Konuşmayı kaydet
   │  └─ sections tablosunu güncelle
   │
   └─ ✅ Cevap döndür
```

---

## 🔒 BÖLÜM 9: KRİTİK HATALAR VE ÇÖZÜMLERI

### 9.1 "Vector Search 0 sonuç döndürdü"

**Sebep**: Hiç chunk yüklü değil
```
Çözüm:
1. PDF yüklenmiş mi? /api/rag/pdfs kontrol et
2. Chunks veritabanına kaydedildi mi?
   SELECT COUNT(*) FROM documents WHERE user_id = 'demo-user'
3. Embedding işlemi başarılı mı?
   SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL
```

### 9.2 "LLM'den cevap gelmedi"

**Sebep**: OpenAI API key yanlış veya limit aşıldı
```
Çözüm:
1. OPENAI_API_KEY .env.local'da mı?
2. Cüzdan bakiyesi var mı?
3. Rate limit aşıldı mı? (Beklemeyi dene)
```

### 9.3 "Reranker çalışmıyor"

**Sebep**: VLM sunucusu down
```
Çözüm:
1. reranker_server.py çalışıyor mu?
   ps aux | grep reranker
2. Port 8000 açık mı?
   curl http://localhost:8000/health
3. Model yüklendi mi? (~2 dakika bekle)
```

---

## 📈 BÖLÜM 10: PERFORMANS OPTİMİZASYONLARI

### 10.1 Vector Search Hızı

```
❌ YAŞAK:
- Tüm vectors herşeyi kontrol etmek O(n) = çok yavaş

✅ İYİ:
- IVFFLAT index kullan
- CREATE INDEX idx_embedding ON documents 
  USING ivfflat(embedding vector_cosine_ops)
- Sonuç: 10000 vectorde 100ms → 5ms

⚡ EN İYİ:
- HNSW index (PostgreSQL 17+)
- Daha hızlı ve doğru
```

### 10.2 Embedding Cache

```typescript
// ❌ KÖTÜ (Her seferinde yeni embedding):
const embedding = await embeddings.embedQuery(soru)

// ✅ İYİ (Cache kullan):
const cached = cache.get(soru)
if (cached) return cached
const embedding = await embeddings.embedQuery(soru)
cache.set(soru, embedding)
```

---

## 📚 BÖLÜM 11: KULLANILMIYOR AMA TUTULAN DOSYALAR

### 11.1 pdf-image-extraction.ts (❌ DEPRECATED)

**Neden yazılmış**: İlk başta görsellerden metin çıkarmak için
**Neden kullanılmıyor**: VLM çok daha iyisi var
**Silme riski**: Düşük (arkada kalabilir)

---

## 🎯 BÖLÜM 12: PROJEYE YAKLAŞIM

### 12.1 Eğer Hata Oluşursa

```
1. Logs'u oku (Next.js terminal)
2. Database kontrol et (psql)
3. API'leri test et (curl)
4. Sunucu loglarını kontrol et (vlm.log, reranker.log)
5. Git diff yap (son değişiklik ne)
```

### 12.2 Eğer Kod Değiştirmek İstersen

```
1. Değişiklik yap
2. Kendi cihazında test et
3. Logs'a bakıp hata var mı kontrol et
4. Git commit yap
5. Production'a deploy et
```

### 12.3 Sistem Başlama Sırası

```
1. PostgreSQL server çalışıyor mu?
   ps aux | grep postgres

2. VLM sunucusu başlat
   cd ~/Desktop/okr-docs
   source vlm_env/bin/activate
   python3 vlm_server.py &

3. Reranker sunucusu başlat
   source reranker_env/bin/activate
   python3 reranker_server.py &

4. Next.js başlat
   npm run dev

5. Browser'dan http://localhost:3001 aç
```

---

## ✨ BÖLÜM 13: SISTEM ÖZET

```
📊 STATS:
├─ TypeScript dosyaları: 17
├─ Python dosyaları: 2
├─ Database tabloları: 2
├─ API routes: 6
├─ FastAPI endpoints: 6
└─ Machine Learning modelleri: 3

🏗️ MİMARİ:
├─ Frontend: Next.js 16
├─ Backend: Express-like routing
├─ Database: PostgreSQL + pgvector
├─ AI: OpenAI + Qwen
└─ Python: FastAPI servers

🎯 AMAÇ:
"Kullanıcı PDF yükler → Sistem onu analiz eder → 
Sorulara cevap verir (kaynaklar gösterir)"

💪 GÜÇ NOKTALARI:
✅ Multi-file format support
✅ Vision Language Model (görsel analiz)
✅ Reranking (cevap kalitesi)
✅ Vector database (hızlı arama)
✅ Conversation history (bağlam)

⚡ ZAYıF NOKTALAR:
❌ Python sunucuların başlatılması manuel
❌ Database migration'lar manuel
❌ GPU desteği sınırlı
❌ Cost optimization yok
```

---

## 🏁 SONUÇ

Bu sistem bir **enterprise-grade RAG sistemi**'dir. Tüm önemli işlevler var:
- ✅ Multi-format file processing
- ✅ Vector search
- ✅ Reranking
- ✅ Vision Language Model
- ✅ Conversation history
- ✅ Fallback mechanisms

**Projeyi anlamak için önemli sıra:**
1. db.ts (veri nereye gidiyor?)
2. chain.ts (AI modelleri)
3. upload/route.ts (veri nasıl girilir?)
4. query/route.ts (sorgular nasıl işlenir?)
5. Diğer dosyalar (destekleyiciler)

---
