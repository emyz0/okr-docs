// ╔════════════════════════════════════════════════════════════════════════════╗
// ║            🔴 KRİTİK NOKTA #4: RERANKING (SORULARI YENİDEN SIRALA)          ║
// ║                                                                            ║
// ║ Cohere API kullanarak vector similarity sonuçlarını iyileştir              ║
// ║                                                                            ║
// ║ PROBLEM: Vector similarity bazen yanlış sonuçlar verir                     ║
// ║ ÇÖZÜM: Cohere'nin ML modeli bunu düzeltir                                 ║
// ║                                                                            ║
// ║ PIPELINE:                                                                  ║
// ║   Vector Search (10 dokuman) → Reranking (ML'yle sırala) → LLM (top 3)    ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

// RerankInput: Reranking API'sine gönderilecek veri yapısı
interface RerankInput {
  query: string;                        // Kullanıcının sorusu
  documents: Array<{ id: number; text: string }>; // Sıralanacak dokümantlar
}

// RerankResult: Cohere API'sinden dönen sonuç
interface RerankResult {
  index: number;        // Orijinal dokuman indeksi (hangisi olduğu)
  relevance_score: number; // 0-1 arası relevans skoru (1 = en ilgili)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FUNCTION: RERANK DOCUMENTS
// ═══════════════════════════════════════════════════════════════════════════
//
// AMAÇ: 10 dokuman içinden en ilgili topK'sini seç
// NEDEN ÖNEMLI: LLM'e gereksiz dokümantlar göndermek cevap kalitesini düşürür
//
// SENARYO:
// Input: 10 dokuman, soru: "Veri tabanı nedir?"
// Output: [db_doc(0.98), sql_doc(0.92), other_doc(0.45)] (en ilgili 3)
//
export async function rerankDocuments(
  input: RerankInput,
  topK: number = 3 // ⭐ Kaç dokuman LLM'e göndereceğiz (default: 3)
): Promise<RerankResult[]> {
  
  // ╔════════════════════════════════════════════════════════════════════╗
  // ║ ADIM 1: API KEY KONTROLÜ (FALLBACK MODUSİ)                        ║
  // ║                                                                    ║
  // ║ Eğer Cohere API key'i yoksa sistem yine çalışır ama                ║
  // ║ reranking olmadan (vector similarity sonuçlarını döndür)           ║
  // ║                                                                    ║
  // ║ NEDEN GEREKLİ? Geliştirilme sırasında API key olmayabilir         ║
  // ╚════════════════════════════════════════════════════════════════════╝
  
  if (!process.env.COHERE_API_KEY) {
    console.warn('⚠️ COHERE_API_KEY not set, skipping reranking');
    console.warn('   → Sistem yine çalışır ama daha düşük kalitede cevaplar');
    
    // Fallback: İlk topK dokümantı döndür (reranking olmadan)
    // Bu sayede geliştirme sırasında API key olmadan da test edilebilir
    return input.documents.slice(0, topK).map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1, // Yaklaşık skor (0.9, 0.8, 0.7...)
    }));
  }

  try {
    // ╔════════════════════════════════════════════════════════════════════╗
    // ║ ADIM 2: COHERE API'YE ISTEK GÖNDER                                ║
    // ║                                                                    ║
    // ║ Endpoint: https://api.cohere.ai/v1/rerank                         ║
    // ║ Model: rerank-english-v2.0 (İngilizce için optimize)              ║
    // ║ Auth: Bearer token (COHERE_API_KEY ile)                           ║
    // ║                                                                    ║
    // ║ API RESPONSE:                                                     ║
    // ║ {                                                                 ║
    // ║   "results": [                                                    ║
    // ║     { "index": 5, "relevance_score": 0.98 },  ← En ilgili        ║
    // ║     { "index": 2, "relevance_score": 0.92 },                      ║
    // ║     { "index": 8, "relevance_score": 0.76 }                       ║
    // ║   ]                                                               ║
    // ║ }                                                                 ║
    // ╚════════════════════════════════════════════════════════════════════╝
    
    const response = await axios.post(
      'https://api.cohere.ai/v1/rerank',
      {
        model: 'rerank-english-v2.0', // ⭐ Cohere'nin reranking modeli
        query: input.query,            // Orijinal soru
        documents: input.documents.map(d => d.text), // Dokuman metinlerini gönder
        top_n: topK,                   // Kaç dokuman geri döndürsün?
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.COHERE_API_KEY}`, // API authentication
          'Content-Type': 'application/json',
        },
      }
    );

    // API'den dönen sonuçları döndür (zaten relevans skorlarına göre sıralı)
    return response.data.results as RerankResult[];
    
  } catch (error: any) {
    // ╔════════════════════════════════════════════════════════════════════╗
    // ║ ADIM 3: HATA YÖNETİMİ (FALLBACK)                                  ║
    // ║                                                                    ║
    // ║ Cohere API'ye erişilemezse:                                       ║
    // ║ 1. Hata yaz (debug için)                                          ║
    // ║ 2. Fallback döndür (sistem çalışmaya devam etsin)                 ║
    // ║                                                                    ║
    // ║ SENARYOlar:                                                        ║
    // ║ - Network error: İnternet yok                                     ║
    // ║ - 401 Unauthorized: API key yanlış/süresi doldu                   ║
    // ║ - 429 Too Many Requests: Rate limit aşıldı                        ║
    // ║ - 500 Internal Server Error: Cohere'de sorun                      ║
    // ╚════════════════════════════════════════════════════════════════════╝
    
    console.error('❌ Reranking hatası:', error.message);
    console.error('   → Fallback moduna geçildi (İlk ' + topK + ' dokuman döndürülüyor)');
    
    // Fallback: İlk topK dokümantı sor (reranking olmadan)
    // Bu sayede Cohere API'de sorun olsa da sistem çökmez
    return input.documents.slice(0, topK).map((_, i) => ({
      index: i,
      relevance_score: 1 - i * 0.1,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SORUN SENARYOLARI VE ÇÖZÜMLERI
// ═══════════════════════════════════════════════════════════════════════════
//
// ❌ PROBLEM: "❌ Reranking hatası: Request failed with status code 401"
//    ÇÖZÜM: COHERE_API_KEY yanlış veya süresi doldu
//    FİKS: https://dashboard.cohere.com → yeni key al → .env.local güncelle
//
// ❌ PROBLEM: "⚠️ COHERE_API_KEY not set"
//    ÇÖZÜM: API key'i .env.local'a yazmalısın
//    FİKS: echo "COHERE_API_KEY=xxx" >> .env.local
//
// ❌ PROBLEM: "429 Too Many Requests"
//    ÇÖZÜM: Çok hızlı çok istek gönderiyor
//    FİKS: İstekler arasına delay koy veya batch işle
//
// ❌ PROBLEM: "Reranking çalışıyor ama cevaplar yine kötü"
//    ÇÖZÜM: Dökümanlar zaten ilgisiz (search sonuçları kötü)
//    FİKS: Chunk size'ı / overlap'i / embedding model'i değiştir
//
// ✅ DOĞRU DURUM: Reranking sayesinde cevaplar daha tutarlı
//    → "Veri tabanı nedir?" sorusunda db dokuman birinci sıraya çıkıyor
//    → LLM daha iyi cevaplar veriyor

// ═══════════════════════════════════════════════════════════════════════════
// DERİN AÇIKLAMA: RERANKING vs VECTOR SIMILARITY
// ═══════════════════════════════════════════════════════════════════════════
//
// VECTOR SIMILARITY (hızlı ama bazen yanılır):
// - Cosine distance'a göre sıralıyor
// - Matematiksel, çok hızlı
// - "computer" ve "laptop" çok benzer
// - Ama "database query" sorgusu için "laptop review" da yüksek skor alabilir
//
// RERANKING (yavaş ama çok doğru):
// - ML modeli soru bağlamını anlıyor
// - "database query" sorusu → "laptop review" düşük skor alır
// - Gerçek anlam (semantik) ile sıralıyor
// - ~100ms ekstra gecikme ama çok daha iyi sonuçlar
//
// FARKLAR:
// Vector:   [Doc0:0.85, Doc1:0.82, Doc2:0.80, Doc3:0.78, ...]
// Rerank:   [Doc2:0.98, Doc0:0.91, Doc1:0.45, Doc3:0.30, ...] ← daha iyi!
//
// SONUÇ: Reranking yapabiliyorsan yap (biraz pahalı ama çok daha iyi)
