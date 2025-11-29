# 🔴 VLM Hata Yönetimi & Çıktı Akışı

## VLM'den Yanıt Akışı (Hata Senaryoları)

### 📍 Çağrı Noktaları

VLM (`http://localhost:8001/analyze`) şu yerlerden çağrılıyor:

1. **`app/api/rag/upload/route.ts`** (Ana yer)
   - Lines 87-147: PDF upload sırasında
   - Tüm PDF sayfaları VLM'e gönderiliyor

2. **`lib/rag/pdf-vlm-analyzer.ts`** (Utility)
   - `analyzeImageWithVLM()`: Tek görsel analizi (lines 59-91)
   - `extractContentWithVLM()`: Batch sayfaları (lines 98-164)
   - `formatVLMChunks()`: Sonuçları formatla (lines 172-230)

---

## 🚨 Hata Senaryoları & Yanıtlar

### Senaryo 1: VLM Server'ı Yanıt Vermiyor (Port 8001 Kapalı)

```
✅ User: PDF yükle
  ↓
📂 app/api/rag/upload/route.ts (line 91)
  const healthCheck = await fetch('http://localhost:8001/health')
  ↓
❌ Connection refused / ECONNREFUSED
  ↓
📋 Catch Block (line 92-96)
  if (!healthCheck.ok) {
    throw new Error('VLM server 8001 portunda erişilemez')
  }
  ↓
🔴 HATA YAKALANIR (line 139)
  } catch (vlmError) {
    console.warn(`⚠️ VLM analizi atlandı:`, vlmError.message)
    // VLM hatası upload'ı DURDURMAZ, devam et!
  }
  ↓
📊 UPLOAD DEVAM EDER
  ✅ PDF: PDFLoader ile chunks alınır
  ✅ Embedding: OpenAI ile embed edilir
  ✅ DB: documents tablosuna kaydedilir
  ✅ Response: { success: true, "VLM atlandı" mesajı }
```

**Browser'da Görünen:**
```
📂 okr-docs-tablosu.pdf yüklenmiştir
Durum: ✅ 156 chunk kaydedildi
⚠️ VLM analizi atlandı: VLM server 8001 portunda erişilemez
```

**Terminal Output:**
```
🔍 VLM analizi başlanıyor...
❌ VLM server sağlık kontrolü başarısız
⚠️ VLM analizi atlandı: VLM server 8001 portunda erişilemez
```

---

### Senaryo 2: VLM Server Çalışıyor Ama Sayfasında Hata

```
📍 VLM Analyze Çağrısı (upload/route.ts line 109)
  POST http://localhost:8001/analyze
  Body: { page_content, page_number, file_name }
  Timeout: 5000ms (5 saniye)
  ↓
❌ VLM Hatası: "Model not loaded" (vlm_transformers_server.py line 78)
  ↓
VLM Response:
  HTTP 500
  Body: { 
    "detail": "Model not loaded"  
  }
  ↓
📋 Upload Handler (line 120)
  if (vlmResponse && vlmResponse.ok) {
    // vlmResponse.ok = FALSE (500 hatası)
    // Bu blok çalışmaz
  }
  ↓
😐 Sayfanın analizi atlanır, sonraki sayfaya geçilir
  ↓
📂 Sonunda
  ✅ PDF chunks başarılı (VLM olmadan)
  ℹ️ VLM: Tablo analizi yapılmadı (belgede tablo yok veya VLM analiz etmedi)
```

**Terminal Output:**
```
🔍 VLM analizi başlanıyor...
✅ VLM server sağlıklı, analiz ediliyor...
  📄 Sayfa 1/10 analiz ediliyor...
    ⚠️ Sayfa 1 VLM analizi atlandı
  📄 Sayfa 2/10 analiz ediliyor...
    ⚠️ Sayfa 2 VLM analizi atlandı
...
ℹ️ VLM: Tablo analizi yapılmadı (belgede tablo yok veya VLM analiz etmedi)
```

---

### Senaryo 3: VLM Timeout (5 Saniye)

```
📍 VLM Analyze Çağrısı (upload/route.ts line 109)
  signal: AbortSignal.timeout(5000)
  ↓
⏱️ 5 saniyede yanıt yok
  ↓
❌ AbortError: Signal aborted
  ↓
📋 Catch Block (line 113-128)
  .catch(() => null)
  ↓
vlmResponse === null
  ↓
😐 Sayfa atlanır
```

**Terminal Output:**
```
  📄 Sayfa 5/10 analiz ediliyor...
    ⚠️ Sayfa 5 VLM analizi atlandı
```

---

### Senaryo 4: VLM Yanıt Verir Ama Yanlış Format

```
VLM Response (200 OK):
  { "wrong_field": "value" }
  
❌ vlmData.tables is undefined
  
Line 122: if (vlmData.tables && vlmData.tables.length > 0)
  // Şart FALSE, bu blok atlanır
  
😐 Bu sayfanın VLM analizi yok sayılır
```

---

## 📊 Çıktı Akışı (Terminal Logging)

### Başarılı VLM Akışı

```
🔍 VLM analizi başlanıyor...
✅ VLM server sağlıklı, analiz ediliyor...
  📄 Sayfa 1/5 analiz ediliyor...
    ✅ 2 tablo bulundu
  📄 Sayfa 2/5 analiz ediliyor...
    ✅ 1 tablo bulundu
  📄 Sayfa 3/5 analiz ediliyor...
  📄 Sayfa 4/5 analiz ediliyor...
  📄 Sayfa 5/5 analiz ediliyor...
    ✅ 3 tablo bulundu
✅ VLM: 3 sayfada tablo/grafik analizi yapıldı
✅ VLM chunks eklendi: toplam 50 dokuman (PDFLoader 45 + VLM 5)
```

### VLM Server Down

```
🔍 VLM analizi başlanıyor...
❌ VLM server sağlık kontrolü başarısız
⚠️ VLM analizi atlandı: VLM server 8001 portunda erişilemez
ℹ️ VLM Tablo analizi yapılmadı (PDFLoader'dan chunks alınıyor...)
✅ PDFLoader chunks: 45 dokuman
```

### VLM Timeout

```
🔍 VLM analizi başlanıyor...
✅ VLM server sağlıklı, analiz ediliyor...
  📄 Sayfa 1/5 analiz ediliyor...
    ⚠️ Sayfa 1 VLM analizi atlandı (timeout veya hata)
  📄 Sayfa 2/5 analiz ediliyor...
    ⚠️ Sayfa 2 VLM analizi atlandı (timeout veya hata)
  📄 Sayfa 3/5 analiz ediliyor...
    ⚠️ Sayfa 3 VLM analizi atlandı (timeout veya hata)
  📄 Sayfa 4/5 analiz ediliyor...
  📄 Sayfa 5/5 analiz ediliyor...
ℹ️ VLM: Tablo analizi yapılmadı
✅ PDFLoader chunks: 45 dokuman
```

---

## 🔍 VLM Server Hatalarını Kontrol Etme

### 1. VLM Server Sağlığını Kontrol Et

```bash
# Terminal 1: VLM server çalışıyor mı?
curl -s http://localhost:8001/health | jq .

# Çıktı örneği:
{
  "status": "healthy",
  "model": "Qwen/Qwen2.5-VL-7B-Instruct",
  "device": "cpu",
  "dtype": "torch.float32",
  "model_loaded": true
}

# Eğer bağlanmıyorsa:
curl -s http://localhost:8001/health
# curl: (7) Failed to connect to localhost port 8001: Connection refused
```

### 2. VLM Server Logs'ları İzle

```bash
# Terminal'de VLM server çalıştırırken (gerçek zamanlı logs):
source /Users/emirhanyilmaz/Desktop/okr-docs/vlm_env/bin/activate
python /Users/emirhanyilmaz/Desktop/okr-docs/vlm_transformers_server.py

# Çıktı:
# ℹ️ 2025-01-29 14:30:00 INFO:vlm:📥 Model indiriliyor / yükleniyor: Qwen/Qwen2.5-VL-7B-Instruct
# ℹ️ 2025-01-29 14:30:00 INFO:vlm:📟 Device: cpu | Dtype: torch.float32
# ✅ 2025-01-29 14:32:30 INFO:vlm:✅ Model yüklendi ve hazır
```

### 3. VLM Direktest Çağrısı (curl)

```bash
# Basit sınama
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "iVBORw0KGgoAAAANS...",
    "task": "extract",
    "language": "turkish"
  }' | jq .

# Hata durumunda:
{
  "detail": "Model not loaded"
}

# Başarı durumunda:
{
  "task": "extract",
  "analysis": "Bu görselde tablo ve metin var.",
  "confidence": 0.95,
  "content_type": "table"
}
```

---

## 🔧 Hata Çözmek İçin Adımlar

### Adım 1: VLM Server'ı Kontrol Et

```bash
# Health check
curl -s http://localhost:8001/health | jq .model_loaded

# Eğer false ise → server process çökmüş veya model yüklenmemiş
# → VLM server'ı restart et:
pkill -f "vlm_transformers_server.py"
source vlm_env/bin/activate
python vlm_transformers_server.py  # Bekle, model yükleneceği
```

### Adım 2: VLM Upload'ı Test Et

```bash
# Browser: http://localhost:3000 açınız
# PDF yükleyiniz
# Terminal çıktısına bakınız

# Eğer "VLM server 8001 portunda erişilemez" görrüyorsa
# → VLM server'ı başlatmadınız veya çökmüş
```

### Adım 3: Upload logs'unda Hata Varsa

```bash
# Browser console (F12 → Network tab)
# "POST /api/rag/upload" yanıtında Response var mı?
# → JSON'da "message" alanını kontrol et

# Terminal'de Next.js logs (port 3000 output)
# "VLM analizi atlandı" yazısı varsa
# → VLM server sorunlu, kontrol et
```

---

## 💾 Database'de VLM Trace'si

Upload sonrası, chunks'ların VLM'den gelip gelmediği kontrol et:

```sql
-- PostgreSQL'de
SELECT * FROM documents 
WHERE metadata->>'type' = 'vlm' 
LIMIT 5;

-- VLM chunks metadata'sı:
-- {
--   "source": "okr-docs-tablosu.pdf",
--   "type": "vlm",
--   "page": 3,
--   "chunk": 1,
--   "content_type": "table",
--   "file_id": 42
-- }

-- Hiç VLM chunk yoksa → VLM çalışmadı (atlandı)
SELECT COUNT(*) FROM documents WHERE metadata->>'type' = 'vlm';
-- Sonuç: 0 → VLM inactive
```

---

## ⚠️ Bilinen Sorunlar & Çözümler

| Sorun | Semptom | Çözüm |
|-------|---------|------|
| **VLM Port 8001 Kapalı** | "VLM server 8001 portunda erişilemez" | VLM server başlat: `python vlm_transformers_server.py` |
| **VLM Timeout** | "⚠️ Sayfa N VLM analizi atlandı" (her sayfa) | Timeout 5000ms artır veya VLM server logs kontrol et |
| **Model Not Loaded** | HTTP 500, "Model not loaded" | VLM server yükleniyor, bekle 2-3 dakika |
| **Memory Exhausted** | Python process dies | GPU/CPU memory yetersiz, sistem restart et |
| **Wrong Response Format** | VLM response'da `tables` yok | VLM server code'u kontrol et (response format hatalı) |

---

## 🎯 Özet: VLM Hata Yönetimi

✅ **VLM hatası upload'ı DURDURMAZ** → Fallback: PDFLoader chunks kullan
✅ **Her sayfanın timeout'ı 5 saniye** → Timeout sonrası sayfa atlanır
✅ **VLM analytics optional** → Sistem PDFLoader'dan almaya devam eder
✅ **Terminal'de debug logs** → Her sayfa için "✅ tablo" veya "⚠️ atlandı"
✅ **Database'de tip ayırımı** → `metadata->>'type'` = 'vlm' vs 'pdf'

