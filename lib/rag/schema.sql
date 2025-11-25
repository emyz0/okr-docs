-- PostgreSQL Schema for RAG Documents
-- Bu dosyayı psql ile çalıştır: psql -U postgres -d vector_db -f lib/rag/schema.sql

-- pgvector extension'ı aktifleştir
CREATE EXTENSION IF NOT EXISTS vector;

-- documents tablosu
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  file_id SERIAL NOT NULL,                    -- 🆔 Her PDF/dosya için unique ID (TÜM CHUNKS BU ID'YE SAHİP)
  user_id VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops);

-- news_articles tablosu (haber yönetimi için)
CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  haber_kodu VARCHAR(100) UNIQUE,
  title VARCHAR(500) NOT NULL,
  subtitle VARCHAR(500),
  body TEXT NOT NULL,
  category VARCHAR(100),
  ai_score FLOAT,
  bias_score FLOAT,
  bias_explanation TEXT,
  legal_risk VARCHAR(50),
  seo_keywords TEXT[],
  readability_score FLOAT,
  requires_manual_review BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- news_images tablosu
CREATE TABLE IF NOT EXISTS news_images (
  id SERIAL PRIMARY KEY,
  haber_kodu VARCHAR(100),
  resim_kodu VARCHAR(100),
  full_url TEXT,
  thumb_url TEXT,
  base64_data TEXT,
  description TEXT,
  order_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_images_haber_kodu ON news_images(haber_kodu);
