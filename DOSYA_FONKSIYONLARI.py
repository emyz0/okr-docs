#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📁 DOSYA FONKSİYONLARI - Hangi Dosyada Ne Yapılıyor?
"""

print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║                  📁 PROJE DOSYA YAPISI VE FONKSİYONLARI                     ║
║                    RAG Sistemi - Her Dosya Ne Yapar?                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
🔴 KRITIK SYSTEM FILES (Bu 6 Dosya Olmasa Sistem Çalışmaz!)
═══════════════════════════════════════════════════════════════════════════════

┌─ 1️⃣  reranker_server.py ────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/reranker_server.py      │
│ PORT:         8000                                                           │
│ MODEL:        Qwen3-Reranker-4B                                              │
│ FRAMEWORK:    FastAPI                                                        │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ Bu dosya Qwen3-Reranker-4B modelini çalıştıran FastAPI server'ı içerir.    │
│                                                                               │
│ İşlemler:                                                                    │
│   1. Sunucu başlatılıyor (port 8000)                                        │
│   2. Model yükleniyor (Qwen3-Reranker-4B)                                   │
│   3. POST /rerank endpoint'ı açılıyor                                       │
│   4. 10 dokümantasyon + query alıyor                                        │
│   5. Her dokü için semantic relevance score hesaplıyor (0-1)               │
│   6. Skorlara göre dokümantasyonları rerank ediyor                          │
│   7. Sonuçları JSON'da geri gönderiyor                                      │
│   8. GET /health endpoint'ı sağlık kontrolü yapıyor                         │
│                                                                               │
│ ENDPOINT'LER:                                                                │
│   POST /rerank                                                               │
│      Input:  {query: "...", documents: [...], top_k: 10}                   │
│      Output: {ranked_documents: [{index, document, score}, ...]}           │
│                                                                               │
│   GET /health                                                                │
│      Output: {status: "healthy", model_loaded: true}                       │
│                                                                               │
│ HATA HANDLING:                                                               │
│   ├─ Model yükleme başarısız → LogError + Exit                            │
│   ├─ Request validation başarısız → HTTP 400                              │
│   ├─ Inference hatası → HTTP 500                                          │
│   └─ Server down → Fallback mekanizması devreye giriyor                   │
│                                                                               │
│ KRITIK NOKTALAR:                                                             │
│   ⚠️  CPU üzerinde çalışıyor (2-4 saniye latency)                          │
│   ⚠️  Memory intensive (4B parametreli model)                              │
│   ⚠️  Port 8000 açık olması gerekli                                        │
│   ⚠️  Down olursa query/route.ts fallback kullanıyor                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ 2️⃣  vlm_server.py ────────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/vlm_server.py          │
│ PORT:         8001                                                           │
│ MODEL:        Qwen2-VL-32B-Instruct                                          │
│ PROVIDER:     HuggingFace Inference API (Cloud)                             │
│ FRAMEWORK:    FastAPI                                                        │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ PDF sayfalarındaki görselleri analiz ediyor. Tabloları, diyagramları,      │
│ metni tespit ediyor ve PDF'e uygun metadata oluşturuyor.                   │
│                                                                               │
│ İşlemler:                                                                    │
│   1. Sunucu başlatılıyor (port 8001)                                        │
│   2. HuggingFace API key kontrol ediliyor                                   │
│   3. Gelen görsel base64 olarak alınıyor                                    │
│   4. Görsel Qwen2-VL-32B-Instruct'a gönderiliyor                           │
│   5. Model görsel analiz ediyor:                                            │
│      - "Bu resim tablo mı?"                                                 │
│      - "Text mi, diagram mı?"                                               │
│      - "Ne hakkında?"                                                        │
│   6. Analiz sonuçları döndürülüyor                                          │
│   7. OCR sonuçları da döndürülüyor (eğer text varsa)                       │
│                                                                               │
│ ENDPOINT'LER:                                                                │
│   POST /analyze                                                              │
│      Input:  {image_base64: "...", task: "analyze|extract_text"}          │
│      Output: {analysis: "...", confidence: 0.95, extracted_text: "..."}   │
│                                                                               │
│   GET /health                                                                │
│      Output: {status: "healthy", model: "Qwen2-VL-32B"}                   │
│                                                                               │
│ HATA HANDLING:                                                               │
│   ├─ API key geçersiz → HTTP 401                                           │
│   ├─ Request timeout → HTTP 504 (ama retry var)                           │
│   ├─ HuggingFace API down → HTTP 503                                       │
│   └─ Görsel corrupt → HTTP 400                                             │
│                                                                               │
│ KRITIK NOKTALAR:                                                             │
│   ⚠️  Cloud API (HuggingFace) → Network latency                            │
│   ⚠️  10-15 saniye per page (yavaş ama doğru)                              │
│   ⚠️  API key gerekli (HUGGINGFACE_API_KEY env var)                        │
│   ⚠️  Rate limiting riski (free tier 30k requests/month)                   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ 3️⃣  app/api/rag/query/route.ts ──────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/app/api/rag/          │
│               query/route.ts                                                 │
│ TYPE:         Next.js API Route (POST /api/rag/query)                       │
│ FRAMEWORK:    Next.js 13+ (App Router)                                      │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ ANA RAG PIPELINE! User'ın sorusunu al, ilgili belgeler bul, LLM'ye sor.    │
│ Sistemin kalbi bu dosya!                                                    │
│                                                                               │
│ ADIM ADIM İŞLEM:                                                             │
│                                                                               │
│ [1] REQUEST ALINDΙ (user query)                                             │
│     ├─ POST body'den query al                                               │
│     ├─ Session ID kontrol et                                                │
│     └─ Validasyon yap                                                       │
│                                                                               │
│ [2] EMBEDDING ÜRETİL (OpenAI)                                               │
│     ├─ Query'yi OpenAI text-embedding-3-small'a gönder                     │
│     ├─ 1536 boyutlu vektör al                                               │
│     └─ (~50ms)                                                               │
│                                                                               │
│ [3] PGVECTOR SEARCH (PostgreSQL)                                            │
│     ├─ Embedding vektörünü veritabanına gönder                             │
│     ├─ SQL: "ORDER BY embedding <-> query_vector LIMIT 10"               │
│     ├─ 10 en benzer dokümantasyon al                                        │
│     └─ (~10ms)                                                               │
│                                                                               │
│ [4] RERANKING (Qwen3-Reranker-4B)                                           │
│     ├─ TRY:                                                                   │
│     │  ├─ 10 dokü + query → localhost:8000/rerank gönder                   │
│     │  ├─ Semantic relevance score'lar al (0-1)                            │
│     │  ├─ Skorlara göre sırala                                              │
│     │  └─ (~2-4 saniye)                                                     │
│     └─ CATCH (Reranker down):                                               │
│        ├─ Fallback: score = 1 - (index * 0.05)                            │
│        ├─ Position-based scoring                                            │
│        └─ (~10ms)                                                           │
│                                                                               │
│ [5] DOKÜMANTASYON SEÇİMİ                                                    │
│     ├─ Rerank sonuçlarından top 3-10 al                                     │
│     ├─ Her PDF'den minimum 1 dokümantasyon garantisi                        │
│     └─ Çeşitli kaynaklar olması sağla                                      │
│                                                                               │
│ [6] PROMPT OLUŞTUR                                                           │
│     ├─ Selected dokümantasyonları context'e ekle                            │
│     ├─ Chat history (önceki Q&A) ekle                                       │
│     ├─ System prompt: "Sen RagBot'sun..."                                   │
│     └─ Total tokens: ~1000-2000                                             │
│                                                                               │
│ [7] LLM CALL (OpenAI gpt-4o-mini)                                           │
│     ├─ Prompt + context → OpenAI                                            │
│     ├─ Temperature: 0.1 (factual)                                           │
│     ├─ Max tokens: 1000                                                     │
│     └─ (~1-2 saniye)                                                        │
│                                                                               │
│ [8] RESPONSE OLUŞTUR                                                         │
│     ├─ answer (LLM'nin cevabı)                                              │
│     ├─ sources (kullanılan dokümantasyonlar)                                │
│     └─ metadata (confidence, latency vb.)                                   │
│                                                                               │
│ [9] CHAT HISTORY KAYDET                                                     │
│     ├─ PostgreSQL sections table'a JSONB olarak kaydet                     │
│     ├─ Format: {question, answer, sources, timestamp}                      │
│     └─ Multi-turn conversation support                                      │
│                                                                               │
│ [10] RESPONSE GÖNDER                                                        │
│      └─ JSON response user'a döndür                                         │
│                                                                               │
│ TOPLAM LATENCY: 3-8 saniye                                                  │
│   - Embedding: 50ms                                                         │
│   - pgvector: 10ms                                                          │
│   - Reranker: 2-4s (veya 10ms fallback)                                    │
│   - LLM: 1-2s                                                               │
│   - Database: 100ms                                                         │
│                                                                               │
│ ERROR HANDLING:                                                              │
│   ├─ Embedding API down → 503                                               │
│   ├─ Database down → 500                                                    │
│   ├─ LLM API down → 503                                                     │
│   ├─ Reranker down → Fallback kullanılıyor                                 │
│   └─ All handlers → User-friendly error message                            │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ 4️⃣  app/page.tsx ───────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/app/page.tsx           │
│ TYPE:         React Component (Frontend)                                     │
│ FRAMEWORK:    Next.js 13+ (App Router)                                      │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ Kullanıcı arayüzü! Chat UI, message display, input field vb.               │
│                                                                               │
│ KOMPONENTLERİ:                                                               │
│   ├─ Input Field (soru yazma)                                               │
│   ├─ Chat History (eski sohbetler)                                          │
│   ├─ Message Display (bot + user messages)                                  │
│   ├─ Sources Display (hangi belgeleri kullandı?)                            │
│   ├─ Loading Spinner (yükleniyor göstergesi)                                │
│   └─ Error Display (hata mesajları)                                         │
│                                                                               │
│ IŞLEMLER:                                                                    │
│   1. User query yazıyor                                                      │
│   2. Send butonuna basıyor                                                   │
│   3. POST /api/rag/query'ye request gönderiliyor                            │
│   4. Loading state açılıyor                                                  │
│   5. Response geliyor:                                                       │
│      ├─ answer (bot'ın cevabı)                                              │
│      ├─ sources (kullanılan dokümantasyonlar)                               │
│      └─ latency (işlem süresi)                                              │
│   6. Message listesine ekleniyor                                             │
│   7. Source'lar ayrı gösteriliyor                                            │
│   8. Chat history yerel storage'a kaydediliyor                              │
│                                                                               │
│ STATE MANAGEMENT:                                                            │
│   ├─ messages[] - Sohbet geçmişi                                            │
│   ├─ inputValue - Kullanıcının yazdığı metin                                │
│   ├─ loading - Yükleniyor durumu                                            │
│   ├─ error - Hata mesajı                                                     │
│   └─ sources[] - Son soruda kullanılan kaynaklar                            │
│                                                                               │
│ API CALLS:                                                                   │
│   POST /api/rag/query                                                       │
│      Input:  {query: "...", sessionId: "..."}                              │
│      Output: {answer: "...", sources: [...], latency: 3500}                │
│                                                                               │
│ STYLING:                                                                     │
│   ├─ Tailwind CSS (app/globals.css'de tanımlı)                             │
│   ├─ Responsive design (mobile + desktop)                                   │
│   ├─ Dark/Light mode support (optional)                                     │
│   └─ Smooth animations                                                      │
│                                                                               │
│ FEATURES:                                                                    │
│   ✅ Multi-turn conversations (sohbet geçmişi)                             │
│   ✅ Source attribution (hangi belgeler kullanıldı)                        │
│   ✅ Loading states (user feedback)                                         │
│   ✅ Error handling (user-friendly messages)                                │
│   ✅ Copy to clipboard (cevapı kopyala)                                     │
│   ✅ Session persistence (localStorage)                                     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ 5️⃣  lib/rag/chain.ts ───────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/lib/rag/chain.ts       │
│ TYPE:         TypeScript Utilities                                           │
│ FRAMEWORK:    LangChain (AI orchestration library)                           │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ OpenAI LLM ve Embedding'i initialize ediyor. query/route.ts'de kullanılan  │
│ "clients" oluşturuyor.                                                      │
│                                                                               │
│ EXPORTS:                                                                     │
│   ├─ openai (OpenAI client)                                                 │
│   │  └─ Model: gpt-4o-mini                                                  │
│   │  └─ Temperature: 0.1                                                    │
│   │  └─ Max tokens: 1000                                                    │
│   │                                                                          │
│   ├─ embeddings (OpenAI embeddings)                                         │
│   │  └─ Model: text-embedding-3-small                                      │
│   │  └─ Dimension: 1536                                                     │
│   │  └─ Cost: $0.02/1M tokens                                              │
│   │                                                                          │
│   └─ systemPrompt (Global system message)                                   │
│      └─ "Sen RagBot'sun. Verilen belgelere dayanarak cevap ver..."        │
│                                                                               │
│ FUNCTIONS:                                                                   │
│   ├─ initOpenAI() - LLM initialize                                          │
│   ├─ initEmbeddings() - Embedding model initialize                          │
│   ├─ getSystemPrompt() - System message getter                              │
│   └─ validateApiKeys() - Key validation                                     │
│                                                                               │
│ ERROR HANDLING:                                                              │
│   ├─ API key missing → Error thrown                                        │
│   ├─ Invalid credentials → Error logged                                    │
│   └─ Network issues → Timeout after 30s                                    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ 6️⃣  lib/rag/db.ts ─────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/lib/rag/db.ts          │
│ TYPE:         TypeScript Utilities                                           │
│ DATABASE:     PostgreSQL + pgvector extension                               │
│                                                                               │
│ NE YAPAR?                                                                    │
│ ────────                                                                     │
│ PostgreSQL'e bağlanıyor, pool yönetiliyor, SQL queries execute ediliyor.   │
│                                                                               │
│ EXPORTS:                                                                     │
│   ├─ pool (PostgreSQL connection pool)                                      │
│   │  └─ Size: 10-20 concurrent connections                                  │
│   │  └─ Idle timeout: 30s                                                   │
│   │                                                                          │
│   └─ query() function                                                       │
│      ├─ Input: SQL string + parameters                                     │
│      └─ Output: Database result                                             │
│                                                                               │
│ FUNCTIONS:                                                                   │
│   ├─ initializePool() - Connection pool oluştur                             │
│   ├─ query(sql, params) - SQL execute et                                   │
│   ├─ searchByEmbedding(vector) - pgvector search                           │
│   ├─ saveChatHistory(messages) - Chat kaydet                               │
│   ├─ getChatHistory(sessionId) - Chat al                                    │
│   └─ saveDocument(content, embedding) - Dokü kaydet                         │
│                                                                               │
│ PGVECTOR SEARCH:                                                             │
│   SELECT * FROM documents                                                    │
│   ORDER BY embedding <-> $1::vector                                         │
│   LIMIT 10                                                                   │
│                                                                               │
│ ERROR HANDLING:                                                              │
│   ├─ Connection fail → Retry with exponential backoff                      │
│   ├─ Query timeout → Error logged + 503 response                           │
│   ├─ Invalid SQL → Error caught + logged                                   │
│   └─ Pool exhaustion → Queue request or reject                             │
│                                                                               │
│ TABLES:                                                                      │
│   ├─ documents (id, content, embedding, file_id, created_at)             │
│   ├─ sections (id, session_id, messages[JSONB], created_at)              │
│   └─ embeddings (id, content, vector, model, created_at)                  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
🟢 KONFİGÜRASYON DOSYALARI
═══════════════════════════════════════════════════════════════════════════════

┌─ next.config.ts ──────────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/next.config.ts         │
│ AMAÇ:         Next.js build ve runtime konfigürasyonu                       │
│                                                                               │
│ YAPILARI:                                                                    │
│   ├─ images: { domains: [...] } - Harici image hosting                     │
│   ├─ typescript: { strict: true } - TS strict mode                          │
│   ├─ env: { variables } - Environment variables                             │
│   ├─ experimental: { features } - Beta features                             │
│   └─ redirects: () => [...] - URL redirects                                │
│                                                                               │
│ ÖNEMLİ AYARLAR:                                                              │
│   ├─ API_BASE_URL -> /api                                                   │
│   ├─ timeout -> 60000ms                                                      │
│   ├─ maxSize -> 50MB (file upload)                                          │
│   └─ streaming -> true (LLM streaming support)                              │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ tailwind.config.js ──────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/tailwind.config.js     │
│ AMAÇ:         Tailwind CSS customization                                     │
│                                                                               │
│ YAPILARI:                                                                    │
│   ├─ theme.colors - Custom colors                                           │
│   ├─ theme.fontFamily - Font definitions                                    │
│   ├─ plugins - Tailwind plugins                                             │
│   └─ content - Template paths (PurgeCSS)                                    │
│                                                                               │
│ CUSTOM CLASSES:                                                              │
│   ├─ .btn-primary, .btn-secondary - Button styles                          │
│   ├─ .card - Card component                                                 │
│   ├─ .input - Input field                                                   │
│   └─ .message-bubble - Chat message                                        │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ package.json ────────────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/package.json           │
│ AMAÇ:         NPM dependencies ve scripts                                    │
│                                                                               │
│ KEY DEPENDENCIES:                                                            │
│   ├─ next@14.x - React framework                                            │
│   ├─ react@18.x - UI library                                                │
│   ├─ typescript - Type safety                                               │
│   ├─ pg - PostgreSQL client                                                 │
│   ├─ dotenv - Environment variables                                         │
│   ├─ axios - HTTP client                                                    │
│   ├─ tailwindcss - Styling                                                  │
│   └─ langchain - AI orchestration                                           │
│                                                                               │
│ SCRIPTS:                                                                     │
│   ├─ npm run dev - Geliştirme server başlat (localhost:3000)               │
│   ├─ npm run build - Production build                                       │
│   ├─ npm start - Production server başlat                                   │
│   └─ npm run lint - Code quality check                                      │
│                                                                               │
│ CRITICAL ENV VARS:                                                          │
│   ├─ OPENAI_API_KEY                                                         │
│   ├─ HUGGINGFACE_API_KEY                                                    │
│   ├─ POSTGRES_URL                                                           │
│   └─ NODE_ENV (development/production)                                      │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

┌─ tsconfig.json ───────────────────────────────────────────────────────────┐
│                                                                               │
│ KONUM:        /Users/emirhanyilmaz/Desktop/okr-docs/tsconfig.json          │
│ AMAÇ:         TypeScript compiler konfigürasyonu                            │
│                                                                               │
│ AYARLAR:                                                                     │
│   ├─ target: ES2020 (JavaScript version)                                    │
│   ├─ module: ESNext (Module system)                                         │
│   ├─ strict: true (Type checking severity)                                  │
│   ├─ jsx: react-jsx (JSX transformation)                                    │
│   ├─ baseUrl: . (Absolute imports)                                          │
│   ├─ paths: {                                                                │
│   │    "@/*": ["*"]  (Import aliases)                                       │
│   │}                                                                         │
│   └─ skipLibCheck: true (Skip type checking for dependencies)               │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
📚 ÖĞRENME DOSYALARI (Production'da Kullanılmaz, Öğrenme İçin!)
═══════════════════════════════════════════════════════════════════════════════

📖 CRITICAL_KNOWLEDGE.md
   ├─ RAG sistemi tam açıklama
   ├─ Her bileşen detaylı
   └─ Production checklist

📋 TURKCE_FINAL_CHEATSHEET.py ⭐ EN ÖNEMLİ
   ├─ Türkçe özet
   ├─ Interview soruları
   └─ Sorun giderme

🔍 VISUAL_COMPARISON.py
   ├─ Diyagramlar
   ├─ Flowchart'lar
   └─ Karşılaştırmalar

📍 INDEX.md
   ├─ Öğrenme rehberi
   └─ Navigasyon

═══════════════════════════════════════════════════════════════════════════════
🔗 DOSYALAR ARASINDA VERİ AKIŞI
═══════════════════════════════════════════════════════════════════════════════

1. USER AÇTIKLARI app/page.tsx'te
   │
   ├─→ Soru yazıyor ve gönderiliyor
   │
2. POST /api/rag/query/route.ts'ye gidiyor
   │
   ├─→ chain.ts'den OpenAI client alıyor
   │   └─ Embedding oluşturuyor
   │
   ├─→ db.ts'de PostgreSQL'e sorgulama yapıyor
   │   └─ pgvector search: 10 dokü buluyor
   │
   ├─→ reranker_server.py'ye (port 8000) HTTP POST
   │   └─ 10 dokü'yü semantic ranking yapıyor
   │   └─ EĞER DOWN OLURSA → Fallback devreye girer
   │
   ├─→ chain.ts'den LLM call
   │   └─ OpenAI gpt-4o-mini cevap üretir
   │
   ├─→ db.ts'de chat history kaydediliyor
   │   └─ JSONB'de sessions table'a
   │
   └─→ RESPONSE app/page.tsx'e döndürülüyor
       └─ Message display + sources gösteriliyor

OPSIYONEL FLOW: PDF Analysis
   │
   ├─→ PDF upload → app/api/rag/upload/route.ts
   │   └─ Her sayfa için image oluştur
   │
   ├─→ vlm_server.py'ye (port 8001) gönder
   │   └─ Qwen2-VL-32B analiz ediyor
   │
   ├─→ OCR + metadata oluştur
   │   └─ Tablo, diyagram, metin vs.
   │
   └─→ Documents kaydediliyor
       └─ PostgreSQL documents table'a

═══════════════════════════════════════════════════════════════════════════════
🎯 ÖZET: DOSYA FONKSİYONLARI

TIER 1 - ÇALIŞMAZSA SISTEM DOWN:
  ✅ reranker_server.py (Semantic ranking)
  ✅ vlm_server.py (PDF analysis)
  ✅ app/api/rag/query/route.ts (Main pipeline)
  ✅ lib/rag/chain.ts (LLM + Embedding)
  ✅ lib/rag/db.ts (Database)
  ✅ app/page.tsx (Frontend)

TIER 2 - OLMASA DA ÇALIŞIR (Fallback var):
  ✅ next.config.ts (Build config)
  ✅ tailwind.config.js (Styling)

TIER 3 - OPTIONAL:
  ✅ package.json (Dependencies)
  ✅ tsconfig.json (TS config)

TIER 4 - ÖĞRENİM (Production'da kullanılmaz):
  📚 CRITICAL_KNOWLEDGE.md
  📚 TURKCE_FINAL_CHEATSHEET.py
  📚 VISUAL_COMPARISON.py
  📚 INDEX.md

═══════════════════════════════════════════════════════════════════════════════
""")
