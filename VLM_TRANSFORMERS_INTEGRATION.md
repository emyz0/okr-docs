# 🖼️ VLM Transformers Entegrasyon Kılavuzu

## Genel Bakış

**Qwen2-VL-32B** modelini **Hugging Face transformers** kütüphanesi ile lokal olarak çalıştırıyoruz:

- **Primary:** Transformers lokal inference (tablo/diagram analizi)
- **Fallback:** Hugging Face Inference Router (transformer başarısız olunca)

---

## Kurulum

### 1️⃣ Bağımlılıkları Yükle

```bash
pip install -r vlm_transformers_requirements.txt
```

**Gerekli paketler:**
- `transformers>=4.36.0` — Model loading ve inference
- `torch>=2.1.0` — PyTorch (CUDA support)
- `bitsandbytes` — 8-bit quantization (opsiyonel, bellek tasarrufu)
- `accelerate` — Multi-GPU support
- `fastapi`, `uvicorn` — API server

### 2️⃣ GPU Kontrol

```bash
nvidia-smi
```

**Gerekli:** En az 48 GB VRAM (A100, H100 vs.)
- **A100 40GB:** Quantization (8-bit) gerekli → `USE_8BIT=true`
- **A100 80GB:** Native float16 → `USE_8BIT=false`
- **CPU:** Desteklenmiyor (çok yavaş olur)

### 3️⃣ Transformers Server Başlat

```bash
./start_vlm_transformers.sh
```

Veya manuel:
```bash
export LOCAL_VLM_MODEL="Qwen/Qwen2-VL-32B-Instruct"
export USE_8BIT=false
export HUGGINGFACE_API_KEY=$(grep HUGGINGFACE_API_KEY .env.local | cut -d= -f2)

python vlm_transformers_server.py
```

**Output örneği:**
```
INFO:vlm:📦 Model yükleniyor: Qwen/Qwen2-VL-32B-Instruct
INFO:vlm:   8-bit quantization: False
INFO:uvicorn:Uvicorn running on http://0.0.0.0:8001
```

---

## API Kullanımı

### Health Check

```bash
curl http://localhost:8001/health | jq .
```

**Response:**
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen2-VL-32B-Instruct",
  "type": "transformers_local",
  "device": "cuda",
  "backend_ready": true
}
```

### Görsel Analiz

```bash
# Örnek görsel base64'e dönüştür
IMAGE_B64=$(base64 -i /path/to/image.png)

# Request gönder
curl -X POST http://localhost:8001/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$IMAGE_B64\",
    \"task\": \"table\",
    \"language\": \"turkish\"
  }" | jq .
```

**Tasks:**
- `extract` — TABLO / DİYAGRAM / GRAFIK / METIN kategorisine sınıflandır
- `table` — Tablo olup olmadığını kontrol et, varsa Markdown formatında göster
- `diagram` — Diyagram/şema analizı
- `describe` — Genel açıklama

**Response:**
```json
{
  "task": "table",
  "analysis": "| Lokanta | Kahvehane | Birahane |\n|---------|-----------|----------|\n| 255 | 31 | 760 |",
  "confidence": 0.92,
  "content_type": "table"
}
```

---

## Sistem İntegrasyonu

### PDF Upload Akışı

1. **Upload route** (`app/api/rag/upload/route.ts`)
   - PDF sayfalarını render et
   - VLM server'a POST `/analyze`
   - Sonuçları dokümanlara ekle
   - Embedding oluştur
   - DB'ye kaydet

2. **VLM Server** (`vlm_transformers_server.py`)
   - Base64 görsel al
   - Transformers ile inference
   - Tablo/diagram/metin çıkart
   - JSON response döndür

3. **Query endpoint** (`app/api/rag/query/route.ts`)
   - Vector search → top 10 chunk
   - Reranker (Qwen3) → best 3-5
   - LLM (GPT-4o-mini) → answer
   - VLM chunks ayrıca bağlam olarak eklenmiş

---

## Ortam Değişkenleri

**`.env.local` dosyasında set et:**

```bash
# HuggingFace
HUGGINGFACE_API_KEY=hf_xxxxxxxx  # Fallback ve model download için gerekli

# OpenAI (LLM)
OPENAI_API_KEY=sk-xxxxxxxx

# VLM Server
LOCAL_VLM_MODEL=Qwen/Qwen2-VL-32B-Instruct
USE_8BIT=false  # true → 8-bit quantization
```

---

## Performans İpuçları

### 1️⃣ 8-bit Quantization (Bellek tasarrufu)

```bash
USE_8BIT=true ./start_vlm_transformers.sh
```

- Bellek: 65GB → ~40GB
- Hız: -5-10% (negligible)
- Kalite: Minimal loss

### 2️⃣ Multi-GPU (Dağıtılmış çalıştırma)

Transformers `device_map="auto"` ile otomatik dağıtır. 2+ GPU için:

```bash
# device_map="auto" zaten enable
python vlm_transformers_server.py
```

### 3️⃣ Smaller Model (Test için)

Hızlı prototype:

```bash
LOCAL_VLM_MODEL="microsoft/phi-2" ./start_vlm_transformers.sh
```

---

## Troubleshooting

### ❌ Model yükleme başarısız

```
TransformersError: Can't connect to huggingface.co
```

**Çözüm:** HF offline mode:

```bash
export HF_DATASETS_OFFLINE=1
export HF_HUB_OFFLINE=1
# Fakat model daha önce cache'e indirilmiş olmalı
```

### ❌ CUDA out of memory

```
RuntimeError: CUDA out of memory
```

**Çözüm:**
1. 8-bit quantization aç: `USE_8BIT=true`
2. Model boyutunu küçült
3. Batch size düşür (None varsa)

### ❌ Transformers yavaş, HF Router'a fal

```
⚠️ Transformers failed, fallback to HF Router
```

**Kontrol:**
- GPU kullanılıyor mu: `nvidia-smi`
- Model cache'te mi: `~/.cache/huggingface/hub`
- Bellek yeterli mi: `nvidia-smi` → free memory

---

## Lokal vs. HF Inference

| Kriter | Lokal Transformers | HF Router |
|--------|-------------------|-----------|
| **Latency** | ~2-3s (GPU) | ~3-5s (network) |
| **Cost** | GPU rental | API per-request |
| **Privacy** | Tüm veri lokal | HF servers'a gidiyor |
| **Setup** | Complex | Basit |
| **Scaling** | Manual | Otomatik |

---

## Sonraki Adımlar

1. **VLM Server başlat:**
   ```bash
   ./start_vlm_transformers.sh
   ```

2. **PDF yükle ve test et:**
   - UI → Upload PDF
   - "Tablo 1'e göre..." sorusunu sor
   - Tablo chunks DB'de kaydedilsin

3. **Query test:**
   ```bash
   curl -X POST http://localhost:3000/api/rag/query \
     -H "Content-Type: application/json" \
     -d '{
       "question": "Tablo 1 nedir?",
       "userId": "demo-user"
     }' | jq .
   ```

---

## Log Dosyaları

```bash
# VLM server logs
tail -f vlm.log

# Next.js upload logs
tail -f next.log | grep "VLM"

# Reranker logs
tail -f reranker.log
```
