# 📖 OKR-DOCS PROJE ÖZET VE HIZLI REFERANS

## 🎯 Proje Nedir?

RAG (Retrieval-Augmented Generation) sistemi: Kullanıcı PDF yükler → AI analiz eder → Sorulara cevap verir

---

## 📊 DOSYALAR ÖZET TABLOSU

| Dosya | Tür | Görev | Kritikallik | Durum |
|-------|-----|-------|-------------|-------|
| **db.ts** | TypeScript | Database bağlantı | ⭐⭐⭐ | ✅ Aktif |
| **chain.ts** | TypeScript | LLM + Embedding | ⭐⭐⭐ | ✅ Aktif |
| **upload/route.ts** | TypeScript | Dosya yükleme | ⭐⭐⭐ | ✅ Aktif |
| **query/route.ts** | TypeScript | Sorgu işleme | ⭐⭐⭐ | ✅ Aktif |
| **pdf-vlm-analyzer.ts** | TypeScript | VLM integration | ⭐⭐ | ✅ Aktif |
| **reranker_server.py** | Python | Qwen reranker | ⭐⭐ | ✅ Aktif (port 8000) |
| **vlm_server.py** | Python | Qwen VLM | ⭐⭐ | ✅ Aktif (port 8001) |
| **rerank.ts** | TypeScript | Cohere fallback | ⭐⭐ | ✅ Fallback |
| **document-parser.ts** | TypeScript | File parsing | ⭐ | ✅ Aktif |
| **pdf-image-extraction.ts** | TypeScript | - | - | ❌ DEPRECATED |
| **image-processing.ts** | TypeScript | - | - | ❌ DEPRECATED |

---

## 🔥 EN KRİTİK 3 DOSYA

### 1. upload/route.ts (Veri Girişi)
```
Görev: Kullanıcı PDF yükler → Sistem işler
Adımlar:
  1. Dosya türü kontrol
  2. Metin çıkar
  3. VLM analiz (tabloları)
  4. Chunking (1000 char)
  5. Embedding (OpenAI)
  6. Database kayıt
  
Başarısız olursa: Sistem veri kaybı
```

### 2. query/route.ts (Sorgu İşleme)
```
Görev: Soru sor → Cevap al
Adımlar:
  1. Soru embedding
  2. Vector search
  3. Reranking (Qwen/Cohere)
  4. LLM cevap
  5. Konuşma kaydet
  
Başarısız olursa: Yanlış cevaplar
```

### 3. db.ts (Veri Depolama)
```
Görev: PostgreSQL bağlantı
Önemli: Bağlantı kopsa TÜMS SİSTEM DOWN
```

---

## 📈 VERI AKIŞI (10 ADIM)

```
1. PDF Yükle
   ↓
2. Metin Çıkar (PDFLoader)
   ↓
3. VLM Analiz (Tablo/Diagram)
   ↓
4. Metin Parçala (Chunking)
   ↓
5. Embedding (OpenAI API)
   ↓
6. Database Kayıt (PostgreSQL)
   ↓
7. Soru Sor
   ↓
8. Soru Embedding
   ↓
9. Vector Search
   ↓
10. Reranking → LLM → Cevap
```

---

## 💾 DATABASE ŞEMASI

```sql
-- documents: Her PDF chunk'ı
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,          -- Unique chunk ID (1,2,3,...)
  file_id INTEGER,                -- PDF'nin unique ID (tüm chunks aynı)
  user_id VARCHAR,                -- Kullanıcı
  content TEXT,                   -- Metin (1000 char)
  metadata JSONB,                 -- Meta info
  embedding vector(1536),         -- Vektör (arama için)
  created_at TIMESTAMP
);

-- sections: Konuşma kaydı
CREATE TABLE sections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR,
  title VARCHAR,
  messages JSONB,                 -- [{question, answer, sources}]
  is_active BOOLEAN
);
```

---

## 🐍 PYTHON SUNUCULARI

### vlm_server.py (PORT 8001)
- Model: Qwen/Qwen3-VL-4B-Instruct
- Görev: Görselleri analiz et (tablo/diagram)
- Endpoint: POST /analyze
- Start: `python3 vlm_server.py`

### reranker_server.py (PORT 8000)
- Model: Qwen/Qwen3-Reranker-4B
- Görev: 10 dokuman → 3 en ilgili
- Endpoint: POST /rerank
- Start: `python3 reranker_server.py`

---

## 🎯 SISTEM BAŞLATMA SIRASI

```bash
# 1. PostgreSQL (arka planda olmalı)
brew services start postgresql

# 2. VLM Sunucusu
cd ~/Desktop/okr-docs
source vlm_env/bin/activate
python3 vlm_server.py &

# 3. Reranker Sunucusu
source reranker_env/bin/activate
python3 reranker_server.py &

# 4. Next.js
npm run dev

# 5. Tarayıcı
open http://localhost:3001
```

---

## ⚠️ SIK HATALAR

| Hata | Sebep | Çözüm |
|------|-------|-------|
| "Connection refused: localhost:5433" | PostgreSQL down | `brew services start postgresql` |
| "VLM Model yüklenmedi" | Sunucu başlamadı | Logs'u kontrol et: `tail vlm.log` |
| "0 sonuç döndürüldü" | Hiç chunk yok | PDF yükle, chunking kontrol et |
| "LLM API hatası" | OpenAI key yanlış | `.env.local` kontrol et |
| "embedding <-> not found" | pgvector yok | `CREATE EXTENSION vector;` |

---

## 🔑 ÖNEMLI KAVRAMLAR

### File ID Sistemi
- Her PDF'ye unique ID (1, 2, 3...)
- Tüm chunks aynı file_id'ye sahip
- Kaynaklarda hangi PDF olduğu belli olur

### Vector Search
- Soru: "Veri tabanı nedir?"
- OpenAI embedding: [0.123, 0.456, ...]
- Database: Cosine distance ile en yakın 10 chunk
- Sonuç: İlgili 10 dokuman

### Reranking
- 10 dokuman + soru
- Qwen modeli: Her dokuman için relevance skoru
- Sonuç: En ilgili 3 dokuman

### Chunking
- Uzun metni parçalara böl
- Chunk size: 1000 karakter
- Overlap: 200 karakter (bağlam korunur)

---

## 📊 İSTATİSTİKLER

```
Kod Satırı: ~5000+ lines
TypeScript Dosyaları: 17
Python Dosyaları: 2
Database Tabloları: 2
API Endpoints: 6 (TypeScript) + 6 (Python)

Modeller:
- OpenAI text-embedding-3-small (embedding)
- OpenAI gpt-4o-mini (LLM)
- Qwen/Qwen3-VL-4B-Instruct (VLM)
- Qwen/Qwen3-Reranker-4B (reranker)

Port'lar:
- 3001: Next.js
- 5433: PostgreSQL
- 8000: Reranker
- 8001: VLM
```

---

## 🚀 PERFORMANS

| İşlem | Zaman | Note |
|-------|-------|------|
| PDF metin çıkarma | 5-10s | PDFLoader |
| VLM analiz (20 sayfa) | 30-120s | GPU: 30s, CPU: 120s |
| Embedding (chunk) | 100-200ms | OpenAI API |
| Vector search | 5-20ms | pgvector index |
| Reranking | 2-5s | Local (CPU) |
| LLM cevap | 5-10s | GPT-4o-mini |
| **Toplam soru** | **15-30s** | Cevap alana kadar |

---

## 🎓 ÖĞRENME SIRASI

1. **db.ts** ← Veri nereye gidiyor?
2. **chain.ts** ← AI modelleri
3. **upload/route.ts** ← Veri nasıl girilir?
4. **query/route.ts** ← Sorgular nasıl işlenir?
5. **Diğer dosyalar** ← Destekleyiciler

---

## 📚 KAYNAKLAR

```
İçinde Belgeler:
- FULL_DOCUMENTATION.md ← Tüm sistem açıklaması
- TECHNICAL_DETAILS.md ← Kod detayları
- README.md ← Kurulum
- VLM_README.md ← VLM server kurulum
- RERANKER_README.md ← Reranker server kurulum
```

---

## ✅ SİSTEM KONTROL LISTESI

- [ ] PostgreSQL çalışıyor mu? (`psql -U postgres -d okr_docs`)
- [ ] VLM sunucusu çalışıyor mu? (`curl http://localhost:8001/health`)
- [ ] Reranker sunucusu çalışıyor mu? (`curl http://localhost:8000/health`)
- [ ] OpenAI API key ayarlanmış mı? (`.env.local`)
- [ ] Next.js çalışıyor mu? (`npm run dev`)
- [ ] Dosyalar yüklü mü? (`SELECT COUNT(*) FROM documents;`)
- [ ] Embeddings var mı? (`SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL;`)

---

## 🎉 SISTEM ÖZÜR

Bu sistem:
- ✅ Enterprise-grade RAG
- ✅ Multi-format dosya desteği (PDF, Excel, Word, TXT)
- ✅ Görsel analiz (VLM)
- ✅ İnteligent reranking
- ✅ Konuşma kaydı
- ✅ Fallback mechanisms
- ✅ Vector database (pgvector)

Başarılı bir AI sistemi! 🚀

---

**Son Güncelleme: 27 Kasım 2025**
**Version: 1.0 (Stable)**
