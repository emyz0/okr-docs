# 🔧 OKR-DOCS - TEKNİK DETAYLAR VE KOD AÇIKLAMASI

---

## PART 1: TEMEL VERİ YAPILARI

### MongoDB/JSON Yapıları

#### documents Tablosu Örnek:
```json
{
  id: 100,
  file_id: 5,                    // ← PDF's global ID
  user_id: "demo-user",
  content: "Veri tabanı nedir? Bir veri tabanı...",  // 1000 char
  metadata: {
    source: "example.pdf",
    page: 3,
    type: "vlm",               // "vlm" | "text" | "ocr"
    contentType: "table",      // "table" | "diagram" | "text"
    confidence: 0.95,
    has_images: true,
    chunk: 15
  },
  embedding: [0.123, 0.456, ...],  // 1536-dim vector
  created_at: "2025-11-27T..."
}
```

#### sections Tablosu Örnek:
```json
{
  id: 1,
  user_id: "demo-user",
  title: "💬 Konuşma - 27 Kasım 2025",
  messages: [
    {
      question: "Tablo 1 nedir?",
      answer: "Tablo 1 şu bilgileri içerir...",
      sources: [
        {
          source: "document.pdf",
          file_id: 5,
          chunk: 15,
          page: 3,
          has_images: true
        }
      ]
    },
    {
      question: "Kaynaklar neler?",
      answer: "Kaynaklar şunlardır...",
      sources: [...]
    }
  ],
  is_active: true,
  created_at: "2025-11-27T..."
}
```

---

## PART 2: HANGİ FONKSİYON NEREDE?

### UPLOAD PIPELINE

#### route.ts (/api/rag/upload)

```typescript
// ========== SETUP ==========
// OpenAI models yükle
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "text-embedding-3-small"
})

// ========== FILE LOOP ==========
for (const file of files) {
  // Step 1: Dosyayı temp folder'a kaydet
  const tempPath = `/tmp/${sanitizedName}.${ext}`
  fs.writeFileSync(tempPath, buffer)
  
  // Step 2: Metin çıkar (dosya tipi check)
  if (ext === '.pdf') {
    const loader = new PDFLoader(tempPath)
    docs = await loader.load()
  } else if (ext === '.xlsx' || ext === '.xls') {
    docs = await extractTextFromExcel(tempPath)
  } else if (ext === '.docx') {
    docs = await extractTextFromWord(tempPath)
  } else if (ext === '.txt') {
    docs = await extractTextFromTxt(tempPath)
  }
  
  // Step 3: PDF için VLM analiz
  if (ext === '.pdf') {
    const vlmResults = await extractContentWithVLM(tempPath, 20)
    // vlmResults: [{pageNum, analysis, contentType, confidence}, ...]
    
    const vlmChunks = await formatVLMChunks(vlmResults, file.name)
    // vlmChunks: [{content, metadata}, ...]
    
    docs.push(...vlmChunks)
  }
  
  // Step 4: Metadata ekle
  docs = docs.map(doc => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      source: file.name,
      file_type: ext,
      has_images: detectImages(doc)
    }
  }))
}

// ========== CHUNKING & EMBEDDING ==========
// Tüm docs bir liste halinde
const allDocs = []
for (const {file, doc} of allDocsWithFile) {
  allDocs.push(doc)
}

// Recursive splitter
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
})
const chunks = await splitter.splitDocuments(allDocs)

// ========== DATABASE INSERT ==========
for (const chunk of chunks) {
  // Embedding hesapla
  const embedding = await embeddings.embedQuery(chunk.pageContent)
  
  // Database'e kaydet
  await pool.query(
    `INSERT INTO documents 
     (file_id, user_id, content, metadata, embedding)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      fileId,  // Tüm chunks aynı file_id
      userId,
      chunk.pageContent,
      JSON.stringify(chunk.metadata),
      JSON.stringify(embedding)
    ]
  )
}
```

---

### QUERY PIPELINE

#### route.ts (/api/rag/query)

```typescript
// ========== EMBEDDING ==========
const qEmb = await embeddings.embedQuery(question)
// qEmb: [0.123, 0.456, ...] (1536 dim)

// ========== VECTOR SEARCH ==========
const result = await pool.query(`
  SELECT id, file_id, content, metadata, 
         CAST(metadata->>'chunk' AS INTEGER) as chunk_num
  FROM documents
  WHERE user_id = $1
  ${selectedPdfs ? 'AND metadata->>\'source\' = ANY($2)' : ''}
  ORDER BY embedding <-> $${selectedPdfs ? 3 : 2}::vector
  LIMIT 10
`, 
  selectedPdfs 
    ? [userId, selectedPdfs, JSON.stringify(qEmb)]
    : [userId, JSON.stringify(qEmb)]
)

// result.rows: 10 tane dokuman

// ========== RERANKING ==========
try {
  // Qwen sunucusuna gönder
  const qwenResponse = await fetch("http://localhost:8000/rerank", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      query: question,
      documents: result.rows.map(r => r.content.substring(0, 500)),
      top_k: 10
    })
  })
  
  const qwenData = await qwenResponse.json()
  // qwenData.ranked_documents: [{index: 2, score: 0.98}, ...]
  
  rerankResults = qwenData.ranked_documents
} catch (error) {
  // Fallback: Cohere
  const rerankResults = await rerankDocuments({
    query: question,
    documents: result.rows.map(r => ({
      id: r.id,
      text: r.content.substring(0, 500)
    }))
  }, 10)
  // rerankResults: [{index: 2, relevance_score: 0.98}, ...]
}

// ========== CONTEXT HAZIRLA ==========
const selectedIndices = new Set()
const selectedByPdf = new Map()

// Rerank sonuçlarından aşağıya doğru git
for (const rr of rerankResults) {
  const row = result.rows[rr.index]
  const source = row.metadata.source.toLowerCase()
  
  // Eğer bu PDF'den henüz chunk seçilmemişse
  if (!selectedByPdf.has(source)) {
    selectedByPdf.set(source, [])
  }
  
  const docs = selectedByPdf.get(source)
  if (docs.length < 1) {  // Max 1 per PDF
    docs.push(rr.index)
    selectedIndices.add(rr.index)
  }
  
  if (selectedIndices.size >= 10) break
}

// Seçilen rows'ları al
const rankedRows = Array.from(selectedIndices)
  .sort()
  .map(idx => result.rows[idx])

// Contexti formatla
const contexts = rankedRows.map(r => ({
  id: r.id,
  file_id: r.file_id,
  source: r.metadata.source,
  chunk: r.chunk_num,
  page: r.metadata.page,
  excerpt: r.content.slice(0, 600),
  metadata: r.metadata
}))

const contextText = contexts
  .map(c => `Source: ${c.source}\nExcerpt:\n${c.excerpt}`)
  .join('\n\n---\n\n')

// ========== LLM CALL ==========
const prompt = `
Aşağıdaki kaynak bilgilerini kullanarak soruyu cevapla.

KAYNAKLAR:
${contextText}

SORU: ${question}

CEVAP:`

const llmResponse = await llm.invoke(prompt)
const answer = llmResponse.content

// ========== CONVERSATION SAVE ==========
let savedSectionId = sectionId

if (sectionId) {
  // Mevcut messages oku
  const sectionResult = await pool.query(
    `SELECT messages FROM sections WHERE id = $1 AND user_id = $2`,
    [sectionId, userId]
  )
  
  const existingMessages = sectionResult.rows[0].messages || []
  const newMessage = {
    question,
    answer,
    sources: contexts.map(c => ({
      source: c.source,
      file_id: c.file_id,
      chunk: c.chunk,
      page: c.page,
      has_images: c.metadata.has_images
    }))
  }
  
  const updatedMessages = [...existingMessages, newMessage]
  
  // Güncelle
  await pool.query(
    `UPDATE sections SET messages = $1::jsonb WHERE id = $2`,
    [JSON.stringify(updatedMessages), sectionId]
  )
} else {
  // Yeni section oluştur
  const newSectionResult = await pool.query(
    `INSERT INTO sections (user_id, title, messages, is_active)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id`,
    [
      userId,
      `💬 Konuşma - ${new Date().toLocaleString()}`,
      JSON.stringify([{
        question,
        answer,
        sources: contexts.map(c => ({...}))
      }]),
      true
    ]
  )
  
  savedSectionId = newSectionResult.rows[0].id
}

// ========== RESPONSE ==========
return NextResponse.json({
  success: true,
  answer,
  sectionId: savedSectionId,
  sources: contexts
})
```

---

## PART 3: PYTHON SUNUCULARI

### vlm_server.py (PORT 8001)

```python
# ========== STARTUP ==========
@app.on_event("startup")
async def load_model():
    global model, processor, device
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model_name = "Qwen/Qwen3-VL-4B-Instruct"
    processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)
    model = Qwen2VLForConditionalGeneration.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if device.type == "cuda" else torch.float32,
        attn_implementation="flash_attention_2" if device.type == "cuda" else "eager",
        device_map="auto" if device.type == "cuda" else None
    )
    
    if device.type == "cpu":
        model = model.to(device)
    
    model.eval()

# ========== ANALYZE ENDPOINT ==========
@app.post("/analyze")
async def analyze_image(request: VLMRequest):
    # 1. Base64 → Image
    image_data = base64.b64decode(request.image_base64)
    image = Image.open(BytesIO(image_data)).convert("RGB")
    
    # 2. Prompt seç
    prompts = {
        "extract": "Bu görselde neler vardır? Detaylı açıkla.",
        "table": "Tablo var mı? Varsa Markdown'da göster.",
        "diagram": "Diyagram/grafik var mı? Varsa açıkla."
    }
    prompt = prompts.get(request.task, prompts["extract"])
    
    # 3. Model yap
    with torch.no_grad():
        inputs = processor(
            text=prompt,
            images=[image],
            return_tensors="pt"
        ).to(device)
        
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=1024,
            temperature=0.7,
            top_p=0.95
        )
        
        analysis = processor.batch_decode(
            generated_ids,
            skip_special_tokens=True
        )[0]
    
    # 4. Content type belirle
    if "tablo" in analysis.lower() or "|" in analysis:
        content_type = "table"
    elif "diyagram" in analysis.lower():
        content_type = "diagram"
    else:
        content_type = "text"
    
    return VLMResponse(
        task=request.task,
        analysis=analysis,
        confidence=0.95,
        content_type=content_type
    )
```

### reranker_server.py (PORT 8000)

```python
# ========== STARTUP ==========
@app.on_event("startup")
async def load_model():
    global model, tokenizer, device
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    model_name = "Qwen/Qwen3-Reranker-4B"
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        trust_remote_code=True,
        torch_dtype=torch.float32
    ).to(device)
    
    model.eval()

# ========== RERANK ENDPOINT ==========
@app.post("/rerank")
async def rerank(request: RerankerRequest):
    # 1. Pair yap
    pairs = [[request.query, doc] for doc in request.documents]
    
    # 2. Tokenize
    with torch.no_grad():
        inputs = tokenizer(
            pairs,
            padding="max_length",
            truncation=True,
            return_tensors='pt',
            max_length=512
        ).to(device)
        
        # 3. Model
        outputs = model(**inputs)
        scores = outputs.logits[:, 0].cpu().tolist()
    
    # 4. Score + sort
    scored_docs = [
        {
            "index": idx,
            "document": doc,
            "score": float(score)
        }
        for idx, (doc, score) in enumerate(zip(request.documents, scores))
    ]
    
    ranked = sorted(scored_docs, key=lambda x: x["score"], reverse=True)
    top_k = min(request.top_k, len(ranked))
    
    return RerankerResponse(
        query=request.query,
        ranked_documents=ranked[:top_k],
        total_documents=len(request.documents)
    )
```

---

## PART 4: HELPER FUNCTIONS

### document-parser.ts

```typescript
export async function extractTextFromExcel(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer)  // ← Key: buffer-based
  
  let csvText = ""
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    csvText += csv + "\n"
  })
  
  return csvText
}

export async function extractTextFromWord(filePath: string) {
  const result = await mammoth.extractRawText({path: filePath})
  return result.value
}

export async function extractTextFromTxt(filePath: string) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return fs.readFileSync(filePath, 'latin1')  // Fallback
  }
}
```

### pdf-vlm-analyzer.ts

```typescript
export async function extractContentWithVLM(
  pdfPath: string,
  maxPages: number
) {
  const results = []
  
  const pdfBuffer = fs.readFileSync(pdfPath)
  const pdf = await PDFDocument({ data: pdfBuffer }).promise
  const totalPages = pdf.numPages
  const pagesToAnalyze = Math.min(maxPages, totalPages)
  
  for (let i = 1; i <= pagesToAnalyze; i++) {
    // 1. Render
    const base64 = await renderPdfPageToBase64(pdfPath, i)
    
    // 2. VLM analyze
    const analysis = await analyzeImageWithVLM(base64, "extract")
    
    results.push({
      pageNum: i,
      analysis: analysis.analysis,
      contentType: analysis.contentType,
      confidence: analysis.confidence
    })
  }
  
  return results
}
```

---

## PART 5: EDGE CASES & ERROR HANDLING

### Upload'da Hatalar

```typescript
// 1. Dosya boşsa
if (docs.length === 0) {
  console.warn(`⚠️ ${file.name}: Dokuman çıkarılamadı`)
  continue  // ← Devam et
}

// 2. VLM down ise
try {
  const vlmResults = await extractContentWithVLM(...)
} catch (vlmError) {
  console.warn(`⚠️ VLM hatası: ${vlmError}`)
  // Devam et, sadece metin chunks kullan
}

// 3. Embedding API down
try {
  const embedding = await embeddings.embedQuery(chunk.pageContent)
} catch (embError) {
  console.error(`❌ Embedding hatası: ${embError}`)
  throw embError  // ← Durdur, retry lazım
}
```

### Query'de Hatalar

```typescript
// 1. Vector search 0 sonuç
if (result.rows.length === 0) {
  return NextResponse.json({
    success: false,
    answer: "Bu konuda belgelerinizde bilgi bulunamadı.",
    sources: []
  })
}

// 2. Reranker down ise
try {
  const qwenResponse = await fetch("http://localhost:8000/rerank", ...)
} catch (qwenError) {
  console.warn(`⚠️ Qwen down: ${qwenError}`)
  
  // Fallback
  const rerankResults = await rerankDocuments(rerankInput, topK)
}

// 3. LLM API down
try {
  const llmResponse = await llm.invoke(prompt)
} catch (llmError) {
  console.error(`❌ LLM hatası: ${llmError}`)
  // Fallback cevap
  return NextResponse.json({
    success: false,
    answer: "Sistem şu anda cevap veremedi. Lütfen daha sonra deneyin.",
    error: llmError.message
  })
}
```

---

## PART 6: EN YAŞAK HATALAR

```
❌ YANLIŞ KULLANIM:

1. Embedding olmadan vektör arama
   const result = await pool.query(
     "SELECT * FROM documents ORDER BY embedding <-> ..."
   )
   // embedding NULL ise hata!

2. File ID ataması unutmak
   docs = docs.map(d => ({
     ...d,
     metadata: {
       ...d.metadata
       // ⚠️ file_id yok! Tüm chunks farklı dosya gözükür
     }
   }))

3. Reranking sırasında 1000 dokuman gönder
   const qwenResponse = await fetch("http://localhost:8000/rerank", {
     body: JSON.stringify({
       documents: result.rows  // ← 10 olmalı, 1000 değil!
     })
   })

4. VLM sunucusu çalışıp PostgreSQL connection pool down ise
   const embedding = await embeddings.embedQuery(...)
   // ✅ VLM çalışıyor
   
   await pool.query(...)
   // ❌ Database down - embedding'i kaybediyoruz!
```

---

## PART 7: DEBUGGING

### PostgreSQL

```sql
-- Kaç chunk var?
SELECT COUNT(*) FROM documents WHERE user_id = 'demo-user';

-- Embedding NULL mu?
SELECT COUNT(*) FROM documents WHERE embedding IS NULL;

-- File ID neler?
SELECT DISTINCT file_id FROM documents WHERE user_id = 'demo-user';

-- Bir file_id'nin tüm chunks
SELECT id, content FROM documents WHERE file_id = 5 LIMIT 5;

-- Sections'a bakılacak mesajları
SELECT id, title, messages FROM sections WHERE user_id = 'demo-user' LIMIT 1;
```

### TypeScript/JavaScript

```typescript
// VLM response kontrolü
console.log("VLM Response:", JSON.stringify(vlmResults, null, 2))

// Embedding kontrolü
console.log("Embedding shape:", embedding.length)  // 1536 olmalı

// Database query
console.log("Query result:", result.rows.length, "chunks")

// Rerank results
console.log("Rerank scores:", rerankResults.map(r => r.score))
```

### Python

```python
# Model load
print("Device:", device)
print("Model loaded:", model is not None)

# Tokenizer
print("Pad token:", tokenizer.pad_token)

# Inference
with torch.no_grad():
    outputs = model(**inputs)
    print("Output shape:", outputs.logits.shape)  # [batch, 2]
```

---

