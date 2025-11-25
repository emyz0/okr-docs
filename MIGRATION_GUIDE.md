## 🔄 Database Migration Rehberi

### Mevcut Durumu: 
Eski schema'da her **chunk**'un kendi unique `id`'si var (SERIAL PRIMARY KEY).

### Yeni Durumu:
- Her **chunk**'un kendi unique `id`'si devam edecek
- **EKLENEN**: Her **dosya (PDF)** için ayrı `file_id` (tüm chunks bu ID'yi paylaşır)

---

## 📋 ADIM 1: Migration Script'ini Çalıştır

Terminalde şu komutu çalıştır:

```bash
psql -U postgres -d vector_db -f lib/rag/migration_add_file_id.sql
```

Bu script:
1. ✅ Mevcut `file_id` sütununu temizler (eğer varsa)
2. ✅ Yeni `file_id` sütununu ekler
3. ✅ Her unique dosya kombinasyonuna `file_id` atar
4. ✅ İndeks oluşturur
5. ✅ Sonuçları gösterir

---

## 🔍 ADIM 2: Sonuçları Kontrol Et

Migration sonrasında şunu çalıştır:

```sql
psql -U postgres -d vector_db -c "
SELECT user_id, metadata->>'source' as source, file_id, COUNT(*) as chunk_count
FROM documents
GROUP BY user_id, metadata->>'source', file_id
ORDER BY user_id, file_id
LIMIT 10;
"
```

Bekleneni görmeli:
- Her dosya için **1 tane unique file_id**
- Aynı dosyadan gelen tüm chunks **aynı file_id**'ye sahip
- `chunk_count` her dosyanın chunk sayısını gösteriyor

---

## 📝 ADIM 3: Yeni Dosya Yükle

Artık yeni dosyaları yüklerken:
- Otomatik olarak `file_id` atanacak
- Her dosya benzersiz bir ID alacak
- Kaynakları gösterirken `file_id` kullanılacak

---

## ⚠️ Geri Alma (Rollback)

Eğer bir sorun olursa:

```sql
ALTER TABLE documents DROP COLUMN IF EXISTS file_id;
```

---

## 🎯 Sonuç

Artık sistem:
- ✅ Her **chunk** için: unique `id` (1, 2, 3, ...)
- ✅ Her **PDF** için: unique `file_id` (tüm chunks aynı file_id'yi paylaşır)

Veritabanında göreceğin:
```
id  | file_id | user_id     | content | ...
----|---------|-------------|---------|----
1   | 1       | demo-user   | METIN1  | ...
2   | 1       | demo-user   | METIN2  | ...
3   | 1       | demo-user   | METIN3  | ...
4   | 2       | demo-user   | METIN4  | ...
5   | 2       | demo-user   | METIN5  | ...
```

Her PDF'in kendi `file_id`'si var! 🎉
