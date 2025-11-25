# 🗄️ Veritabanı Kurulum Rehberi

## PostgreSQL Kurulumu

### 1. PostgreSQL Yükle
```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

### 2. Veritabanı ve Kullanıcı Oluştur
```bash
# PostgreSQL CLI'ye gir
psql -U postgres

# İçinde çalıştır:
CREATE DATABASE vector_db;
CREATE USER postgres WITH PASSWORD '12345';
ALTER ROLE postgres WITH SUPERUSER;
```

### 3. pgvector Extension Yükle
```bash
# pgvector'ü kur
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Veya Homebrew (macOS)
brew install pgvector
```

### 4. Schema Oluştur
```bash
# Kök dizininden çalıştır:
psql -U postgres -d vector_db -f lib/rag/schema.sql
```

### 5. Bağlantı Kontrol Et
```bash
psql -U postgres -d vector_db -h localhost -p 5433
```

## Ortam Değişkenleri (.env.local)

```env
OPENAI_API_KEY=sk-proj-xxxxx
POSTGRES_URL=postgresql://postgres:12345@localhost:5433/vector_db
```

## Sorun Giderme

### pgvector kurulmazsa:
```bash
# Docker ile PostgreSQL çalıştır
docker run --name postgres-vector \
  -e POSTGRES_PASSWORD=12345 \
  -e POSTGRES_DB=vector_db \
  -p 5433:5432 \
  pgvector/pgvector:latest
```

### Bağlantı hatası:
- Port 5433'ün kullanılıp kullanılmadığını kontrol et: `lsof -i :5433`
- PostgreSQL servisi çalışıyor mu: `pg_isready -h localhost -p 5433`
