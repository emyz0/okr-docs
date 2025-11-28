# 📚 RAG SİSTEMİ - ÖĞRENME KAYNAKLARI

Aşağıdaki dosyaları sırasıyla oku ve öğren:

## �� Başlayacaklar İçin

1. **CRITICAL_KNOWLEDGE.md** (Türkçe + English)
   - Problemi anlama
   - Sistem mimarisi (4 temel bileşen)
   - Her bileşenin detaylı açıklaması
   - Production checklist

2. **TURKCE_FINAL_CHEATSHEET.py**
   - Türkçe özet
   - Interview soruları ve cevapları
   - Sorun giderme rehberi
   - Monitoring metrikleri

3. **FINAL_CHEATSHEET.py** (English)
   - Same as above but in English
   - Detailed definitions
   - Code examples

## 🔍 Visual Guides

4. **VISUAL_COMPARISON.py**
   - pgvector vs Reranker vs Fallback karşılaştırması
   - 10 sık sorulan soru
   - Troubleshooting flowchart
   - Complete pipeline diagram

## �� Test & Demo Files

5. **test_fallback_logic.py**
   - Fallback mekanizmasının demo'su
   - Scoring formula'sının pratik örneği

6. **RERANKER_TEST_SUMMARY.py**
   - Reranker test sonuçları
   - System metrics

## 📋 Hızlı Referans

### 5 Temel Konsept
1. **Embedding** - Metni sayıya çevir
2. **pgvector** - Hızlı filtre (<10ms, 85%)
3. **Reranker** - Doğru sırala (2-4s, 99%)
4. **Fallback** - Backup planı (always works)
5. **Chat History** - Context tut (JSONB)

### Kritik Dosyalar (Kod)
- `/app/api/rag/query/route.ts` - Ana query pipeline (satırları 76-110 fallback)
- `/reranker_server.py` - Qwen3-Reranker-4B server (port 8000)
- `/lib/rag/chain.ts` - OpenAI LLM ve embedding

### Key Metrics to Monitor
- Query latency: 3-8s (normal)
- Fallback rate: <1% (normal)
- Token usage: ~500k/day per 1000 queries
- Reranker uptime: 99%+

### Production Checklist
- [ ] Embedding API working
- [ ] PostgreSQL + pgvector running
- [ ] Reranker server healthy (port 8000)
- [ ] LLM API responding
- [ ] Fallback tested
- [ ] Chat history saving
- [ ] Monitoring setup
- [ ] No 500 errors

## 🎓 Study Order

**30 dakika:** CRITICAL_KNOWLEDGE.md okumak
**15 dakika:** VISUAL_COMPARISON.py izlemek
**15 dakika:** TURKCE_FINAL_CHEATSHEET.py okumak
**30 dakika:** Interview soruları cevaplamak
**Total: ~90 dakika**

## 🚀 Interview Hazırlığı

1. "RAG mimarisini açıkla" → CRITICAL_KNOWLEDGE + VISUAL_COMPARISON'a bak
2. "pgvector ve Reranker farkı?" → VISUAL_COMPARISON'un 1. kısmı
3. "Fallback nasıl çalışıyor?" → CRITICAL_KNOWLEDGE + TURKCE_FINAL_CHEATSHEET
4. "Cohere neden kaldırıldı?" → CRITICAL_KNOWLEDGE'ın Cohere bölümü
5. "System metrics?" → TURKCE_FINAL_CHEATSHEET'in monitoring bölümü

## 💾 Dosya Boyutları

- CRITICAL_KNOWLEDGE.md: Uzun (tam açıklamalar)
- TURKCE_FINAL_CHEATSHEET.py: Orta (öz bilgiler)
- VISUAL_COMPARISON.py: Orta (diagramlar)
- test_fallback_logic.py: Kısa (demo)

## ✅ Bilmen Gerekenleri Test Et

- [ ] RAG nedir? (problem-solution)
- [ ] pgvector nasıl çalışır? (Euclidean distance)
- [ ] Reranker nedir? (BERT-like semantic)
- [ ] Fallback formülü nedir? (1 - index * 0.05)
- [ ] Cohere neden kaldırıldı? (cost-benefit)
- [ ] Temperature 0.1 neden? (factual vs creative)
- [ ] Chat history nerde saklanır? (PostgreSQL JSONB)
- [ ] Zayıf nokta ne? (Reranker speed)
- [ ] Monitoring ne? (latency, fallback, tokens)
- [ ] Production checklist? (10 items)

Bunları bileysen senior engineer level'de RAG bilgisine sahipsin! 🚀
