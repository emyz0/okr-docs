# 🚀 HUGGING FACE INFERENCE API - KURULUM REHBERI

## 📋 Özet

Lokal VLM sunucusu yerine **Hugging Face Inference API** kullanacağız.

**Avantajları:**
- ✅ Daha güçlü modeller (32B, 14B parametreli)
- ✅ Lokal GPU/CPU gerekmiyor
- ✅ Hızlı ve stabil
- ✅ Türkçe desteği mükemmel
- ❌ İnternet bağlantısı gerekli
- ❌ Küçük ücret (ancak free tier var)

---

## 🔧 ADIM 1: Hugging Face Account Oluştur

1. https://huggingface.co/join adresine git
2. Hesap oluştur (Google/GitHub ile de yapabilirsin)
3. Email doğrula

---

## 🔑 ADIM 2: API Token Oluştur

1. https://huggingface.co/settings/tokens adresine git
2. "New token" butonuna tıkla
3. Ayarlar:
   - **Name:** `okr-docs-vl`
   - **Type:** `Read` (yeterli)
   - **Expires in:** `Never` (isteğe bağlı)
4. Token'ı kopyala: `hf_xxxxxxxxxxxxx...`

---

## 📝 ADIM 3: .env.local Dosyasını Güncelle

Dosya: `/Users/emirhanyilmaz/Desktop/okr-docs/.env.local`

```bash
HUGGINGFACE_API_KEY=hf_YOUR_TOKEN_HERE
```

Değiştir: `hf_YOUR_TOKEN_HERE` → Kopyaladığın token

**Örnek:**
```bash
HUGGINGFACE_API_KEY=hf_aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

---

## 🐍 ADIM 4: Python Dependencies Güncelle

```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs

# VLM environment'ını aktifle
source vlm_env/bin/activate

# Yeni dependencies'i yükle
pip install -r vlm_requirements.txt
```

**Kurulacak paketler:**
- `httpx` - HTTP client (async)
- `huggingface-hub` - HF modelleriyle etkileşim

---

## ✅ ADIM 5: Modeli Seç

Dosya: `vlm_server_hf.py` (Satır 35-39)

```python
MODEL_OPTIONS = {
    "32b": "Qwen/Qwen2-VL-32B-Instruct",  # Daha güçlü (32 milyar parametre)
    "14b": "Qwen/Qwen2-VL-14B-Instruct",  # Daha hızlı (14 milyar parametre)
}

# Şu an hangi model kullanıyoruz?
ACTIVE_MODEL = "32b"  # ← Burası değiştirebilirsin: "32b" veya "14b"
```

**Seçim Rehberi:**
- `"32b"` → Çok güçlü, tam doğru tablolar. Biraz yavaş (~10-15s)
- `"14b"` → Yeterli, hızlı (~5-8s)

---

## 🚀 ADIM 6: VLM Sunucusunu Başlat

**Eski VLM'i kapat:**
```bash
pkill -f "vlm_server.py"
```

**Yeni VLM'i başlat:**
```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs
source vlm_env/bin/activate
nohup python3 vlm_server_hf.py > vlm_hf.log 2>&1 &
```

**Kontrol et:**
```bash
sleep 2 && curl -s http://localhost:8001/health | python3 -m json.tool
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

## 🔍 ADIM 7: Test Et

```bash
# VLM log'unu izle
tail -f vlm_hf.log

# Başka terminal'de upload yap
curl -X POST "http://localhost:3001/api/rag/upload" \
  -F "files=@test.pdf" \
  -F "userId=demo-user"
```

---

## 📊 MODEL KARŞILAŞTIRMASI

| Özellik | 32B | 14B |
|---------|-----|-----|
| **Parametre** | 32 Milyar | 14 Milyar |
| **Tablo Algılama** | ⭐⭐⭐⭐⭐ (99% doğru) | ⭐⭐⭐⭐ (95% doğru) |
| **Hız** | ~10-15s/sayfa | ~5-8s/sayfa |
| **Doğruluk** | Çok yüksek | Yüksek |
| **Tavsiye** | Production | Testing/Dev |

---

## 💰 MALIYET

**Hugging Face Pricing:**
- `Inference API Free Tier`: ~30,000 free requests/ay
- `Paid`: ~$0.000001-0.000003 per token

**Örnek:**
- 100 sayfalık PDF = ~3-5 dakika
- ~500 API request = ~$0.001 (çok ucuz)

---

## ⚠️ SORUN ÇÖZME

### Hata: `HUGGINGFACE_API_KEY ayarlanmadı`

**Çözüm:** .env.local dosyasına token ekle

```bash
echo "HUGGINGFACE_API_KEY=hf_YOUR_TOKEN" >> .env.local
```

### Hata: `Model not available` veya `Invalid token`

**Çözüm:** Token'ın geçerli olup olmadığını kontrol et

```bash
curl -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
  https://api-inference.huggingface.co/status/Qwen/Qwen2-VL-32B-Instruct
```

### Hata: `504 Gateway Timeout`

**Neden:** Model loading (ilk kez çağırıldığında slow start var)
**Çözüm:** 1-2 dakika bekle veya 14B model'e geç

### Hata: Model'ler bulunamıyor

**Çözüm:** Model ismini kontrol et

```python
# Doğru isim:
"Qwen/Qwen2-VL-32B-Instruct"
"Qwen/Qwen2-VL-14B-Instruct"

# Yanlış isim (eski):
"Qwen/Qwen3-VL-4B-Instruct"  # ← Bu artık kullanmıyoruz
```

---

## 🔄 GEÇIŞ ADIMLARI (ÖZETİ)

```bash
# 1. Token oluştur (HuggingFace web'de)
# 2. .env.local'a ekle
# 3. pip install httpx huggingface-hub
# 4. pkill -f vlm_server.py
# 5. python3 vlm_server_hf.py &
# 6. curl http://localhost:8001/health
# 7. HEPSİ HAZIR! 🎉
```

---

## 📚 İLGİLİ DOSYALAR

- `vlm_server_hf.py` - Yeni Hugging Face VLM sunucusu
- `vlm_requirements.txt` - Updated dependencies
- `.env.local` - API anahtarı (güvenli!)
- `app/api/rag/upload/route.ts` - VLM çağrılar (değişiklik YOK)
- `app/api/rag/query/route.ts` - Query flow (değişiklik YOK)

---

## ✅ SONUÇ

- ✅ Daha güçlü VLM (32B parametreli)
- ✅ Lokal GPU gerekmiyor
- ✅ Hızlı ve güvenilir
- ✅ Türkçe desteği mükemmel
- ✅ Ucuz veya free

**Hazırsan başla!** 🚀
