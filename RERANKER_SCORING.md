# 🎯 RERANKER SCORE AÇIKLAMASI

## Score Nedir?

**Score**, Qwen Reranker modeli tarafından **Query ile Dokümantasyon arasındaki relevance (ilişkili olma derecesini)** ölçen bir sayıdır.

```
Query: "Türkiye'nin başkenti neresi?"
       ↓
   [Reranker Model - 4 Milyar Parametre]
       ↓
Chunk 1: "Ankara, başkenti..." → Score: 0.95 (Çok ilgili!)
Chunk 2: "İstanbul, en büyük..." → Score: 0.62 (Az ilgili)
Chunk 3: "Ege Bölgesi..." → Score: 0.23 (Hiç ilgili değil)
```

---

## Score Nasıl Çalışır?

### 1️⃣ **Neural Network Processing**
```
Query Text → [Embedding]
            → [Attention Layers] 
            → [Transformer Blocks]
            → Similarity Score
        ↑
Dokümantasyon Text → [Embedding]
```

### 2️⃣ **Score Hesaplaması**
- Model, query ve dokümantasyonu **semantic olarak karşılaştırır**
- **Kelime eşleşmesi değil**, **anlam benzerliği** ölçer
- Score değeri genellikle **0-1 arası** (veya negatif olabilir)

### 3️⃣ **Örnek:**
```
Query: "Türkiye'nin başkenti neresi?"

Chunk A: "Ankara, Türkiye'nin başkenti. Atatürk tarafından..."
Score: 0.92 ✅ (Tam eşleşme, tüm kelimeler var)

Chunk B: "İstanbul, Türkiye'nin en büyük şehri..."
Score: 0.45 ⚠️ (Türkiye var ama başkenti değil)

Chunk C: "Matematik Kanunu hakkında..."
Score: -0.15 ❌ (Hiç ilgili değil, negatif score)
```

---

## Score Özellikleri

| Özellik | Açıklama |
|---------|----------|
| **Yüksek Score** (0.8+) | Çok ilgili, model bunu seç |
| **Orta Score** (0.4-0.8) | Biraz ilgili, alternatif |
| **Düşük Score** (0-0.4) | Çok az ilgili, son seçenek |
| **Negatif Score** (<0) | Hiç ilgili değil, gözardı et |

---

## BİZ Score'ı Belirlemiyoruz!

### ❌ YAPMIYORUZ
```python
score = manual_calculation()  # ← ÖZ belirliyoruz
```

### ✅ YAPILIYOR
```python
# Qwen Reranker modeli otomatik hesaplıyor
reranker_model = Qwen3-Reranker-4B
scores = model.score(query, documents)  # Model belirliyor!
```

---

## Reranker Model Mimarisi

```
Qwen/Qwen3-Reranker-4B
├─ 4 Milyar Parametre
├─ 40 Transformer Layer
├─ 4 Attention Head
├─ 3072 Hidden Dimension
└─ Multilingual Support (Türkçe dahil)

Eğitim Verileri:
├─ Milyarlarca query-dokümantasyon çifti
├─ Natural queries
├─ Long-form dokümantasyonlar
└─ Relevance labels
```

---

## Test Sonucunda Göreceğin Bilgiler

```
🎯 TAM SKORLAR (Reranker tarafından hesaplanan):

   Chunk [0] Score:   0.925341 | Ankara, başkenti...
   Chunk [1] Score:   0.456782 | İstanbul, en büyük...
   Chunk [2] Score:   0.123456 | Ege Bölgesi...
   Chunk [3] Score:  -0.234567 | Dış Ticaret Kanunu...
   Chunk [4] Score:   0.345678 | Marmara Bölgesi...

📊 SIRALANMIŞ SONUÇLAR:

🥇 RANK #1
   Chunk [0] Score: 0.925341 (100%)
   Bar: [████████████████████]

🥈 RANK #2
   Chunk [4] Score: 0.345678 (37%)
   Bar: [████████░░░░░░░░░░░░]

...
```

---

## Score'lar Nereden Geliyor?

### 1. **Pre-training**
- Qwen 32B base model'den fine-tune edildi
- Çin'deki Alibaba tarafından eğitildi

### 2. **Fine-tuning**
- Milyarlarca query-dokümantasyon çifti
- Relevant/irrelevant labels
- LLaMA-like architecture

### 3. **Output**
- Logit → Softmax → Score (0-1)
- Top-1 score'u max score'a göre normalize edilir

---

## Neden Reranker Gerekli?

### ❌ Sadece Vector Search
```
Query embedding: [0.1, 0.2, 0.3, ...]  (1536 dim)

Vector distances (Cosine similarity):
├─ Chunk A: 0.85 (En yakın)
├─ Chunk B: 0.82
└─ Chunk C: 0.81 (Neredeyse eşit!)

Problem: Bilenmiş sorguların benzerlikleri çok yakın
```

### ✅ Vector Search + Reranker
```
Vector search → Top 10 chunk
     ↓
Reranker (Semantic understanding)
     ↓
Top 3 chunk (Daha iyi sıralama)
     ↓
LLM'e gönder
```

---

## Test Komutu

```bash
cd /Users/emirhanyilmaz/Desktop/okr-docs
python3 test_reranker.py
```

**Beklenen Output:**
- 5 chunk'ın score'ları
- Hangi chunk en ilgili (highest score)
- Visual bar chart
- Anlam analizi

---

## Pratik Örnek

```
SORGU: "Türkiye'nin başkenti neresi? Ankara hangi bölgede yer alır?"

Chunk [0]: "Ankara, Türkiye'nin başkenti. Anadolu'nun ortasında..."
Score: 0.95 ✅ (Query'de "başkenti" var, tam eşleşme)

Chunk [1]: "İstanbul, Türkiye'nin en büyük şehri..."
Score: 0.62 ⚠️ (Türkiye var ama başkenti değil)

Chunk [2]: "Ege Bölgesi, batı sahilinde..."
Score: 0.23 ❌ (Hiç ilgili değil)

Chunk [3]: "Dış Ticaret Kanunu..."
Score: -0.15 ❌ (Negatif, tamamı farklı konu)

Chunk [4]: "Marmara Bölgesi, İstanbul, Bursa..."
Score: 0.45 ⚠️ ("bölge" kelimesi var ama başkent değil)

SONUÇ: Chunk [0] seç → Doğru cevap verildi! 🎉
```

---

## Önemli Notlar

1. **Score'ları BİZ belirlemiyoruz** ← Model hesaplıyor
2. **Score'lar Türkçe farkındadır** ← Qwen multilingual
3. **Sıralama otomatiktir** ← En yüksek score en üstte
4. **Fallback var** ← Reranker down ise Cohere kullan

---

**Sonuç:** Reranker, Vector Search'ten çok daha doğru sıralama yapıyor! 🚀
