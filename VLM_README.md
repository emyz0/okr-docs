# 🖼️ Qwen3 VLM Server

Qwen/Qwen3-VL-4B-Instruct modeli ile PDF'lerdeki görsel, tablo, diagram ve grafikleri analiz eden FastAPI sunucusu.

## 📋 Gereksinimler

- **Python:** 3.10+
- **RAM:** ~12-16GB (CPU), 8-10GB (GPU)
- **GPU (opsiyonel):** CUDA 11.8+ (çok daha hızlı)

## 🚀 Kurulum

### Otomatik Kurulum (Önerilen)

```bash
chmod +x setup_vlm.sh
./setup_vlm.sh
```

### Manuel Kurulum

```bash
# Virtual environment oluştur
python3 -m venv vlm_env

# Aktifleştir (macOS/Linux)
source vlm_env/bin/activate

# Bağımlılıkları yükle
pip install -r vlm_requirements.txt
```

## ▶️ Sunucu Başlatma

```bash
# Virtual environment'i aktifleştir
source vlm_env/bin/activate

# Server çalıştır
python3 vlm_server.py
```

Çıktı:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
```

### Arka Planda Çalıştırma

```bash
nohup python3 vlm_server.py > vlm.log 2>&1 &
```

## 🏥 Sunucu Sağlığı Kontrolü

```bash
curl http://localhost:8001/health

# Örnek çıktı:
{
  "status": "healthy",
  "model": "Qwen/Qwen3-VL-4B-Instruct",
  "device": "cuda",
  "model_loaded": true
}
```

## 📨 API Kullanımı

### POST /analyze

Görselleri analiz eder - tablo, diagram, grafik vb. çıkarır.

**İstek:**
```json
{
  "image_base64": "iVBORw0KGgoAAAANS...",  // Base64 encoded image
  "task": "extract",  // "extract", "describe", "table", "diagram"
  "language": "turkish"
}
```

**Yanıt:**
```json
{
  "task": "extract",
  "analysis": "Görselde bir tablo vardır. İçeriği şu şekildedir:\n\n| Sütun1 | Sütun2 |\n|--------|--------|\n| Değer1 | Değer2 |",
  "confidence": 0.95,
  "content_type": "table"
}
```

### GET /health

Sunucu durumunu kontrol eder.

## 🔌 NextJS İntegrasyonu

Upload route (`/app/api/rag/upload/route.ts`) otomatik olarak:

1. PDF dosyası yüklenir
2. Metin çıkarılır (PDFLoader)
3. Her sayfa VLM ile analiz edilir (tablo, diagram vb.)
4. Sonuçlar chunks olarak veritabanına kaydedilir

**Akış:**
```
PDF Upload
  ├─ Text Extract (PDFLoader) ✅
  ├─ VLM Analysis (Qwen3-VL-4B)
  │   ├─ Sayfa 1 → Render → Analyze
  │   ├─ Sayfa 2 → Render → Analyze
  │   └─ Sayfa N (max 20)
  └─ Database
      ├─ Text chunks
      └─ VLM chunks (tablo, diagram)
```

## 📊 İçerik Türleri

VLM sonuçlarında `content_type` şu değerleri alabilir:

- **text**: Normal metin
- **table**: Tablo (Markdown formatında)
- **diagram**: Diyagram/Şekil (açıklaması)
- **chart**: Grafik (açıklaması)

## ⚡ Performans

### Benchmark (Örnek Değerler)

| Device | Model Load | Per Page | 20 Pages |
|--------|-----------|----------|----------|
| CPU (8 core) | 3-5 min | 10-20s | 3-6 min |
| GPU (RTX 3090) | 1-2 min | 2-3s | 40-60s |

**Optimizasyon İpuçları:**
1. GPU kullan (5-10x daha hızlı)
2. Flash Attention 2 (CUDA ile otomatik)
3. float16 (CUDA ile otomatik)

## 🛠️ Sorun Giderme

### "Model yüklenmedi" Hatası

```
❌ Status: model_loaded: false
```

**Çözüm:**
- Sunucunun 5-10 dakika beklemesi gerekebilir (model indirme + yükleme)
- Logs'u kontrol et: `tail -f vlm.log`

### "CUDA out of memory" Hatası

```
RuntimeError: CUDA out of memory
```

**Çözüm:**
- CPU mode'da çalıştır (daha yavaş)
- Batch size azalt
- float16 kullan (otomatik)

### Sunucu başlatılmıyor

```bash
# Debug mode'da çalıştır
python3 -u vlm_server.py

# Logs'ı kontrol et
tail -f vlm.log
```

## 📝 Log Dosyaları

Arka planda çalışan server logs:
```bash
tail -f vlm.log
```

## 🧹 Temizleme

```bash
# Virtual environment kaldır
rm -rf vlm_env

# Logs kaldır
rm vlm.log

# Hugging Face cache kaldır
rm -rf ~/.cache/huggingface/hub/
```

## 📚 İlgili Kaynaklar

- [Qwen3 VLM Docs](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Transformers Docs](https://huggingface.co/docs/transformers)

## 🤝 Support

Sorunlar için:
1. Logs'u kontrol et (`vlm.log`)
2. Health endpoint test et
3. Python/PyTorch versiyonlarını kontrol et

---

**Yapılandırma Dosyaları:**
- `vlm_server.py` - Ana VLM server uygulaması
- `vlm_requirements.txt` - Python bağımlılıkları
- `setup_vlm.sh` - Otomatik kurulum betiği
- `/lib/rag/pdf-vlm-analyzer.ts` - NextJS integration library
