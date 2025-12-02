# 🎯 SİSTEM KONFİGÜRASYONU & MİMARİ KILAVUZU

**Son Güncelleme:** 2 Aralık 2025  
**Durum:** Üretim Hazır (VLM isteğe bağlı)  
**Amaç:** Tam sistem yapılandırması, yetenekleri ve operasyonel detaylar

---

## 📋 İÇİNDEKİLER

1. [Sistem Genel Bakış](#sistem-genel-bakış)
2. [Temel Yapılandırma](#temel-yapılandırma)
3. [Mimari & Veri Akışı](#mimari--veri-akışı)
4. [Bileşen Detayları](#bileşen-detayları)
5. [Dosya Formatları & İşleme](#dosya-formatları--işleme)
6. [Performans Ayarlaması](#performans-ayarlaması)
7. [Sorun Giderme](#sorun-giderme)

---

## 🏗️ SİSTEM GENEL BAKIŞ

### Bu Sistem Nedir?

**Retrieval-Augmented Generation (RAG)** sistemi şu özellikleri sunar:
- ✅ Belgeleri yükler ve indeksler (PDF, Excel, Word, TXT)
- ✅ İndexlenen bölümleri **vektör benzerliği** ile arar
- ✅ Sonuçları **Qwen Reranker** ile daha iyi sıralar
- ✅ **GPT-4o-mini** ile ilgili içeriği kullanarak cevap üretir
- ✅ Konuşma geçmişini bölümler içinde tutar

### Teknoloji Yığını

| Bileşen | Model/Hizmet | Durum | Port |
|---------|--------------|-------|------|
| **Ön Yüz** | Next.js 16 (Turbopack) | ✅ Aktif | 3000 |
| **Embedding** | OpenAI text-embedding-3-small | ✅ Aktif | API |
| **Vektör DB** | PostgreSQL + pgvector | ✅ Aktif | 5433 |
| **Reranker** | Qwen/Qwen3-Reranker-4B | ✅ Aktif | 8000 |
| **LLM** | OpenAI GPT-4o-mini | ✅ Aktif | API |
| **VLM** (İsteğe bağlı) | Qwen2.5-VL-7B-Instruct | ⏸️ Devre dışı (RAM) | 8001 |

---

## ⚙️ TEMEL YAPILANDIRMA

### 🔤 Metin Bölümleme Ayarları

```typescript
// Dosya: app/api/rag/upload/route.ts (satır 286-289)
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,       // Chunk başına maksimum 1000 karakter
  chunkOverlap: 200,     // Chunk'lar arasında 200 karakter örtüşme
});
```

**Bu Değerler Neden?**
- **1000 karakter**: Bağlam koruma ve vektör araması dengesini sağlar
- **200 örtüşme**: Chunk sınırlarındaki önemli kavramlar kaybedilmez
- **Sonuç**: Tipik 10 sayfalık PDF başına ~40-50 chunk

**Örnek Hesaplama:**
```
Toplam PDF içeriği: 15.000 karakter
Chunk boyutu: 1000 karakter
Örtüşme: 200 karakter (önceki chunk'tan gelir)
---
Oluşturulan chunk'lar: ~20-22 chunk
```

### 📊 Vektör Arama Yapılandırması

```typescript
// Dosya: app/api/rag/query/route.ts (satır 53)
const vectorSearchSQL = `
  SELECT * FROM documents
  WHERE user_id = $1
  ORDER BY embedding <-> $2
  LIMIT 10;
`;
```

**Ayarlar:**
- **Vektör Retrieval**: EN ÜSTTEKI 10 dokuman
- **Mesafe Metriği**: `<->` (pgvector operatörü, Öklid mesafesi)
- **Kapsam**: Kullanıcı bazında filtreleme

### 🔄 Reranking Yapılandırması

```typescript
// Dosya: app/api/rag/query/route.ts (satır 100-107)
const rerankerPromise = fetch('http://localhost:8000/rerank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: question,
    documents: result.rows.map(r => r.content),
    top_k: 10
  })
});

const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Reranker timeout (180s)')), 180000)
);

const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]);
```

**Ayarlar:**
- **Model**: Qwen/Qwen3-Reranker-4B (4-bit niceleme, CPU'da ~2.5GB)
- **Zaman Aşımı**: **180 saniye** (maksimum 3 dakika bekleme)
- **Geri Plan**: Zaman aşımı → vektör benzerlik puanları kullanılır (100%, 95%, 90%, 85%, 80%)
- **Cihaz**: CPU (GPU optimizasyonu mevcutsa kullanılabilir)
- **Batch Boyutu**: 4 dokuman batch'i (CPU optimizasyonu)
- **Maksimum Uzunluk**: 256 token (CPU hızı için 512'den indirildi)

**Performans:**
- Ortalama reranking zamanı: 30-60 saniye (10 dokuman)
- Zaman aşımı 180 saniyeyi aşarsa tetiklenir
- Zaman aşımı olduğunda: geri plan puanlama kullanılır, sonuçlar geçerli

### 🤖 LLM Yapılandırması

```typescript
// Dosya: lib/rag/chain.ts
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.1,  // ← DÜŞÜK = daha belirleyici, gerçekçi cevaplar
  maxTokens: 2048
});
```

**Ayarlar:**
- **Model**: OpenAI GPT-4o-mini
- **Sıcaklık**: **0.1** (çok düşük = daha belirleyici, gerçekçi)
- **Maksimum Çıktı**: 2048 token (~1500 kelime)
- **Bağlam Penceresi**: 128K token (RAG için bol)

### 🗄️ Veritabanı Yapılandırması

```sql
-- Dosya: lib/rag/schema.sql

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  file_id INT,           -- Bu chunk hangi dosyaya ait
  chunk_num INT,         -- Dosya içindeki chunk numarası
  content TEXT,
  embedding vector(1536), -- OpenAI embedding boyutu
  metadata JSONB,        -- İçerir: source, page, type, vs.
  created_at TIMESTAMP,
  CONSTRAINT idx_embedding USING GIN (embedding)
);

-- Vektör arama indeksi (pgvector)
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

**Önemli Noktalar:**
- **Embedding Boyutu**: 1536 (OpenAI standart)
- **Metadata Alanları**: source, page, chunk, type, lineNumber
- **İndeksleme**: IVFFlat (yaklaşık en yakın komşu, hızlı)
- **Kullanıcı Başına Veri**: Tam olarak user_id tarafından izole

---

## 🔗 MİMARİ & VERİ AKIŞI

### Yükleme Akışı

```
┌─────────────────────────────────────────────────────────────┐
│ 1. KULLANICI DOSYA YÜKLER (PDF/Excel/Word/TXT)              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 2. DOSYA AYRIŞTIRILMASI (Türe Göre)                          │
│   • PDF → PDFLoader → Metin çıkarma                          │
│   • Excel → read-excel-file → Tablo metin                    │
│   • Word → docx-parser → Metin çıkarma                       │
│   • TXT → Doğrudan oku                                       │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 3. METİN BÖLÜMLEME (RecursiveCharacterTextSplitter)         │
│   • Boyut: 1000 karakter, Örtüşme: 200 karakter             │
│   • Dosya başına işleme (bağımsız numaralama)               │
│   • Chunk temizliği (null karakterler, kontrol karakterleri) │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 4. EMBEDDİNG ÜRETİMİ (OpenAI text-embedding-3-small)       │
│   • Her chunk → 1536 boyutlu vektör                         │
│   • Paralelleştirilebilir                                    │
│   • Aynı içerik varsa önbelleğe alınır                      │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 5. VERİTABANI EKLEME (PostgreSQL + pgvector)               │
│   • Metadata: file_id, chunk_num, source, type, page        │
│   • Vektör indeksi oluşturulur (hızlı arama)                │
│   • Döndürür: Chunk ID'leri, dosya başına ekleme sayıları    │
│   • Terminal Çıktısı: 📁 dosyaadı.uzantı: chunks = N        │
└────────────────┬────────────────────────────────────────────┘
                 │
            ✅ YÜKLEME TAMAMLANDI
```

**Terminal Çıktısı Örneği:**
```
📁 sistem_3.pdf: file_id = 21, chunks = 26
📁 example.xlsx: file_id = 22, chunks = 17
✅ UPLOAD COMPLETE - DETAILED SUMMARY
📊 Total chunks (inserted): 43/43
```

### Sorgulama Akışı

```
┌──────────────────────────────────────────────────┐
│ 1. KULLANICI SORU SORAR                          │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 2. SORU EMBEDDING'İ (OpenAI)                     │
│   • Soru → 1536 boyutlu vektör                   │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 3. VEKTÖR BENZERLİĞİ ARAMASI (PostgreSQL pgvector)│
│   • EN YAKIN 10 chunk'ı bul                      │
│   • Metrik: Öklid mesafesi (<-> operatörü)      │
│   • Log: "📄 Toplam vector match: N"             │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 4. YENİDEN SIRALAMA (Qwen3-Reranker-4B @ port 8000) │
│   • Model: Qwen/Qwen3-Reranker-4B                │
│   • Giriş: Soru + EN ÜSTTEKI 10 doküman          │
│   • Çıktı: Sıralanmış dokümanlar ve puanlar      │
│   • Zaman Aşımı: 180 saniye (vektör puanlarına geri dön) │
│   • Log: "✅ Qwen reranker başarılı" ya da       │
│         "⚠️ Qwen reranker kullanılamadı (timeout)" │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 5. BAĞLAM SEÇİMİ (Dosya Çeşitliliği)            │
│   • Her PDF dosyasından EN ÜSTTEKI sonucu al    │
│   • Maksimum 10 sonuç toplam                     │
│   • Tüm dosyalar temsil edilir                   │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 6. BAĞLAM DEĞERLENDİRMESİ                       │
│   • Format: "Source: dosyaadı (chunk X)\n..."   │
│   • İçer: Sayfa numarası, satır numarası (varsa) │
│   • Sınır: Özet başına 2000 karakter            │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 7. LLM ÇIKARIMI (GPT-4o-mini @ OpenAI API)      │
│   • Model: gpt-4o-mini                           │
│   • Sıcaklık: 0.1 (belirleyici)                 │
│   • Giriş: Soru geçmişi + Bağlam + Soru         │
│   • Çıktı: Cevap metni                           │
│   • Log: "🤖 LLM'e gönderiliyor..."             │
└────────────────┬─────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────┐
│ 8. BÖLÜM OLUŞTURMA (PostgreSQL sections table)  │
│   • S&C çiftini ve bağlamı kaydet               │
│   • Gelecek sorgularda yeniden kullan (geçmiş)  │
│   • User_id ve section_id ile ilişkilendir      │
└────────────────┬─────────────────────────────────┘
                 │
            ✅ CEVAP KULLANICIYA İLETİLDİ
```

---

## 🔧 BİLEŞEN DETAYLARI

### 1. Next.js Ön Yüz (Port 3000)

**Dosya:** `app/page.tsx` (ana kontrol paneli)

**Özellikler:**
- 📂 Sürükle-bırak dosya yükleme (birden fazla dosya)
- ✅ Dosya seçimi arama/filtresi ile
- 💬 Soru girişi Markdown cevap görüntüsü ile
- 📚 Konuşma geçmişi (bölümler)
- 🗑️ Yükleme UI'da dosya başına silme

**Yükleme UI Yetenekleri:**
- Kabul eder: `.pdf`, `.xlsx`, `.xls`, `.docx`, `.txt`
- Çoklu seçim: Evet
- Sürükle-bırak: Evet
- Dosya sayısı görüntüsü: Evet (örn. "3 dosya seçildi")
- Tek dosya kaldırma: Evet (fareyle üzerine gelince ✕ düğmesi)
- Tümünü temizle: Evet (Temizle düğmesi)

### 2. Embedding Hizmeti

**Model:** `text-embedding-3-small` (OpenAI)
**Boyut:** 1536
**Maliyet:** ~$0.02 per 1M token
**Hız:** Hızlı (birkaç ms per çağrı)
**Dosya:** `lib/rag/chain.ts`

### 3. Vektör Veritabanı (PostgreSQL + pgvector)

**Ana Bilgisayar:** localhost:5433  
**Veritabanı:** okr_docs_rag  
**Kullanıcı:** rag_user  
**Tablolar:**
- `documents` - Embedding'li Chunk'lar
- `sections` - Konuşma geçmişi
- `files` - Dosya metadata'sı

**İndeksler:**
```sql
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

**Chunk Başına Depolama:**
- İçerik: ~200 bayt (ort.)
- Embedding: ~6.2 KB (1536 × 4 bayt)
- Metadata: ~100 bayt
- **Toplam chunk başına: ~6.5 KB**

### 4. Reranker (Qwen3-Reranker-4B @ Port 8000)

**Dosya:** `reranker_server.py`

**Özellikler:**
- Model: `Qwen/Qwen3-Reranker-4B`
- Framework: FastAPI
- Cihaz: CPU (GPU varsa kullanılabilir)
- RAM: ~2.5 GB (4-bit niceleme)
- Port: 8000
- Zaman Aşımı: **180 saniye** (sorgu rotası)

**Uç Noktalar:**
- `POST /rerank` - Dokümanları sırala
  ```json
  {
    "query": "string",
    "documents": ["doc1", "doc2", ...],
    "top_k": 10
  }
  ```
  Yanıt:
  ```json
  {
    "ranked_documents": [
      {"index": 2, "document": "...", "score": 0.95},
      {"index": 0, "document": "...", "score": 0.87}
    ]
  }
  ```
- `GET /health` - Sağlık kontrolü

**Başlama Komutu:**
```bash
source reranker_env/bin/activate
python reranker_server.py
```

### 5. LLM (GPT-4o-mini)

**Model:** `gpt-4o-mini`
**Sağlayıcı:** OpenAI API
**Bağlam Penceresi:** 128.000 token
**Sıcaklık:** 0.1 (belirleyici)
**Maksimum Çıktı:** 2048 token
**Maliyet:** ~$0.15 per 1M giriş token
**Dosya:** `lib/rag/chain.ts`

---

## 📄 DOSYA FORMATLARI & İŞLEME

### PDF İşleme

**Ayrıştırıcı:** PDFLoader (LangChain)
**Akış:**
1. PDF'i pdfjs-dist ile oku
2. Her sayfadan metin çıkar
3. Node.js uyumluluğu için DOMMatrix polyfill uygula
4. Resimleri çıkar (isteğe bağlı, VLM açıksa)
5. Chunk'lara böl

**Örnek Çıktı:**
```
sistem_3.pdf (13 sayfa)
→ 13 sayfa çıkarması
→ 26 chunk (1000 karakter her biri, 200 örtüşme)
→ 26 embedding
→ 26 DB ekleme
```

### Excel İşleme

**Ayrıştırıcı:** read-excel-file
**Akış:**
1. Excel sayfasını oku
2. Tabloyu metne dönüştür (satırlar yeni satırlar ile ayrılmış)
3. Her satır potansiyel chunk olabilir
4. Gerekiyorsa böl

**Örnek:**
```
Ornek-Excel-Tablosu.xlsx (1 sayfa, 203 karakter)
→ 1 dokuman
→ Satırlara böl
→ 17 chunk (gerekiyorsa)
```

### Word İşleme

**Ayrıştırıcı:** docx-parser
**Akış:**
1. .docx dosyasını oku
2. Paragrafları, tabloları, listeleri çıkar
3. Düz metne dönüştür
4. Chunk'lara böl

### TXT İşleme

**Ayrıştırıcı:** Doğrudan dosya oku
**Akış:**
1. Metin dosyasını oku
2. Chunk'lara böl
3. Embedding'leri oluştur

---

## ⚡ PERFORMANS AYARLAMASI

### Chunk Boyutu Ayarlaması

| Boyut | Avantajlar | Dezavantajlar | Kullanım Durumu |
|-------|-----------|----------------|-----------------|
| **500** | Daha tanecikli, hızlı arama | Bağlam kaybı olabilir | Yoğun referans dokümanlar |
| **1000** | ✅ Dengeli (GÜNCEL) | - | Genel amaç |
| **2000** | Daha fazla bağlam | Yavaş arama, denser vektörler | Uzun metinli dokümanlar |
| **4000** | Maksimum bağlam | Çok yavaş | Teknik manuallar |

### Örtüşme Ayarlaması

| Örtüşme | Avantajlar | Dezavantajlar | Kullanım Durumu |
|--------|-----------|----------------|-----------------|
| **50** | Hızlı işleme | Sınırlarda bağlam kaybı | Genel dokümanlar |
| **200** | ✅ Dengeli (GÜNCEL) | Hafif fazlalık | Önemli sınırlar |
| **400** | Maksimum süreklilik | Yüksek fazlalık | Kritik dokümanlar |

### Reranker Optimizasyonu

**Güncel Darboğaz:** CPU tabanlı reranker sorgu başına 30-60 saniye alır

**Seçenekler:**
1. **GPU Hızlandırması** (önerilir)
   - Zamanı 5-10 saniyeye indirir
   - Gerekli: NVIDIA GPU + CUDA
   
2. **Daha Küçük Model** (daha hızlı ama daha az doğru)
   - Qwen3-Reranker-1B kullan
   - ~15-20 saniye CPU'da
   
3. **Reranking'i Atla** (en hızlı)
   - Doğrudan vektör arama kullan
   - Kalite: %20 daha düşük doğruluk
   - Zaman: <1 saniye

4. **Batch Optimizasyonu**
   - Güncel: 4 dokuman per batch
   - RAM varsa 8-16'ya çıkar

---

## 🐛 SORUN GIDERME

### Sorun: "Bilgiye Erişilemedi" (Bilgi Bulunamadı)

**Neden 1:** Hiç dokuman indekslenmedi
```bash
# Veritabanını kontrol et
psql -U rag_user -d okr_docs_rag -c "SELECT COUNT(*) FROM documents;"
```
**Çözüm:** PDF'leri yükle

**Neden 2:** Vektör araması 0 sonuç döndürüyor
```bash
# Vektör indeksini kontrol et
psql -U rag_user -d okr_docs_rag -c "SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL;"
```
**Çözüm:** Belgeleri yeniden yükle, backend'i yeniden başlat

### Sorun: Reranker Zaman Aşımı (180s)

**Belirtiler:** "⚠️ Qwen reranker kullanılamadı" mesajı

**Nedenler:**
1. Reranker sunucusu kapalı
2. Çok fazla dokuman (>50)
3. Uzun dokümanlar (>4000 karakter her biri)

**Çözümler:**
```bash
# Reranker durumunu kontrol et
curl http://localhost:8000/health

# Reranker'ı yeniden başlat
source reranker_env/bin/activate
python reranker_server.py

# Performansı izle
tail -f next.log | grep "Reranking\|timeout"
```

### Sorun: Embedding Hataları

**Belirtiler:** Log'ta "❌ Embedding boş"

**Nedenler:**
1. OpenAI API kapalı
2. Geçersiz API anahtarı
3. Oran sınırı aşıldı

**Kontrol:**
```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

### Sorun: Yüksek Bellek Kullanımı

**Belirtiler:** Sistem yavaş, donma

**Çözümler:**
1. VLM durumunu kontrol et (devre dışı olmalı)
   ```bash
   curl http://localhost:8001/health 2>/dev/null || echo "✅ VLM disabled"
   ```
2. .next yapı önbelleğini temizle
   ```bash
   rm -rf .next
   npm run build
   ```
3. Reranker batch boyutunu azalt (reranker_server.py, satır ~60)

---

## 🚀 BAŞLAMA SIRASI

### Geliştirme Modu (Test İçin Önerilir)

**Terminal 1 - Next.js Ön Yüz:**
```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs
npm run dev
```

**Terminal 2 - Reranker Sunucusu:**
```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs
source reranker_env/bin/activate
python reranker_server.py
```

**Terminal 3 - PostgreSQL (çalışmıyorsa):**
```bash
pg_ctl -D /usr/local/var/postgres start
# veya Docker kullan: docker run -d -p 5433:5432 postgres:15
```

**Beklenen Çıktı:**
```
✅ Next.js ready at http://localhost:3000
✅ Reranker ready at http://localhost:8000
✅ PostgreSQL listening on port 5433
```

### Üretim Dağıtımı

Bak: `SETUP.md` tam üretim kurulumu için

---

## 📊 HIZLI REFERANS TABLOSU

| Ayar | Değer | Dosya | Satır |
|------|-------|-------|------|
| Chunk Boyutu | 1000 karakter | app/api/rag/upload/route.ts | 286 |
| Chunk Örtüşmesi | 200 karakter | app/api/rag/upload/route.ts | 287 |
| Vektör Retrieval | EN ÜSTTEKI 10 | app/api/rag/query/route.ts | 53 |
| Reranker Zaman Aşımı | 180 saniye | app/api/rag/query/route.ts | 106 |
| Reranker Batch Boyutu | 4 dokuman | reranker_server.py | ~60 |
| LLM Modeli | gpt-4o-mini | lib/rag/chain.ts | - |
| LLM Sıcaklığı | 0.1 | lib/rag/chain.ts | - |
| Embedding Modeli | text-embedding-3-small | lib/rag/chain.ts | - |
| Embedding Boyutu | 1536 | lib/rag/chain.ts | - |
| DB Ana Bilgisayarı | localhost | lib/rag/db.ts | - |
| DB Port | 5433 | lib/rag/db.ts | - |
| Ön Yüz Port | 3000 | next.config.ts | - |
| Reranker Port | 8000 | reranker_server.py | - |

---

## 📝 NOTLAR

- **Konuşma Geçmişi:** PostgreSQL `sections` tablosunda kullanıcı başına tutulur
- **Çok Kullanıcı Desteği:** Tüm veriler `user_id` tarafından izole edilir (şu anda "demo-user")
- **Chunk Metadata'sı:** file_id, chunk_num, source, page, type, lineNumber'ı içerir
- **Geri Plan Mekanizması:** Reranker zaman aşımı yapsa, sistem vektör benzerlik puanlarını (100%, 95%, 90%, 85%, 80%) kullanır
- **VLM Durumu:** Şu anda RAM kısıtlamaları nedeniyle devre dışı (~1-2GB startup'ta gerekli, Mac M4'te 2.6GB boş)

---

**Sorular veya güncellemeler için, her bölümde bahsedilen belirli dosyalara bakın.**
