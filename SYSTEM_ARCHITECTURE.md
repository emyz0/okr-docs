# 🏗️ OKR-DOCS SİSTEM MİMARİSİ (Aralık 2025)

## 📊 Sistem Genel Bakış

```
┌─────────────────────────────────────────────────────────────────┐
│                     KULLANICI (Browser)                         │
│                    http://localhost:3000                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
      ┌───────────────┼───────────────┐
      │               │               │
  ┌───▼────┐    ┌────▼────┐    ┌───▼────┐
  │ Upload │    │  Query  │    │ Search │
  │ (PDF)  │    │(Q&A)    │    │ Sections
  └───┬────┘    └────┬────┘    └───┬────┘
      │              │             │
      │              │    ┌────────┴─────────────┐
      └──────────────┼────┤                      │
                     │    │                      │
         ┌───────────▼────▼──────────┐          │
         │    Next.js App Router    │          │
         │   (port 3000, Turbopack) │          │
         └───┬───────────────┬───────┘          │
             │               │                   │
      ┌──────▼──┐    ┌───────▼────────┐        │
      │ Upload  │    │ Query Route    │        │
      │ Route   │    │ (/api/rag/     │        │
      │ (/api   │    │  query)        │        │
      │ /rag/   │    │                │        │
      │upload)  │    │Calls:          │        │
      │         │    │- Vector Search│        │
      │Calls:   │    │- Reranker    │        │
      │- PDF    │    │- VLM (gör.)  │        │
      │Parser   │    │- LLM (GPT)   │        │
      │- VLM    │    └────────┬──────┘        │
      │(page    │             │                 │
      │analy)   │        ┌────▼───────┐       │
      │- Embed  │        │PostgreSQL   │       │
      │(Open    │        │+ pgvector   │       │
      │AI)      │        │(Vectors)    │       │
      │- DB     │        └─────────────┘       │
      │Insert   │                              │
      └───┬─────┘                              │
          │                                    │
    ┌─────▼─────────────────────────┐          │
    │    PostgreSQL Database        │          │
    │  (/var/lib/postgresql/15)    │          │
    │                               │          │
    │ Tables:                       │          │
    │ - documents (chunks+embed)    │          │
    │ - sections (conversation)     │          │
    │ - users (future)              │          │
    └───────────────────────────────┘          │
                                               │
    ┌──────────────────────────────────────────┴──┐
    │                                             │
    │  ┌─────────────────────┐   ┌────────────┐  │
    │  │  VLM Server (8001)  │   │ Reranker   │  │
    │  │                     │   │ (8000)     │  │
    │  │ Qwen2.5-VL-7B       │   │            │  │
    │  │ (lokal, CPU)        │   │ Qwen3      │  │
    │  │                     │   │ Reranker   │  │
    │  │ Tasks:              │   │ 4B (CPU)   │  │
    │  │ - /analyze: Tablo/  │   │            │  │
    │  │   Grafik çıkarma    │   │ /rerank:   │  │
    │  │ - /health: Status   │   │ Chunks     │  │
    │  │                     │   │ sıralama   │  │
    │  └─────────────────────┘   └────────────┘  │
    │                                             │
    │  ┌──────────────────────────────────────┐  │
    │  │  LLM: OpenAI GPT-4o-mini             │  │
    │  │  (Remote API, api_key via .env)      │  │
    │  │  - Final answer generation           │  │
    │  │  - Temperature: 0.1 (deterministic)  │  │
    │  └──────────────────────────────────────┘  │
    │                                             │
    │  ┌──────────────────────────────────────┐  │
    │  │  Embedding: OpenAI text-embedding    │  │
    │  │  3-small (1536 dims)                 │  │
    │  │  - Chunk vector encoding             │  │
    │  └──────────────────────────────────────┘  │
    └─────────────────────────────────────────────┘
```

---

## 🔌 Portlar & Servisleri

| Port | Servis | Model | Status | Amaç |
|------|--------|-------|--------|------|
| **3000** | Next.js | - | ✅ Aktif | Frontend + RAG API Routes |
| **8000** | Reranker | Qwen3-Reranker-4B | ⏳ Yükleniyor | Chunk sıralama |
| **8001** | VLM | Qwen2.5-VL-7B | ✅ Çalışıyor | Tablo/Grafik analizi |
| **5432** | PostgreSQL | - | ✅ Çalışıyor | Vector DB + Konuşma |

---

## 📁 Kritik Dosyalar & Görevleri

### Frontend & API Routes (TypeScript)

#### 1️⃣ **`app/page.tsx`** - Ana UI
- **Amaç:** Soru-cevap arayüzü, PDF seçimi, konuşma geçmişi
- **Önemli State:**
  - `selectedPdfs`: Hangi PDF'lerden ara yapılacak
  - `pdfSearchQuery`: PDF listesinde filtreleme (YENİ!)
  - `sections`: Eski sohbetler
  - `question`: Kullanıcı sorusu
  - `answer`: LLM cevabı
- **Düğmeler:**
  - "📂 Dosyaları Yükle" → POST /api/rag/upload
  - "❓ Soru Sor" → POST /api/rag/query

#### 2️⃣ **`app/api/rag/upload/route.ts`** - Dosya Yükleme
- **Input:** PDF/Excel/Word/TXT dosyaları (multipart/form-data)
- **Adım Adım:**
  1. Dosya türü kontrol et (ext = .pdf, .xlsx, .docx, .txt)
  2. Geçici dosya oluştur (`/tmp/`)
  3. **PDF:** `PDFLoader` → sayfaları metne çevir
  4. **Excel:** `xlsx` kütüp. → satırları ayır
  5. **Word:** `mammoth` → metni çıkar
  6. **TXT:** `fs.readFileSync` → direkt oku
  7. **VLM Analizi (Devre Dışı Geçici):** Tablo/grafik çıkarma
  8. **Chunk'la:** `RecursiveCharacterTextSplitter` (1000 char, 200 overlap)
  9. **Embed:** OpenAI `text-embedding-3-small` → 1536 dims
  10. **DB Insert:** `documents` tablosuna kaydet
- **Çıktı:** `{ success: true, message: "✅ 250/250 chunk kaydedildi" }`
- **Kritik Noktalar:**
  - DOMMatrix polyfill (Node.js ortamında pdfjs-dist için)
  - Per-file chunk numbering (her dosya chunk 1'den başlar)
  - `file_id` maping (aynı dosyanın tüm chunks'ı aynı file_id'ye sahip)

#### 3️⃣ **`app/api/rag/query/route.ts`** - Sorgu & Cevap
- **Input:** `{ question, userId, selectedPdfs[], conversationHistory[] }`
- **Adım Adım:**
  1. Soruyu embed et: OpenAI embedding
  2. **Vector Search:** PostgreSQL pgvector `<->` (cosine distance)
     - TOP 10 benzer chunk'ı al
     - Terminal log: "📊 TOP 5 VECTOR MATCH (RERANKING ÖNCESİ)"
  3. **Reranking:** Qwen3-Reranker-4B (port 8000)
     - 120 saniye timeout
     - Başarılı: "✅ Qwen reranker başarılı: 10 ranked dokuman"
     - Timeout: Fallback vector similarity skorları
     - Terminal log: "🏆 TOP 5 RERANKED (QWEN SKORU İLE)"
  4. **VLM Analysis (Optional):** Sayfada tablo varsa çıkarma
  5. **Context Assembly:** Top 5 chunk'ı birleştir (2000 char limit)
  6. **LLM Call:** OpenAI GPT-4o-mini
     - Prompt: Konuşma geçmişi + kaynaklar + soru
     - Temp: 0.1 (deterministic)
  7. **Section Kayıt:** Soru-cevab DB'ye kaydet
- **Çıktı:** `{ success: true, answer: "...", sources: [{id, file_id, source, chunk, ...}], sectionId }`
- **Kritik Noktalar:**
  - Timeout 120s (Reranker CPU'da yavaş)
  - Fallback: Reranker down → vector similarity scores (0.95, 0.90, 0.85...)
  - TOP 5 seçme: Her PDF'den max 1 (çeşitlilik için)

---

### Python Sunucuları

#### 4️⃣ **`vlm_transformers_server.py`** - Görsel Analiz (Port 8001)
- **Model:** Qwen2.5-VL-7B-Instruct (lokal, 7B params, ~16GB)
- **Device:** CPU (Mac M4 destekli; Metal/PyTorch olabilir)
- **Endpoints:**
  - `POST /analyze`: Base64 görsel + task → analiz
    - Tasks: `extract`, `describe`, `table`, `diagram`
  - `GET /health`: Model durumu
- **Kullanım Yerler:**
  - Upload'ta: Her PDF sayfası için tablo/grafik çıkarma
  - (Şu an: Devre dışı — DOMMatrix hatası)
- **Status:** ✅ Sağlıklı, model_loaded=true

#### 5️⃣ **`reranker_server.py`** - Chunk Sıralama (Port 8000)
- **Model:** Qwen3-Reranker-4B (lokal, 4B params, ~8GB)
- **Device:** CPU (M4, yavaş → timeout 120s)
- **Endpoint:**
  - `POST /rerank`: `{ query, documents[], top_k }` → ranked docs
  - `GET /health`: Model durumu
- **Batch Processing:** batch_size=4 (CPU optimize)
- **Kullanım:** Query rotasında chunk sıralama
- **Status:** ⏳ Model yükleniyor... (ilk kez ~2-3 dakika)

---

## 📊 Veri Akışı

### Upload Flow
```
User File Selection
    ↓
/api/rag/upload
    ├─ Parse dosya
    ├─ TypeCheck (PDF/Excel/Word/TXT)
    ├─ PDFLoader / XLSX / Mammoth / fs.read
    ├─ [Devre Dışı] VLM: Tablo çıkarma
    ├─ RecursiveCharacterTextSplitter
    │  └─ 1000 char chunks, 200 overlap
    ├─ OpenAI Embedding
    │  └─ 1536 dims (text-embedding-3-small)
    ├─ PostgreSQL Insert
    │  └─ documents table
    │     ├─ user_id
    │     ├─ content (chunk metin)
    │     ├─ metadata (JSONB: source, page, chunk#, file_id)
    │     └─ embedding (pgvector)
    └─ Response: { success, message }
```

### Query Flow
```
User Question
    ↓
/api/rag/query
    ├─ Embed soru (OpenAI)
    ├─ Vector Search (pgvector <->)
    │  └─ TOP 10 chunks
    │  └─ Terminal: "📊 TOP 5 VECTOR MATCH..."
    │
    ├─ Reranking (Qwen3, port 8000)
    │  ├─ Success → "✅ Qwen reranker başarılı"
    │  │  └─ Terminal: "🏆 TOP 5 RERANKED (QWEN SKORU)..."
    │  └─ Timeout/Error → Fallback vector scores
    │     └─ Terminal: "⚠️ Qwen reranker kullanılamadı..."
    │
    ├─ [Optional] VLM Analysis
    │  └─ Tablo varsa çıkarma
    │
    ├─ Context Assembly (TOP 5, 2000 char limit)
    ├─ Conversation History concat
    ├─ LLM Call (OpenAI GPT-4o-mini)
    │  └─ Prompt: History + Context + Question
    │
    ├─ Section Kayıt (DB)
    └─ Response: { success, answer, sources[], sectionId }
```

---

## 🗄️ PostgreSQL Schema

### `documents` Table
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  content TEXT,                    -- Chunk metin
  metadata JSONB,                  -- {source, file_type, page, chunk, lineNumber, has_images}
  embedding vector(1536),          -- OpenAI 1536-dim
  file_id INTEGER,                 -- Hangi dosya grubu (aynı PDF'in chunks'ları)
  created_at TIMESTAMP DEFAULT NOW()
);

-- pgvector indeksi
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

### `sections` Table
```sql
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  title VARCHAR(500),
  messages JSONB,                  -- [{question, answer, sources[]}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Environment Variables (.env.local)

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/okr_docs

# HuggingFace (isteğe bağlı - VLM cache için)
HUGGINGFACE_API_KEY=hf_...

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 🎯 Deployment Checklist

- [ ] PostgreSQL 15+ kurulu ve çalışıyor (port 5432)
- [ ] `vlm_transformers_server.py` çalışıyor (port 8001)
  - `source vlm_env/bin/activate && python vlm_transformers_server.py`
- [ ] `reranker_server.py` çalışıyor (port 8000)
  - `source reranker_env/bin/activate && python reranker_server.py`
- [ ] `.env.local` OpenAI API key'i içeriyor
- [ ] Next.js başlatıldı (port 3000)
  - `npm run dev`
- [ ] Health checks geçti:
  - `curl http://localhost:8001/health` → model_loaded=true
  - `curl http://localhost:8000/health` → model_loaded=true
  - `curl http://localhost:3000` → HTML dönüyor

---

## 📈 Performance Notes

| İşlem | Süre | Device |
|-------|------|--------|
| PDF upload (100 sayfa) | ~30s | Next.js |
| Vector search (10 chunks) | <100ms | PostgreSQL |
| Reranking (10 chunks) | 30-60s | Qwen3, CPU |
| LLM call (GPT-4o-mini) | 5-10s | OpenAI API |
| **Total Query** | **40-80s** | Depends on Reranker |

---

## ⚠️ Bilinen Sorunlar & Geçici Çözümler

1. **Reranker Timeout (120s)**
   - Neden: Qwen3-4B CPU'da çok yavaş
   - Geçici: Timeout 120s, fallback vector scores
   - Kalıcı: GPU veya daha küçük model (Qwen2-1B)

2. **VLM DOMMatrix Hatası**
   - Neden: pdfjs-dist Node.js ortamında DOMMatrix gerektiriyor
   - Geçici: DOMMatrix polyfill eklendi (`upload/route.ts` top'da)
   - VLM çalışması hala devre dışı (hazır değil)

3. **Model Loading İlk Kez**
   - Neden: HF cache'den indirilme
   - Etki: İlk çalıştırmada 2-3 dakika
   - Çözüm: Sabır; sonraki çalıştırmalarda anında

---

## 🚀 Sonraki Adımlar

1. ✅ VLM DOMMatrix polyfill etkinleştir
2. ⏳ Reranker M4 GPU (Metal/PyTorch) optimi
3. 📊 Query telemetry & monitoring
4. 🔄 Batch upload progress tracking
5. 👥 Multi-user support (şu an: demo-user)

