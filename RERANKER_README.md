# 🤖 Qwen3 Reranker Server

Qwen/Qwen3-Reranker-4B modelini çalıştıran FastAPI tabanlı reranking sunucusu. NextJS RAG uygulamasından gelen sorgu-dokümantasyon çiftlerini skor vererek önemlilik sırasına göre düzenler.

## 📋 Gereksinimler

- **Python:** 3.10+
- **RAM:** ~8-10GB (CPU), 4-6GB (GPU)
- **GPU (opsiyonel):** CUDA 11.8+ (PyTorch GPU desteği için)

## 🚀 Kurulum

### Otomatik Kurulum (Önerilen)

```bash
chmod +x setup_reranker.sh
./setup_reranker.sh
```

### Manuel Kurulum

```bash
# Virtual environment oluştur
python3 -m venv reranker_env

# Aktifleştir (macOS/Linux)
source reranker_env/bin/activate

# Aktifleştir (Windows)
reranker_env\Scripts\activate

# Bağımlılıkları yükle
pip install -r reranker_requirements.txt
```

## ▶️ Sunucu Başlatma

```bash
# Virtual environment'i aktifleştir
source reranker_env/bin/activate

# Server çalıştır
python3 reranker_server.py
```

Çıktı:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Arka Planda Çalıştırma

```bash
# nohup ile (logs kaydedilir)
nohup python3 reranker_server.py > reranker.log 2>&1 &

# screen ile
screen -S reranker
python3 reranker_server.py
# Ctrl+A, D ile detach

# tmux ile
tmux new-session -d -s reranker python3 reranker_server.py
```

## 🏥 Sunucu Sağlığı Kontrolü

```bash
# Health endpoint test
curl http://localhost:8000/health

# Örnek çıktı:
{
  "status": "healthy",
  "model": "Qwen/Qwen3-Reranker-4B",
  "device": "cuda",
  "model_loaded": true
}
```

## 📨 API Kullanımı

### POST /rerank

Sorgu ve dokümantları rerank eder, skorları döndürür.

**İstek:**
```json
{
  "query": "Türkiye'nin başkenti neresi?",
  "documents": [
    "Ankara, Türkiye'nin başkenti...",
    "İstanbul, Türkiye'nin en büyük şehri...",
    "Ege Bölgesi güzel bir bölgedir..."
  ],
  "top_k": 10
}
```

**Yanıt:**
```json
{
  "query": "Türkiye'nin başkenti neresi?",
  "ranked_documents": [
    {
      "index": 0,
      "document": "Ankara, Türkiye'nin başkenti...",
      "score": 8.753
    },
    {
      "index": 1,
      "document": "İstanbul, Türkiye'nin en büyük şehri...",
      "score": 5.342
    },
    {
      "index": 2,
      "document": "Ege Bölgesi güzel bir bölgedir...",
      "score": 1.203
    }
  ],
  "total_documents": 3
}
```

### GET /health

Sunucu durumunu kontrol eder.

**Yanıt:**
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen3-Reranker-4B",
  "device": "cuda",
  "model_loaded": true
}
```

## 🔌 NextJS İntegrasyonu

Query route (`/app/api/rag/query/route.ts`) otomatik olarak:

1. Qwen server'ı çağırır (port 8000)
2. Eğer sunucu down ise Cohere'ye fallback yapar
3. Rerank sonuçlarını kullanarak context hazırlar
4. LLM'e gönderir

**Fallback Akışı:**
```
Query Route
  ├─ Qwen /rerank → Başarılı ✅
  ├─ Qwen /rerank → Hata ⚠️
  │  └─ Cohere /rerank → Fallback ✅
  └─ LLM'e context gönder
```

## 📊 Performans

### Benchmark (Örnek Değerler)

| Device | Model Load | Per Request | Batch (10 docs) |
|--------|-----------|------------|-----------------|
| CPU (8 core) | 15-20s | 2-3s | 20-30s |
| GPU (RTX 3090) | 8-10s | 0.5-1s | 5-10s |

### Optimizasyon İpuçları

1. **GPU Kullan** → CPU'dan 5-10x daha hızlı
2. **Batch Size** → Daha fazla dokümantayı birlikte işle
3. **Quantization** → RAM kullanımını azaltmak için int8 quantize et
4. **Cache** → Model startup'ı bir kez yapar, sonra cache'den kullanır

## 🛠️ Sorun Giderme

### "Model yüklenmedi" Hatası

```
❌ Status: healthy: false
```

**Çözüm:**
```bash
# Sunucunun "startup" eventini tamamlaması için 30 saniye bekle
sleep 30
curl http://localhost:8000/health
```

### "CUDA out of memory" Hatası

```
RuntimeError: CUDA out of memory
```

**Çözüm:**
- CPU mode'da çalıştır (daha yavaş ama bellek az)
- Model quantization yap (int8)
- Batch size azalt

### Sunucu başlatılmıyor

```bash
# Debug mode'da çalıştır
python3 -u reranker_server.py

# Logs'ı kontrol et
tail -f reranker.log
```

## 📝 Log Dosyaları

Arka planda çalışan server logs:
```bash
tail -f reranker.log
```

## 🧹 Temizleme

```bash
# Virtual environment kaldır
rm -rf reranker_env

# Logs kaldır
rm reranker.log

# Cache kaldır (Hugging Face model cache)
rm -rf ~/.cache/huggingface/hub/
```

## 📚 İlgili Kaynaklar

- [Qwen Reranker Docs](https://huggingface.co/Qwen/Qwen3-Reranker-4B)
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [Transformers Docs](https://huggingface.co/docs/transformers)

## 🤝 Support

Sorunlar için:
1. Logs'u kontrol et (`reranker.log`)
2. Health endpoint test et
3. Python/PyTorch versiyonlarını kontrol et

---

**Yapılandırma Dosyaları:**
- `reranker_server.py` - Ana sunucu uygulaması
- `reranker_requirements.txt` - Python bağımlılıkları
- `setup_reranker.sh` - Otomatik kurulum betiği
