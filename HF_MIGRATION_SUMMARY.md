# ✅ HUGGING FACE INFERENCE - KURULUM ÖZET

## 🎯 Ne Değişti?

| Önceki | Şimdi |
|--------|-------|
| Lokal VLM (4B parametre) | **Hugging Face Inference API (32B/14B)** |
| Lokal GPU/CPU gerekli | **İnternet bağlantısı gerekli** |
| Yavaş (CPU'da) | **Hızlı (cloud'da)** |
| 4 Milyar parametre | **32 Milyar parametre (daha güçlü)** |
| Tesseract OCR | **Yalnızca VLM** |

---

## 📝 YAPMAMAN GEREKENLER

**❌ YAPMAYACAĞIZ:**
- Lokal olarak 32B model indirmek (200+ GB disk)
- GPU satın almak
- Model training yapılmayacak

**✅ YAPACAĞIZ:**
- HuggingFace API token'ı almak (3 dakika)
- `.env.local` dosyasına token'ı eklemek
- `pip install httpx huggingface-hub` (1 dakika)
- Yeni `vlm_server.py` başlatmak

---

## 🚀 HIZLI BAŞLANGAÇ (5 DAKIKA)

### Adım 1: Hugging Face Token Oluştur
```
URL: https://huggingface.co/settings/tokens
✅ "New token" → Name: "okr-docs" → Type: "Read" → Create
📋 Token'ı kopyala: hf_aBcDeFg...
```

### Adım 2: .env.local'a Ekle
```bash
# Dosya: /Users/emirhanyilmaz/Desktop/okr-docs/.env.local

HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE
```

### Adım 3: Dependencies Yükle
```bash
source vlm_env/bin/activate
pip install -r vlm_requirements.txt
```

### Adım 4: VLM Sunucusunu Başlat
```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs
source vlm_env/bin/activate
python3 vlm_server.py &
```

### Adım 5: Kontrol Et
```bash
curl http://localhost:8001/health
```

**Beklenen çıktı:**
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen2-VL-32B-Instruct",
  "type": "hugging_face_inference",
  "api_key_set": true
}
```

---

## 🔧 MODEL SEÇİMİ

Dosya: `vlm_server.py` → Satır 35-39

```python
ACTIVE_MODEL = "32b"  # ← Buraya karar ver

# "32b" = Daha güçlü, biraz yavaş (10-15s/page)
# "14b" = Yeterli, hızlı (5-8s/page)
```

---

## 💻 DOSYA DURUMU

✅ **YENI DOSYALAR:**
- `vlm_server.py` - Hugging Face Inference kullanıyor (yeni)
- `HUGGINGFACE_SETUP.md` - Kurulum rehberi (detaylı)

📦 **BACKUP:**
- `vlm_server_local.py.bak` - Eski lokal VLM (gerekirse restore et)

🗑️ **KALDIRILAN:**
- Tesseract.js dependency (package.json'dan)
- torch, transformers, opencv (vlm_requirements.txt'ten)

✅ **DEĞİŞMEDİ:**
- Upload route (`app/api/rag/upload/route.ts`)
- Query route (`app/api/rag/query/route.ts`)
- Reranker server (`reranker_server.py`)
- Database (`lib/rag/db.ts`)

---

## 🧪 TEST ADIMLARI

```bash
# 1. Terminal 1: Log'u izle
tail -f vlm_server.log

# 2. Terminal 2: Server'ı başlat
python3 vlm_server.py

# 3. Terminal 3: Health check
curl http://localhost:8001/health | python3 -m json.tool

# 4. Frontend'de PDF yükle
# http://localhost:3001 → Upload PDF → Kontrol et

# 5. Logs'da "HF API'ye istek gönderiliyor..." göreceksin
```

---

## 💰 MALIYT HEÜ

**Free Tier:** ~30,000 requests/ay
**Paid:** ~$0.000001-0.000003 per token

Örnek: 100 sayfalık PDF = ~$0.001 (çok ucuz)

---

## ⚠️ SORUN ÇÖZME

### Hata: `API key not set`
```bash
# .env.local kontrol et
cat .env.local | grep HUGGINGFACE_API_KEY
```

### Hata: `504 Gateway Timeout`
- Model ilk kez loading (1-2 dakika bekle)
- Veya 14B model'e geç (daha hızlı)

### Hata: `Connection refused`
- VLM server başlamadı
- `python3 vlm_server.py` başlatmayı dene

---

## 📚 İLGİLİ DÖKÜMANLAR

- `HUGGINGFACE_SETUP.md` - Detaylı kurulum (oku!)
- `MODELS_EXPLAINED.md` - Tüm modeller açıklandı
- `QUICK_REFERENCE.md` - Hızlı referans

---

## ✅ SÜREÇTİ ÖZETİ

1. ✅ VLM sunucusu HF Inference'e geçirildi
2. ✅ Güçlü model (32B) tercih edildi
3. ✅ Requirements güncellendi (httpx, huggingface-hub)
4. ✅ Python syntax kontrol edildi
5. ⏳ **ADIM: Token oluşturup .env.local'a ekle**
6. ⏳ **ADIM: Server başlat ve test et**

---

**SONRAKI ADIM:** Hugging Face hesabından token oluştur ve kurulum rehberini takip et! 🚀
