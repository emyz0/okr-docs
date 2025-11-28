# 🤖 **AI MODELLERI - KAPSAMLI AÇIKLAMA**

Bu dokümanda sistemde kullanılan tüm AI modellerinin özellikleri, kullanımı, ve kodu açıklanmıştır.

---

## 📊 **Modeller Özet Tablosu**

| Model | Kütüphane | Port | Görev | Girdi | Çıktı |
|-------|-----------|------|-------|-------|-------|
| **OpenAI text-embedding-3-small** | LangChain | API | Metin → Vector | Text (string) | Vector (1536-dim) |
| **OpenAI gpt-4o-mini** | LangChain | API | Soru Cevaplama | Prompt (text) | Response (text) |
| **Qwen3-VL-4B-Instruct** | Transformers | 8001 | Görsel Analiz | Image + Prompt | Analysis (text) |
| **Qwen3-Reranker-4B** | Transformers | 8000 | Dokuman Sıralama | Query + Docs | Ranked scores |

---

# 🌟 **1. OpenAI text-embedding-3-small**

## **Model Nedir?**

Metni sayısal vektöre (embedding) dönüştüren model. Benzer metinler benzer vektörler üretir.

```
"Veri tabanı" → [0.123, 0.456, 0.789, ..., 0.342]  (1536 sayı)
"Database"    → [0.124, 0.455, 0.791, ..., 0.341]  (benzer!)
"Trigonometry" → [0.923, 0.102, 0.234, ..., 0.891] (çok farklı)
```

## **Özellikleri**

| Özellik | Değer |
|---------|-------|
| **Model Adı** | `text-embedding-3-small` |
| **Çıktı Boyutu** | 1536 dimensions |
| **Provider** | OpenAI |
| **Hız** | ~50ms per text |
| **Maliyet** | Uygun (small model) |
| **Dil Desteği** | 100+ dil (Türkçe dahil) |
| **Max Token** | ~8000 characters |

## **Koddaki Kullanımı**

### **Yükleme** (`lib/rag/chain.ts`)
```typescript
import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "text-embedding-3-small",  // ← Model adı
});
```

### **Metin Embedding'i** (`app/api/rag/upload/route.ts`)
```typescript
// Her chunk'ı vektöre çevir
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // Her parça 1000 char
  chunkOverlap: 200,    // Çakışma 200 char
});

const chunks = await textSplitter.splitText(fullText);

// Her chunk'ı embed et
for (const chunk of chunks) {
  const embedding = await embeddings.embedQuery(chunk);
  // embedding = [0.123, 0.456, ..., 0.342] (1536 sayı)
  
  // Database'e kaydet
  await pool.query(
    'INSERT INTO documents (embedding, content, ...) VALUES ($1, $2, ...)',
    [embedding, chunk, ...]  // ← Vektör burada
  );
}
```

### **Soru Embedding'i** (`app/api/rag/query/route.ts`)
```typescript
// Kullanıcının sorusunu embed et
const questionEmbedding = await embeddings.embedQuery(question);
// questionEmbedding = [0.111, 0.222, ..., 0.333] (1536 sayı)

// PostgreSQL'de vector similarity search yap
const results = await pool.query(`
  SELECT * FROM documents
  WHERE user_id = $1
  ORDER BY embedding <-> $2::vector  -- ← pgvector distance operator
  LIMIT 10
`, [userId, JSON.stringify(questionEmbedding)]);

// En benzer 10 chunk döner
```

## **Vector vs Cosine Similarity**

```
Vektör 1: "Veri tabanı"    = [0.1, 0.9, 0.2, ...]
Vektör 2: "Database"       = [0.1, 0.8, 0.2, ...]  ← Benzer!
Vektör 3: "Trigonometry"   = [0.9, 0.1, 0.8, ...]  ← Çok farklı

Cosine Similarity:
- Vektör 1 vs 2: 0.99 (benzer)
- Vektör 1 vs 3: 0.15 (farklı)

pgvector <-> operator = Euclidean distance
(Küçük distance = benzer)
```

## **Özel Parametreler**

```typescript
new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,    // ← API key zorunlu
  modelName: "text-embedding-3-small",     // ← Model seçimi
  // Diğer parametreler:
  // stripNewLines: true,                   // Newline'ları kaldır
  // timeout: 60000,                        // 60 saniye timeout
  // maxRetries: 3,                         // 3 kez retry
});
```

## **Ne İşe Yarar?**

1. **Benzer Metinleri Bulma** - "Database"yi sorsam, "Veri tabanı" bulur
2. **Vector Search** - Hızlı arama (pgvector ile)
3. **RAG'ın Kalbi** - Tüm sistem bu embedding'e bağlı

---

# 🧠 **2. OpenAI gpt-4o-mini**

## **Model Nedir?**

Büyük Dil Modeli (LLM). Soruya doğal dil cevabı verir.

```
İnput:  "Veri tabanı nedir? Kaynaklar: [context]"
Output: "Veri tabanı, yapılandırılmış verilerin depolanması..."
```

## **Özellikleri**

| Özellik | Değer |
|---------|-------|
| **Model Adı** | `gpt-4o-mini` |
| **Ailem** | GPT-4 (güçlü) |
| **Hız** | ~2-5 saniye per query |
| **Maliyet** | Uygun (mini variant) |
| **Context Penceresi** | ~128K tokens (~100K words) |
| **Çıktı** | Natural language text |
| **Temperature** | 0.1 (deterministic) |

## **Koddaki Kullanımı**

### **Yükleme** (`lib/rag/chain.ts`)
```typescript
import { ChatOpenAI } from "@langchain/openai";

export const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "gpt-4o-mini",      // ← Model adı
  temperature: 0.1,              // ← Deterministic cevaplar
});
```

**Temperature Açıklaması:**
- `0.0` = Hiç rastgele, her zaman aynı cevap
- `0.5` = Orta rastgelelik
- `1.0` = Çok rastgele, yaratıcı cevaplar
- **Bizim: 0.1** = Tutarlı, faktual cevaplar (RAG için ideal)

### **LLM Çağrısı** (`app/api/rag/query/route.ts`)
```typescript
// Prompt hazırla
const prompt = `
System: Sen bir asistan'sın. Kullanıcının sorusunu kaynakları kullanarak cevapla.

KAYNAKLAR:
${contextText}

SORU: ${question}

CEVAP:
`;

// LLM'e gönder
const response = await llm.invoke(prompt);
// response.content = "Cevap metni..."

const answer = response.content as string;

// Cevabı ve kaynakları döndür
return {
  answer: answer,
  sources: rankedDocs,
  sectionId: sectionId,
};
```

## **Prompt Engineering**

```typescript
// ❌ KÖTÜ PROMPT
"Tablo 1'deki veriler nelerdir?"

// ✅ İYİ PROMPT (Bizim kullandığımız)
`
System: Sen bir RAG asistanı'sın. Verilen kaynakları kullanarak cevapla. 
Eğer cevap kaynaklarda yoksa "Bilmiyorum" de.

KAYNAKLAR:
[Dökümanlar]

SORU: Tablo 1'deki veriler nelerdir?

Cevap:
`

// ✅ DAHA İYİ (Hiperparametre ayarlanmış)
`
System: Rol: Teknik doküman asistanı
Ton: Profesyonel, açıklayıcı
Dil: Türkçe

Verilen kaynakları SADECE kullan. Bunların dışında bilgi ekleme.

KAYNAKLAR:
[Dökümanlar]

SORU: ${question}

Format: Cevabı madde madde ver. Kaynak referansları ekle.

CEVAP:
`
```

## **Özel Parametreler**

```typescript
new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "gpt-4o-mini",
  temperature: 0.1,               // ← Deterministic
  // Diğer parametreler:
  // maxTokens: 2000,              // Max çıktı 2000 token
  // topP: 0.95,                   // Nucleus sampling
  // presencePenalty: 0,           // Tekrar cezası
  // frequencyPenalty: 0,          // Sıklık cezası
  // timeout: 60000,               // 60 saniye timeout
});
```

## **Ne İşe Yarar?**

1. **Soru Cevaplama** - Context'e göre cevap oluşturur
2. **RAG'ın Beyin'i** - Tüm reasoning burada
3. **Conversation History** - Geçmiş sohbetleri hatırlar

---

# 👁️ **3. Qwen3-VL-4B-Instruct**

## **Model Nedir?**

Vision Language Model (VLM). Görselleri anlayıp metin açıklaması oluşturur.

```
İnput:  Görsel (PDF sayfası, tablo, grafik)
Output: "Bu tablo şu verileri içeriyor: ... Grafik trendi gösteriyor..."
```

## **Özellikleri**

| Özellik | Değer |
|---------|-------|
| **Model Adı** | `Qwen/Qwen3-VL-4B-Instruct` |
| **Aile** | Qwen Vision Language Models |
| **Parametre** | 4 Billion |
| **Türü** | Instruction-tuned (sorulara cevap verir) |
| **Çıktı Boyutu** | ~1536 tokens max |
| **Hız** | ~3-5 saniye per page (CPU'da) |
| **Girdi** | Image (Base64) + Text Prompt |
| **Diller** | Multilingual (Türkçe dahil) |

## **Koddaki Kullanımı**

### **Yükleme** (`vlm_server.py`)
```python
from transformers import AutoProcessor, Qwen3VLForConditionalGeneration
import torch

# Device seç (GPU veya CPU)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# → CPU kullanıyor (CUDA yok)

# Model yükle
processor = AutoProcessor.from_pretrained(
    "Qwen/Qwen3-VL-4B-Instruct",
    trust_remote_code=True  # ← Custom model için gerekli
)

model = Qwen3VLForConditionalGeneration.from_pretrained(
    "Qwen/Qwen3-VL-4B-Instruct",
    torch_dtype=torch.float32,  # CPU'da float32 (GPU'da float16)
    attn_implementation="eager",  # CPU'da eager (GPU'da flash_attention_2)
    device_map=None,  # CPU'da None
    trust_remote_code=True
)

model = model.to(device)
model.eval()  # Evaluation mode
```

### **Görsel Analizi** (`vlm_server.py` - POST /analyze)
```python
@app.post("/analyze")
async def analyze_image(request: VLMRequest):
    # Request formatı:
    # {
    #   "image_base64": "iVBORw0KGgoAAAANS...",
    #   "task": "extract",
    #   "language": "turkish"
    # }
    
    # Base64'ten görsele dönüştür
    image_data = base64.b64decode(request.image_base64)
    image = Image.open(BytesIO(image_data)).convert("RGB")
    
    # Task'a göre prompt seç
    prompts = {
        "extract": "Bu görselde tablo var mı? Diyagram var mı? Sadece cevap: TABLO, DIYAGRAM, GRAFIK, METIN",
        "describe": "Bu görseli detaylı açıkla. Türkçe olarak cevap ver.",
        "table": "Tablo var mı? Varsa içeriğini Markdown'da göster.",
        "diagram": "Diyagram var mı? Varsa ne anlattığını açıkla.",
    }
    
    prompt = prompts.get(request.task, prompts["extract"])
    
    # Model'e gönder
    with torch.no_grad():  # Gradyan hesaplama = OFF (inference için)
        inputs = processor(
            text=prompt,              # ← Text prompt
            images=[image],           # ← Görsel
            return_tensors="pt"       # PyTorch tensor olarak
        ).to(device)
        
        # Inference yap
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=512,       # Max 512 token çıktı
            temperature=0.1,          # Deterministic
            top_p=0.95,               # Nucleus sampling
        )
        
        # Sonucu decode et
        analysis = processor.batch_decode(
            generated_ids, 
            skip_special_tokens=True
        )[0]
    
    # İçerik türünü belirle
    if "tablo" in analysis.lower():
        content_type = "table"
    elif "diyagram" in analysis.lower():
        content_type = "diagram"
    else:
        content_type = "text"
    
    return VLMResponse(
        task=request.task,
        analysis=analysis,
        confidence=0.90,
        content_type=content_type
    )
```

### **Upload Pipeline'da Kullanımı** (`app/api/rag/upload/route.ts`)
```typescript
// 1. PDF sayfalarını render et
for (let i = 1; i <= maxPages; i++) {
  // Sayfayı Base64 görsele çevir
  const base64Image = await renderPdfPageToBase64(pdfPath, i);
  
  // VLM'e HTTP isteği gönder
  const vlmResponse = await fetch('http://localhost:8001/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_base64: base64Image,      // ← Base64 görsel
      task: 'extract',                 // ← Çıkartma görevi
      language: 'turkish'              // ← Türkçe çıktı
    })
  });
  
  const vlmResult = await vlmResponse.json();
  // {
  //   analysis: "Bu tablo şu verileri içeriyor...",
  //   content_type: "table",
  //   confidence: 0.90
  // }
  
  // Sonucu chunks'a dönüştür
  vlmChunks.push({
    content: `[TABLO - Sayfa ${i}]\n\n${vlmResult.analysis}`,
    metadata: {
      source: filename,
      page: i,
      contentType: vlmResult.content_type,
      has_images: true
    }
  });
}
```

## **Özel Parametreler**

```python
# generate() parametreleri
generated_ids = model.generate(
    **inputs,
    max_new_tokens=512,        # Maximum output length
    temperature=0.1,           # Deterministic (0 = hiç randomluk)
    top_p=0.95,               # Nucleus sampling (top %95 prob)
    # Diğer parametreler:
    # do_sample=True,          # Sampling kullan (default)
    # repetition_penalty=1.2,  # Tekrar cezası
    # early_stopping=True,     # Stop when done
    # num_beams=1,             # Beam search (1 = greedy)
)

# Processor parametreleri
processor(
    text=prompt,              # Text instruction
    images=[image],           # List of images
    return_tensors="pt",      # PyTorch tensors
    # Diğer parametreler:
    # padding=True,            # Pad sequences
    # truncation=True,         # Truncate long sequences
    # max_length=1024,         # Max input length
)
```

## **Ne İşe Yarar?**

1. **Tablo Analizi** - Tablo içeriğini anlatır
2. **Diagram Açıklama** - Şemaları, grafikleri açıklar
3. **Görsel Sınıflandırma** - Bu sayfa tablo mı, diagram mı, metin mi?
4. **OCR'dan Üstün** - Sadece metin değil, yapıyı anlar

---

# 🎯 **4. Qwen3-Reranker-4B**

## **Model Nedir?**

Dokuman sıralama modeli. Top 10 dökümanı, relevance'e göre sıralar.

```
İnput:  Query: "Tablo 1'deki veriler?"
        Documents: [doc1, doc2, doc3, ...]
        
Output: Top 3 döküman (relevance score ile)
        doc3: 0.95 (en relevant)
        doc7: 0.87
        doc2: 0.76
```

## **Özellikleri**

| Özellik | Değer |
|---------|-------|
| **Model Adı** | `Qwen/Qwen3-Reranker-4B` |
| **Aile** | Qwen Reranker |
| **Parametre** | 4 Billion |
| **Görevi** | Relevance ranking |
| **Hız** | ~500ms per batch (CPU'da) |
| **Girdi** | Query + Dokuman listesi |
| **Çıktı** | Relevance scores (0-1) |

## **Koddaki Kullanımı**

### **Yükleme** (`reranker_server.py`)
```python
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# → CPU kullanıyor

tokenizer = AutoTokenizer.from_pretrained(
    "Qwen/Qwen3-Reranker-4B",
    trust_remote_code=True
)

model = AutoModelForSequenceClassification.from_pretrained(
    "Qwen/Qwen3-Reranker-4B",
    torch_dtype=torch.float32,  # CPU'da float32
    device_map=None,
    trust_remote_code=True
)

model = model.to(device)
model.eval()
```

### **Reranking** (`reranker_server.py` - POST /rerank)
```python
@app.post("/rerank")
async def rerank(request: RerankerRequest):
    # Request formatı:
    # {
    #   "query": "Tablo 1'deki veriler?",
    #   "documents": [
    #     "Tablo 1: Satış verileri: ...",
    #     "Grafik 2: Trend gösteriyor...",
    #     "Metin 3: Açıklama...",
    #     ...
    #   ],
    #   "top_k": 3
    # }
    
    query = request.query
    documents = request.documents
    top_k = request.top_k
    
    # Rerank için input hazırla
    # Format: "query [SEP] document"
    pairs = [
        f"{query} [SEP] {doc}" 
        for doc in documents
    ]
    
    # Tokenize
    with torch.no_grad():
        inputs = tokenizer(
            pairs,
            padding=True,           # Pad to same length
            truncation=True,        # Truncate long sequences
            return_tensors="pt",    # PyTorch tensors
            max_length=512          # Max input length
        ).to(device)
        
        # Model inference
        logits = model(**inputs).logits
        # logits.shape = (batch_size, 1)
        
        # Softmax → probabilities
        scores = torch.softmax(logits, dim=-1)[:, 1]
        # scores.shape = (batch_size,)  [0.1, 0.95, 0.7, ...]
    
    # Sıralama
    ranked_indices = torch.argsort(scores, descending=True)[:top_k]
    
    # Sonuç
    ranked_documents = [
        {
            "index": int(idx),
            "score": float(scores[idx]),
            "document": documents[int(idx)]
        }
        for idx in ranked_indices
    ]
    
    return {
        "query": query,
        "ranked_documents": ranked_documents,
        "top_k": top_k
    }
```

### **Query Pipeline'da Kullanımı** (`app/api/rag/query/route.ts`)
```typescript
// 1. Vector search: Top 10 döküman bul
const searchResults = await pool.query(`
  SELECT * FROM documents
  WHERE user_id = $1
  ORDER BY embedding <-> $2::vector
  LIMIT 10
`, [userId, JSON.stringify(questionEmbedding)]);

const topDocuments = searchResults.rows;  // 10 döküman

// 2. Reranker'a gönder
const rerankerResponse = await fetch('http://localhost:8000/rerank', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: question,                          // ← Query
    documents: topDocuments.map(d => d.content),  // ← Top 10 docs
    top_k: 3                                  // ← En iyi 3 iste
  })
});

const rerankerResult = await rerankerResponse.json();
// {
//   ranked_documents: [
//     { index: 5, score: 0.92, document: "..." },  // En relevant
//     { index: 2, score: 0.87, document: "..." },
//     { index: 8, score: 0.76, document: "..." }
//   ]
// }

// 3. Top 3'ü seç
const bestDocuments = rerankerResult.ranked_documents
  .slice(0, 3)
  .map(r => topDocuments[r.index]);

// 4. LLM'e gönder
const context = bestDocuments
  .map(d => d.content)
  .join("\n\n---\n\n");

const answer = await llm.invoke(`
  KAYNAKLAR:
  ${context}
  
  SORU: ${question}
  
  CEVAP:
`);
```

## **Özel Parametreler**

```python
# Tokenizer parametreleri
inputs = tokenizer(
    pairs,
    padding=True,           # Pad to max length
    truncation=True,        # Truncate > max_length
    return_tensors="pt",    # PyTorch tensors
    max_length=512          # Max input length
)

# Model parametreleri
logits = model(**inputs).logits
# logits: (batch_size, num_labels)
# num_labels = 2 (relevant/not relevant)

scores = torch.softmax(logits, dim=-1)[:, 1]
# [:, 1] = "relevant" class'ın probability'si
# Range: 0.0 - 1.0
```

## **Ne İşe Yarar?**

1. **Sıralama** - 10 dökümanı relevance'e göre sıralar
2. **Kalite** - Kötü dokumalarını filtrer
3. **Efficiency** - LLM'e sadece en iyi 3'ü gönder
4. **Fallback** - Qwen down ise Cohere kullan

---

# 🔗 **BÜTÜN AKIŞ: MODELLER NASIL BİRLİKTE ÇALIŞIR?**

## **Upload Akışı**

```
1. User: PDF yükle
   ↓
2. Upload Route
   ├─ PDFLoader → Sayfalardaki metni çıkar
   ├─ VLM (Port 8001) → Her sayfa: "Bu tablo mı?"
   │  └─ Qwen3-VL-4B: Görsel analiz → "Evet, tablo"
   ├─ Chunking → 1000 char parçalara böl
   ├─ Embeddings (OpenAI API) → Her chunk'ı 1536-dim vektöre çevir
   │  └─ text-embedding-3-small: "Veri tabanı" → [0.123, ...]
   └─ Database → PostgreSQL'e kaydet
      
Sonuç: documents tablosunda 1000+ satır
```

## **Query Akışı**

```
1. User: "Tablo 1'deki veriler neler?"
   ↓
2. Query Route
   ├─ Embeddings (OpenAI) → "Tablo 1'deki veriler neler?" → [0.111, ...]
   │  └─ text-embedding-3-small: Soruyu vektöre çevir
   │
   ├─ Vector Search (PostgreSQL pgvector)
   │  └─ Benzer 10 chunk → SELECT ... ORDER BY <-> LIMIT 10
   │
   ├─ Reranker (Port 8000) → Top 10'u sırala → Top 3 seç
   │  └─ Qwen3-Reranker-4B: Query vs Doc relevance → scores
   │
   ├─ LLM (OpenAI API) → Cevap oluştur
   │  └─ gpt-4o-mini: "Tablo 1 şu verileri içeriyor..."
   │
   └─ Response → User'a cevabı ve kaynakları gönder
   
Sonuç: "Cevap + Kaynaklar"
```

---

# 📊 **MODELLER KARŞILAŞTIRMASI**

## **Hız (CPU'da)**

```
OpenAI text-embedding-3-small:  ~50ms
Qwen3-Reranker-4B:              ~500ms (10 docs)
Qwen3-VL-4B-Instruct:           ~3-5s (sayfa başına)
OpenAI gpt-4o-mini:             ~2-5s (soruya göre)

Total Query Time (örnek):
- Embed soru:     50ms
- Vector search:  100ms
- Reranking:      500ms
- LLM:            3-5s
_______________
Total: ~3.7-5.7 saniye
```

## **Maliyet (aylık tahmini, 1000 query)**

```
OpenAI text-embedding-3-small:  ~ $1-2
OpenAI gpt-4o-mini:              ~ $10-20
Qwen3-Reranker-4B (local):       $0 (one-time 8GB disk)
Qwen3-VL-4B-Instruct (local):    $0 (one-time 8GB disk)
_______________
Total: ~$11-22/ay
```

## **Kalite (0-10 scale)**

```
Embedding (Relevance):           8/10  (text-embedding-3-small çok iyi)
LLM (Cevap Kalitesi):            9/10  (gpt-4o-mini çok güçlü)
Reranker (Sıralama Doğruluğu):   8/10  (Qwen3-Reranker çok iyi)
VLM (Görsel Anlama):             7/10  (Qwen3-VL CPU'da yavaş ama doğru)
```

---

# 🎛️ **HIPERPARAMETER AYARLAMA**

## **Temperature (Rasgelelik)**

```typescript
// Şu an: temperature = 0.1

// Değiştirmek istersen:
// 0.0 = Tamamen deterministik (test/production)
// 0.5 = Orta (balanced)
// 1.0 = Yaratıcı (brainstorming)

// Kod:
export const llm = new ChatOpenAI({
  temperature: 0.1,  // ← Burası
});
```

## **Chunk Size (Parça Büyüklüğü)**

```typescript
// Şu an: 1000 char

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // ← Burası
  chunkOverlap: 200,
});

// Değiştirmek istersen:
// 500 = Daha küçük chunk → daha fazla, ama az context
// 2000 = Daha büyük chunk → az chunk, daha fazla context
```

## **Top K (Vector Search)**

```typescript
// Şu an: LIMIT 10

const results = await pool.query(`
  SELECT * FROM documents
  ORDER BY embedding <-> $1::vector
  LIMIT 10  -- ← Burası
`);

// Değiştirmek istersen:
// 5 = Daha az → hızlı ama az döküman
// 20 = Daha fazla → daha kapsamlı ama yavaş
```

## **Reranker Top K**

```typescript
// Şu an: top_k = 3

const rerankerResult = await fetch('http://localhost:8000/rerank', {
  body: JSON.stringify({
    top_k: 3  // ← Burası
  })
});

// Değiştirmek istersen:
// 1 = Sadece en iyi 1
// 5 = Top 5
// (LLM'e gönderilecek context miktarını etkiler)
```

---

# 🐛 **SORUN ÇÖZME**

## **"VLM yanıt vermiyor"**

```bash
# 1. Check health
curl http://localhost:8001/health

# 2. Check logs
tail -100 vlm_server.log

# 3. Restart
pkill -f vlm_server
source vlm_env/bin/activate
python3 vlm_server.py &
```

## **"Reranker çok yavaş"**

```python
# Sebep: CPU'da çalışıyor
# Çözüm: GPU yap

# reranker_server.py
device = torch.device("cuda")  # CUDA enable et

# GPU var mı check:
nvidia-smi
```

## **"Embedding kalitesi kötü"**

```typescript
// Sebep: Model yanlış seçilmiş
// Çözüm: Daha iyi model kullan

new OpenAIEmbeddings({
  modelName: "text-embedding-3-large"  // small → large
  // ama 3x pahalı ve yavaş
});
```

---

**Sonuç:** Bu 4 model birlikte çalışarak eksiksiz bir RAG sistemi oluştururlar. Her modelin kendi işi, kendi parametreleri, kendi optimizasyonu var. 🚀
