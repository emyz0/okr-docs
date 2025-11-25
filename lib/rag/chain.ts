// ===== CHAIN.TS =====
// RAG sisteminin merkezi bileşenleri (AI models, text splitter)
// Bu dosya tüm işlemlerde kullanılan shared objects'leri export eder

import { OpenAIEmbeddings } from "@langchain/openai";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    RAG SİSTEMİNİN KRİTİK BİLEŞENLERİ                      ║
// ║                                                                            ║
// ║ Bu dosya RAG (Retrieval-Augmented Generation) pipelineinin temel           ║
// ║ bileşenlerini başlatır ve export eder.                                    ║
// ║                                                                            ║
// ║ PIPELINE: Soru → Embedding → Vector Search → Reranking → LLM → Cevap      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 KRİTİK NOKTA #1: EMBEDDINGS (VEKTÖR DÖNÜŞÜMÜ)
// ═══════════════════════════════════════════════════════════════════════════
// 
// AMAÇ: Metni sayısal vektöre dönüştürme
// NEDEN ÖNEMLI: Benzer metinler benzer vektörler üretir → similarity search
// 
// TEKNIK DETAYLAR:
// - text-embedding-3-small: 1536-boyutlu vektör üretir
// - Cosine similarity: Vektörler arasındaki benzerliği 0-1 arası ölçer
// - "cat" ve "dog" vektörleri birbirine yakın (ikisi de hayvan)
// - "cat" ve "trigonometry" vektörleri çok uzak
//
// SEÇME KRİTERLERİ:
// - text-embedding-3-small: Hızlı, ucuz, yeterli kalite (⭐ ÖNERİLEN)
// - text-embedding-3-large: Daha iyi kalite, ama 3x pahalı ve yavaş
// 
// SORUN SENARYOLARI:
// ❌ Model değiştirirsen: Eski embedding'lerle yeni model incompat
// ❌ Dimension mismatch: pgvector(1536) ≠ embedding(3072) → crash
// ❌ API key yok: OpenAI'dan embedding alınamaz
//
// ÇÖZÜMLERI:
// ✅ Çalışan embedding modeli yap
// ✅ Dimension'ı kontrol et (ALTER TABLE documents ALTER COLUMN embedding TYPE vector(3072))
// ✅ Env variable'ı set et (OPENAI_API_KEY)
//
export const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "text-embedding-3-small", // ⭐ Hızlı ve ekonomik seçenek
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 KRİTİK NOKTA #2: LLM (DILE GELİŞTİRME MODELİ)
// ═══════════════════════════════════════════════════════════════════════════
//
// AMAÇ: Sorulara cevap üretme (doğal dil ile)
// NEDEN ÖNEMLI: Cevapın kalitesi tamamen LLM'e bağlı
//
// TEKNIK DETAYLAR:
// - gpt-4o-mini: Dengeli model (güç + hız + cost)
// - temperature: 0.2 = deterministik (her zaman benzer cevaplar)
// - System role: Model'e talimatları "siz bir asistansınız" şeklinde verir
//
// SEÇME KRİTERLERİ:
// - gpt-4o-mini: ⭐ ÖNERİLEN (RAG için ideal balans)
// - gpt-4o: Daha güçlü ama 5x pahalı
// - gpt-3.5-turbo: Ucuz ama düşük kalite
//
// TEMPERATURE SEÇİMİ:
// - 0.0: Hiç randomluk yok (deterministic)
//   → "Ne zaman sorsam aynı cevap alırım" (iyi)
// - 0.5: Orta rastgelelik
// - 1.0: Çok rastgele (creative)
//   → "Her seferinde farklı cevap alırım" (RAG'da kötü)
// → RAG'da 0.2 tercih edilir (tutarlılık önemli)
//
// SORUN SENARYOLARI:
// ❌ API key yok: OpenAI'dan cevap alınamaz
// ❌ Rate limit: Çok hızlı çok istek → 429 hatası
// ❌ Token limit: Prompt + context çok uzun → error
// ❌ Context kurma başarısız: Sistem talimatları yok → şaşırır
//
// ÇÖZÜMLERI:
// ✅ Env variable set et (OPENAI_API_KEY)
// ✅ İstek aralıklarını ayarla
// ✅ Context'i sınırla (max 4000 karakter)
// ✅ Prompt template'ini iyileştir
//
export const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: "gpt-4o-mini", // ⭐ Balans: güç + hız + maliyet
  temperature: 0.1, // Deterministik (tutarlı cevaplar)
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 KRİTİK NOKTA #3: TEXT SPLITTER (METNI PARÇALAMA)
// ═══════════════════════════════════════════════════════════════════════════
//
// AMAÇ: Uzun metni yönetilebilir parçalara (chunk'lara) bölme
// NEDEN ÖNEMLI: Embedding modeli çok uzun metni işleyemez
//
// TEKNIK DETAYLAR:
// - chunkSize: 1000 = her chunk maksimum 1000 karakter
// - chunkOverlap: 200 = chunk'lar arasında 200 karakterlik örtüşme
// - Overlap neden gerekli? Sınır noktasında context kaybını önlemek
//
// ÖRNEK SENARYO:
// Metin: "...Bu bölümün sonunda önemli bilgi var. Bu bilgi devamında..."
// chunkSize=1000, chunkOverlap=200 ise:
//   Chunk 1: "...Bu bölümün sonunda önemli bilgi var. [200 char...]"
//   Chunk 2: "[...200 char...] Bu bilgi devamında... [next chunk]"
//   → Sınır noktasında bilgi tekrarlanarak kayıp engellenir!
//
// SEÇME KRİTERLERİ:
// ❌ chunkSize=500: Çok küçük → çok fazla chunk → yavaş ve pahalı
// ❌ chunkSize=3000: Çok büyük → context kaybı
// ✅ chunkSize=1000: İdeal (PDF'ler için)
//
// ❌ chunkOverlap=0: Sınır noktasında bilgi kayıp
// ❌ chunkOverlap=500: Çok fazla tekrar → fazla embedding
// ✅ chunkOverlap=200: İdeal (20% overlap)
//
// SORUN SENARYOLARI:
// ❌ Chunk çok küçük: Cevap parçalanmış, tutarsız
// ❌ Chunk çok büyük: İlgisiz bilgi karışıyor
// ❌ Overlap yok: Cümlelerin ortası kesilir
//
// ÇÖZÜMLERI:
// ✅ chunkSize ayarla (500-2000 arası test et)
// ✅ chunkOverlap'i 10-30% arası tut
// ✅ Separator özelleştir (if needed)
//
export const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, // ⭐ Her parça maksimum 1000 karakter
  chunkOverlap: 200, // ⭐ 200 karakterlik örtüşme (%20)
});

// ===== 4. FUNCTION: DOCUMENT INGEST (METIN YÜKLEME) =====
// Metin veya dokümanları işleyip PostgreSQL'e kaydeder
// Kullanım: API yanıtları, web içeriği, ham metin vb. yüklemek için
export async function ingestDocument(params: {
  text: string;                              // İşlenecek metin
  metadata: Record<string, any>;             // Kaynak bilgisi (title, author vs.)
  userId: string;                            // Hangi kullanıcı için
}) {
  const { text, metadata, userId } = params;

  // 1. Metin parçalarına böl
  // textSplitter.createDocuments(): Metin + metadata'yı dokuman objelerine dönüştür
  const docs = await textSplitter.createDocuments([text], [metadata]);

  // 2. Tüm dokümanlara userId ekle (farklı kullanıcıları ayırt etmek için)
  const docsWithUser = docs.map(
    (doc) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: { ...(doc.metadata as any), userId }, // userId'yi metadata'ya ekle
      })
  );

  // 3. PostgreSQL ile bağlantı başlat ve dokümanları ekle
  // PGVectorStore: LangChain'in PostgreSQL vector desteği
  // - Otomatik embedding üretir
  // - Otomatik vektörleri DB'ye kaydeder
  const store = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: {
      connectionString: process.env.POSTGRES_URL!, // DB bağlantı stringi
    },
    tableName: "documents",   // Verilerin kaydedileceği tablo
    schemaName: "public",     // Database schema
  });

  // Dokümanları DB'ye ekle
  await store.addDocuments(docsWithUser);

  return { success: true, chunks: docsWithUser.length };
}

// ===== 5. FUNCTION: RAG SORGUSU (SORU-CEVAP) =====
// Kullanıcının sorusuna cevap bulur ve kaynakları döndürür
// Pipeline: Soru → Embedding → Similarity Search → LLM → Cevap
export async function queryRAG(params: {
  question: string; // Kullanıcının sorusu
  userId: string;   // Hangi kullanıcının verilerine sor
}) {
  const { question, userId } = params;

  // 1. PostgreSQL ile bağlantı kur
  const store = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: {
      connectionString: process.env.POSTGRES_URL!,
    },
    tableName: "documents",
    schemaName: "public",
  });

  // 2. Vector similarity search: Soruya en benzer 4 dokuman bul
  // similaritySearch(): Soru embedding'ini hesapla ve DB'de ara
  const relevantDocs = await store.similaritySearch(question, 4);

  // Eğer hiç benzer dokuman bulunamadıysa
  if (relevantDocs.length === 0) {
    return { answer: "Bu konu hakkında bilgim yok.", sources: [] };
  }

  // 3. LLM için context hazırla (bulunan dokümanları birleştir)
  // Dokümantları "---" ile ayırarak LLM'e sunar
  const context = relevantDocs.map((d) => d.pageContent).join("\n\n---\n\n");

  // 4. LLM için prompt oluştur
  // Prompt: talimat + context + soru = LLM'in soruyu cevaplaması
  const prompt = `Aşağıdaki bilgileri kullanarak soruyu cevapla. Bilgi yoksa uydurma:

${context}

Soru: ${question}

Cevap:`;

  // 5. LLM'i çalıştır
  const res = await llm.invoke(prompt);

  // 6. Cevap + kaynakları döndür
  return {
    answer: res.content,           // LLM'in ürettiği cevap
    sources: relevantDocs.map((d) => d.metadata), // Hangi dokümanlardan aldığı
  };
}
