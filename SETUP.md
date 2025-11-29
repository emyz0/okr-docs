# 🚀 OKR-DOCS Setup Guide

## Prerequisites

- **Node.js** 18+ (for Next.js 16)
- **Python** 3.11+ (for VLM and Reranker)
- **PostgreSQL** 15+ (for vector storage)
- **2.6+ GB RAM** (for running all services)

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/emyz0/okr-docs.git
cd okr-docs
```

### 2. Setup Environment Variables
```bash
cp .env.local.example .env.local
# Edit .env.local and add your API keys:
# OPENAI_API_KEY=sk-proj-...
# HUGGINGFACE_API_KEY=hf_...
```

### 3. Install Dependencies
```bash
# Option A: One command (all setup)
npm run setup:all

# Option B: Step by step
npm run setup                 # Node.js dependencies
npm run setup:venv           # VLM environment
npm run setup:reranker       # Reranker environment
```

### 4. Setup Database
```bash
# Create database (if not exists)
createdb -U postgres vector_db

# Create schema
npm run db:setup
```

### 5. Start Services (in separate terminals)

**Terminal 1: Next.js Frontend**
```bash
npm run dev
# Opens: http://localhost:3000
```

**Terminal 2: Reranker Server**
```bash
npm run reranker:start
# Service: http://localhost:8000
```

**Terminal 3: VLM Server (Optional)**
```bash
npm run vlm:start
# Service: http://localhost:8001
# Note: Requires ~2GB RAM when active
```

---

## 📊 Service Ports

| Service | Port | Status | Role |
|---------|------|--------|------|
| Next.js | 3000 | ✅ Required | Frontend + API Routes |
| Reranker | 8000 | ✅ Required | Document ranking (Qwen3-4B) |
| VLM | 8001 | ⏸️ Optional | Table/Chart extraction (Qwen2.5-VL-7B) |
| PostgreSQL | 5433 | ✅ Required | Vector storage |

---

## 🔐 Environment Variables

Create `.env.local` from `.env.local.example`:

```bash
# API Keys (Required)
OPENAI_API_KEY=sk-proj-your-key
HUGGINGFACE_API_KEY=hf_your-token

# Database (Required)
POSTGRES_URL=postgresql://postgres:12345@localhost:5433/vector_db

# Frontend (Optional)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

---

## 📚 First Run Workflow

1. **Upload PDF**: Click "📂 Dosyaları Yükle" → Select PDF
   - PDFLoader extracts text chunks
   - OpenAI embeds chunks → 1536 dims
   - Chunks stored in PostgreSQL

2. **Ask Question**: Type question → "❓ Soru Sor"
   - Vector search finds TOP 10 similar chunks
   - Reranker ranks them (Qwen3-4B)
   - GPT-4o-mini generates answer

3. **View Sources**: Cevap altında "Kaynaklar" bölümü
   - Shows which chunks were used
   - PDF name, page, chunk position

---

## 🛠️ Development

### Project Structure
```
okr-docs/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main UI
│   ├── layout.tsx         # Layout
│   └── api/rag/           # RAG endpoints
│       ├── upload/        # PDF upload
│       ├── query/         # Q&A
│       └── sections/      # Conversation
├── lib/rag/               # RAG utilities
│   ├── chain.ts           # LLM chain
│   ├── db.ts              # PostgreSQL
│   ├── rerank.ts          # Reranker client
│   └── schema.sql         # Database schema
├── vlm_transformers_server.py  # VLM (port 8001)
├── reranker_server.py          # Reranker (port 8000)
└── package.json           # Dependencies
```

### Common Commands
```bash
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run vlm:start    # Start VLM server
npm run reranker:start  # Start Reranker
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### PostgreSQL Connection Error
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# If not installed, install it:
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql
```

### VLM Out of Memory
- VLM requires ~2GB RAM minimum
- If system has <2GB free, skip VLM (already optional)
- Check: `vm_stat | grep "Pages free"`

### Reranker Timeout
- First request takes longer (model loading)
- Timeout set to 180 seconds
- Fallback to vector similarity scores if timeout

---

## 📦 Deployment

### Build for Production
```bash
npm run build
npm run start  # or deploy to Vercel
```

### Environment for Production
```bash
# .env.local for production
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://prod-user:prod-pass@prod-host:5433/vector_db
NEXT_PUBLIC_API_URL=https://your-domain.com
```

---

## 🚀 Performance Tips

1. **Vector Search**: Indexed with pgvector IVFFlat (fast retrieval)
2. **Reranking**: CPU-optimized with batch processing (batch_size=4)
3. **Embedding**: OpenAI's small model (1536 dims, fast)
4. **Chunking**: 1000 char chunks with 200 char overlap (context preservation)

---

## 📖 Documentation

- **SYSTEM_ARCHITECTURE.md**: System design & data flows
- **VLM_ERROR_HANDLING.md**: Error scenarios & solutions
- **BACKUP_MANIFEST.md**: Backup & restore instructions

---

**Last Updated:** 30 Nov 2025
**Status:** Production Ready ✅
