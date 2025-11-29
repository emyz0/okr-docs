# 📦 OKR-DOCS Backup Manifest

**Backup Tarihi:** 29 Kasım 2025
**Proje Boyutu:** 2.3 GB (node_modules + venv'ler dahil)
**Temiz Boyut:** ~300 MB (production ready)

## 🎯 Önemli Dosyalar & Klasörler

### Frontend Code (TypeScript/React)
```
app/
  ├── page.tsx                 # Ana dashboard UI + PDF seçimi
  ├── layout.tsx              # Layout wrapper
  ├── globals.css             # Global CSS
  └── api/
      └── rag/
          ├── upload/route.ts  # PDF upload & chunking (type field eklendi)
          ├── query/route.ts   # Q&A endpoint (reranker integration)
          └── sections/route.ts # Conversation history
```

### Backend Libraries (Python/TypeScript)
```
lib/rag/
  ├── db.ts                   # PostgreSQL connection
  ├── chain.ts                # LLM chain (GPT-4o-mini)
  ├── rerank.ts               # Reranker client (Qwen3-4B)
  ├── document-parser.ts      # Excel, Word, TXT parsing
  ├── image-processing.ts     # Image utilities
  ├── pdf-vlm-analyzer.ts     # VLM integration (4-bit quantization ready)
  └── schema.sql              # Database schema
```

### Python Servers
```
vlm_transformers_server.py    # Qwen2.5-VL-7B-Instruct (port 8001)
                              # 4-bit quantization with fallback
reranker_server.py             # Qwen3-Reranker-4B (port 8000)
                              # CPU-optimized, 180s timeout
```

### Configuration & Docs
```
.env.local                      # API keys (OPENAI_API_KEY, etc)
package.json                    # Node dependencies
next.config.ts                  # Next.js config (Turbopack)
tsconfig.json                   # TypeScript config

SYSTEM_ARCHITECTURE.md          # 🆕 System overview & flow
VLM_ERROR_HANDLING.md           # 🆕 VLM error management
```

### Virtual Environments (EXCLUDE from backup)
```
vlm_env/                        # Python 3.14, transformers, bitsandbytes
reranker_env/                   # Python 3.14, torch, transformers
node_modules/                   # Node packages
.next/                          # Build artifacts
```

---

## ✅ Recent Changes (29 Kasım 2025)

### Code Updates
- ✅ Added `type: "pdf" | "vlm" | "excel" | "word" | "text"` to document metadata
- ✅ Enhanced DOMMatrix polyfill (pdfjs-dist + canvas compat)
- ✅ Improved VLM error handling documentation
- ✅ 4-bit quantization config added to VLM server (RAM optimization)

### Documentation
- ✅ Created SYSTEM_ARCHITECTURE.md (complete flow diagrams)
- ✅ Created VLM_ERROR_HANDLING.md (error scenarios & solutions)

### File Cleanup
- ✅ Deleted vlm_server.py (old HF API version with 32B model)
- ✅ Deleted test_hf_inference.py (deprecated test)

---

## 🚀 Restore Instructions

### 1. Extract from Backup
```bash
# Assuming backup is at /tmp/okr-docs-backup.tar.gz
tar -xzf okr-docs-backup.tar.gz
cd okr-docs
```

### 2. Install Dependencies
```bash
# Frontend
npm install

# VLM environment
python3 -m venv vlm_env
source vlm_env/bin/activate
pip install -r vlm_requirements.txt

# Reranker environment
python3 -m venv reranker_env
source reranker_env/bin/activate
pip install -r reranker_requirements.txt
```

### 3. Setup Environment
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys:
# - OPENAI_API_KEY=sk-proj-...
# - DATABASE_URL=postgresql://...
```

### 4. Start Services
```bash
# Terminal 1: PostgreSQL (pre-installed)
# psql -U postgres

# Terminal 2: VLM Server
source vlm_env/bin/activate
python vlm_transformers_server.py  # Port 8001

# Terminal 3: Reranker Server
source reranker_env/bin/activate
python reranker_server.py           # Port 8000

# Terminal 4: Next.js
npm run dev                         # Port 3000
```

---

## 📊 Service Status

| Service | Port | Model | Status | RAM |
|---------|------|-------|--------|-----|
| Next.js | 3000 | - | ✅ | - |
| VLM | 8001 | Qwen2.5-VL-7B | ⏸️ (DISABLED) | ~4GB (4-bit) |
| Reranker | 8000 | Qwen3-Reranker-4B | ✅ | ~8GB |
| PostgreSQL | 5432 | pgvector | ✅ | - |

**Note:** VLM currently disabled due to RAM constraints (2.6GB free on Mac M4).
- When enabled: Uses 4-bit quantization (~4GB)
- Fallback: PDFLoader chunks work without VLM

---

## 🔑 Critical Configuration

### Environment Variables (.env.local)
```bash
OPENAI_API_KEY=sk-proj-xxxx...
DATABASE_URL=postgresql://user:pass@localhost:5433/vector_db
HUGGINGFACE_API_KEY=hf_xxxx...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Database
- **Host:** localhost:5433
- **Name:** vector_db
- **Tables:**
  - `documents` (chunks with pgvector embeddings)
  - `sections` (conversation history)

### Models Used
- **Embedding:** OpenAI text-embedding-3-small (1536 dims)
- **LLM:** OpenAI GPT-4o-mini (temperature 0.1)
- **Reranker:** Qwen3-Reranker-4B (CPU, 180s timeout)
- **VLM:** Qwen2.5-VL-7B-Instruct (4-bit, optional)

---

## 🐛 Known Issues & Workarounds

| Issue | Cause | Status |
|-------|-------|--------|
| VLM killed on startup | Insufficient RAM (2.6GB free, 4GB needed) | ⏸️ Disabled for now |
| Reranker timeout 180s | CPU-only inference, Qwen3-4B slow | ⚠️ Has fallback scoring |
| File search UI not tested | Browser-side feature | ✅ Code ready, needs test |

---

## 📁 Backup Structure

```
okr-docs/
├── app/                     # Next.js frontend
├── lib/                     # Shared utilities & RAG chain
├── public/                  # Static assets
├── vlm_transformers_server.py
├── reranker_server.py
├── SYSTEM_ARCHITECTURE.md   # 🆕 Required reading
├── VLM_ERROR_HANDLING.md    # 🆕 Required reading
├── package.json
├── tsconfig.json
├── next.config.ts
└── vlm_requirements.txt, reranker_requirements.txt
```

---

**Generated:** 2025-11-29 23:30 UTC
**Backup ID:** okr-docs-main-branch
**Status:** Production Ready (with VLM optional)

