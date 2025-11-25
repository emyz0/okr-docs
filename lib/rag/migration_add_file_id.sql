-- 🔄 MIGRATION: Documents Tablosuna file_id Kolonu Ekleme
-- 
-- Bu script mevcut documents tablosuna file_id kolonu ekler.
-- Her unique source (PDF dosyası) için ayrı file_id atanır.
--
-- Kullanım:
--   psql -U postgres -d vector_db -f lib/rag/migration_add_file_id.sql

-- ADIM 1: Eğer file_id kolonu varsa sil (temiz başla)
ALTER TABLE IF EXISTS documents 
DROP COLUMN IF EXISTS file_id;

-- ADIM 2: file_id kolonu ekle (ilk başta NULL)
ALTER TABLE documents 
ADD COLUMN file_id INTEGER;

-- ADIM 3: Her unique (user_id, source) kombinasyonuna bir file_id ata
-- Önce unique dosyalar için file_id'yi tespit et
-- Sonra tüm chunks'ları güncelleştir

-- Temporary table oluştur: her unique (user_id, source) için bir file_id
CREATE TEMP TABLE file_id_mapping AS
SELECT DISTINCT
  user_id,
  metadata->>'source' as source,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY MIN(id)) as file_id
FROM documents
GROUP BY user_id, metadata->>'source';

-- Şimdi documents tablosunu güncelle
UPDATE documents d
SET file_id = fid_map.file_id
FROM file_id_mapping fid_map
WHERE d.user_id = fid_map.user_id 
AND d.metadata->>'source' = fid_map.source;

-- ADIM 4: file_id'yi NOT NULL yap (opsiyonel, güvenlik için)
-- ALTER TABLE documents 
-- ALTER COLUMN file_id SET NOT NULL;

-- ADIM 5: Index ekle (performans)
CREATE INDEX IF NOT EXISTS idx_documents_file_id ON documents(file_id);

-- ADIM 6: Kontrol - her source için unique file_id var mı?
SELECT user_id, metadata->>'source' as source, file_id, COUNT(*) as chunk_count
FROM documents
GROUP BY user_id, metadata->>'source', file_id
ORDER BY user_id, file_id;
