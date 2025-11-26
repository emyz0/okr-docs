// Next.js API Route: /api/rag/query endpoint'i
// Kullanıcının sorusuna cevap bulur ve kaynakları gösterir
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db";
import { embeddings, llm } from "@/lib/rag/chain";
import { rerankDocuments } from "@/lib/rag/rerank";

export async function POST(req: NextRequest) {
  try {
    // Request body'den parametreleri oku
    const { question, userId, selectedPdfs, conversationHistory, sectionId } = await req.json();

    // DEBUG: conversationHistory'yi logla
    console.log("🔍 DEBUG: conversationHistory type:", typeof conversationHistory);
    console.log("🔍 DEBUG: conversationHistory value:", JSON.stringify(conversationHistory).substring(0, 200));
    console.log("📂 DEBUG: sectionId:", sectionId || "yok");

    // Validasyon: Soru ve userId zorunlu
    if (!question || !userId) {
      return NextResponse.json(
        { error: "question ve userId gerekli" },
        { status: 400 }
      );
    }

    // Soruyu embedding modeline gönder (soruyu vektöre dönüştür)
    const qEmb = await embeddings.embedQuery(question);

    // ===== VECTOR SIMILARITY SEARCH =====
    // Veritabanında soruya benzer dokümantları bul
    // SELECT kısmında metadata alanlarını açık olarak çekelim:
    // - (metadata->>'source')::text: Hangi dosyadan geldiği
    // - CAST(metadata->>'chunk' AS INTEGER): Hangi chunk numarası
    // - (metadata->>'page'): Hangi sayfadan
    // - (metadata->>'lineNumber'): Satır numarası
    // - file_id: Her dosya için unique ID (TÜM CHUNKS BU ID'YE SAHİP) 🆔
    let query = `SELECT id, file_id, content, metadata,
                        CAST(metadata->>'chunk' AS INTEGER) as chunk_num
                 FROM public.documents
                 WHERE user_id = $1`;
    const params: any[] = [userId];

    // Eğer belirli PDF'ler seçilmişse sadece onlardan ara
    // metadata->>'source' = ANY($2) şu anlama gelir:
    // metadata JSON'inin 'source' alanı selectedPdfs listesinde mi?
    if (selectedPdfs && selectedPdfs.length > 0) {
      query += ` AND metadata->>'source' = ANY($2)`;
      params.push(selectedPdfs);
    }

    // Vektor benzerliliğine göre sırala (<-> operatörü pgvector'ün distance operatörü)
    // En benzer 10 dokuman al
    query += ` ORDER BY embedding <-> $${params.length + 1}::vector
              LIMIT 10`;
    params.push(JSON.stringify(qEmb));

    // Similarity search'ü çalıştır
    const result = await pool.query(query, params);

    // Eğer hiç benzer dokuman bulunamadıysa
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        answer: "Bu konuda belgelerinizde bilgi bulunamadı.",
        sources: [],
      });
    }

    // ===== RERANKING: QWEN3 RERANKER-4B İLE EN İLGİLİ KAYNAKLAR SEÇ =====
    // Vector similarity iyi sonuç verse de, Qwen reranking daha doğru sonuçlar verir
    // 10 dokuman içinden gerçekten soruya cevap verecek olanları seç
    console.log("🔄 Reranking başladı...");
    
    let rerankResults: any[] = [];
    
    try {
      // Qwen local server'a gönder
      const qwenResponse = await fetch("http://localhost:8000/rerank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: question,
          documents: result.rows.map((r: any) => r.content.substring(0, 500)),
          top_k: Math.min(result.rows.length, 10),
        }),
      });
      
      if (!qwenResponse.ok) {
        throw new Error(`Qwen server hatası: ${qwenResponse.status}`);
      }
      
      const qwenData = await qwenResponse.json();
      // Qwen'den gelen sonuçları NextResponse formatına dönüştür
      rerankResults = qwenData.ranked_documents.map((doc: any) => ({
        index: doc.index,
        relevance_score: doc.score,
      }));
      
      console.log("✅ Qwen reranker başarılı");
    } catch (qwenError: any) {
      console.warn("⚠️ Qwen reranker kullanılamadı, fallback to Cohere:", qwenError.message);
      
      // Fallback: Cohere API'yi kullan
      const rerankInput = {
        query: question,
        documents: result.rows.map((r: any, i: number) => ({
          id: i,
          text: r.content.substring(0, 500),
        })),
      };
      rerankResults = await rerankDocuments(rerankInput, Math.min(result.rows.length, 10));
    }

    // ===== HER PDF'DEN KAYNAKLAR SEÇ =====
    // Amaç: Her PDF'den en az 1 dokuman alsın (tüm kaynaklar temsil edilsin)
    // Maksimum: 10 dokuman (yeterli context için)
    const selectedByPdf = new Map<string, any[]>();
    const selectedIndices = new Set<number>();
    
    // Rerank sonuçlarından aşağıya doğru git
    for (const rr of rerankResults) {
      const row = result.rows[rr.index];
      // Bu dokuman hangi PDF'den geliyor?
      const source = (row.metadata as any)?.source || 'unknown';
      
      // Bu PDF için henüz bir dokuman seçilmemiş mi? (case-insensitive karşılaştırma)
      const sourceKey = source.toLowerCase();
      if (!selectedByPdf.has(sourceKey)) {
        selectedByPdf.set(sourceKey, []);
      }
      
      const docs = selectedByPdf.get(sourceKey)!;
      // Her PDF'den maksimum 1 dokuman al (daha fazla PDF temsil etmek için)
      if (docs.length < 1) {
        docs.push(rr.index);
        selectedIndices.add(rr.index);
      }
      
      // Toplam 10 dokuman yeterli, duş
      if (selectedIndices.size >= 10) break;
    }
    
    // Seçilen indeksleri orijinal sıraya göre sırala
    const rankedRows = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(idx => result.rows[idx]);

    // ===== CONTEXT HAZIRLA =====
    // LLM'e verilecek dokümantlar hazırla (sayfa, satır, dosya bilgileriyle)
    const contexts = rankedRows.map((r: any) => {
      const metadata = (r.metadata as any) || {}
      const source = metadata.source || metadata.file || 'unknown'
      // SQL'den gelen chunk_num'ı veya metadata.chunk'ı kullan
      const chunk = r.chunk_num || metadata.chunk || metadata.part || null
      const page = metadata.page || 'N/A'
      const lineNumber = metadata.lineNumber || 'N/A'
      // LLM'e gösterilmek üzere metni 600 karakterle sınırla
      const excerpt = (r.content || '').slice(0, 600)
      return { id: r.id, file_id: r.file_id, source, chunk, page, lineNumber, excerpt, full: r.content, metadata }
    })

    // Context'i LLM'in anlayacağı formata dönüştür
    const contextText = contexts
      .map((c) => `Source: ${c.source}${c.chunk ? ` (chunk ${c.chunk})` : ''}\nExcerpt:\n${c.excerpt}`)
      .join('\n\n---\n\n')

    // ===== LLM'E SORGU GÖNDER =====
    // Hazırlanan context ve soruyu LLM'e ver, cevap üret
    // Eğer önceki soru-cevaplar varsa conversation history'i ekle
    let conversationContext = '';
    if (conversationHistory && conversationHistory.length > 0) {
      console.log("📚 Conversation history bulundu:", conversationHistory.length, "soru-cevap");
      conversationContext = '=== ÖNCEKİ KONUŞMALAR ===\n';
      conversationHistory.forEach((turn: any, idx: number) => {
        conversationContext += `\nSoru ${idx + 1}: ${turn.question}\nCevap ${idx + 1}: ${turn.answer}\n`;
      });
      conversationContext += '\n=== GÜNCEL SORU ===\n\n';
    } else {
      console.log("⚠️ Conversation history yok (ilk soru)");
    }
    
    const prompt = `${conversationContext}

Aşağıdaki kaynak bilgilerini kullanarak soruyu cevapla. 

ÖNEMLI NOTLAR:
- Eğer bu soru önceki sorularla ilişkiliyse, önceki cevapları bağlam olarak kullan
- Soruda "nasıl hazırlanır?, kimle çıkmıştır?" gibi devam sözcükleri varsa, önceki bağlamdan yararlan
- Eğer kaynaklarda bulunan bilgi varsa onu kullan, yoksa "Bilgiye erişilemedi" de

KAYNAKLAR:
${contextText}

SORU: ${question}

CEVAP:`

    console.log("🤖 LLM'e gönderiliyor...");
    // LLM'i çalıştır (gpt-4o-mini)
    const llmResponse = await llm.invoke(prompt);
    // LLM'in yanıtını string'e dönüştür
    const answer = typeof llmResponse.content === 'string' ? llmResponse.content : String(llmResponse.content)

    // 🆕 SECTION'A SOR-CEVAP KAYDET
    // Eğer sectionId varsa, bu soru-cevabı section'un messages array'ine ekle
    let savedSectionId = sectionId;
    if (sectionId) {
      // Mevcut messages'i oku
      const sectionResult = await pool.query(
        `SELECT messages FROM public.sections WHERE id = $1 AND user_id = $2`,
        [sectionId, userId]
      );

      if (sectionResult.rows.length > 0) {
        const existingMessages = sectionResult.rows[0].messages || [];
        const newMessage = { question, answer, sources: contexts.map(c => ({ source: c.source, chunk: c.chunk, page: c.page, lineNumber: c.lineNumber, id: c.id, has_images: (c.metadata as any)?.has_images })) };
        const updatedMessages = [...existingMessages, newMessage];

        // Section'u güncelle
        await pool.query(
          `UPDATE public.sections SET messages = $1::jsonb WHERE id = $2 AND user_id = $3`,
          [JSON.stringify(updatedMessages), sectionId, userId]
        );
        console.log(`💾 Soru-cevap section'a kaydedildi (ID: ${sectionId})`);
      }
    } else {
      // Eğer sectionId yoksa (ilk soru), yeni section oluştur
      console.log("🆕 İlk soru - yeni section oluşturuluyor...");
      const newSectionResult = await pool.query(
        `INSERT INTO public.sections (user_id, title, messages, is_active)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING id`,
        [userId, `💬 Konuşma - ${new Date().toLocaleString()}`, JSON.stringify([{ question, answer, sources: contexts.map(c => ({ source: c.source, chunk: c.chunk, page: c.page, lineNumber: c.lineNumber, id: c.id, has_images: (c.metadata as any)?.has_images })) }]), true]
      );
      savedSectionId = newSectionResult.rows[0].id;
      console.log(`✨ Yeni section oluşturuldu: ${savedSectionId}`);
    }

    // ===== SONUÇ DÖNDÜR =====
    // Cevap ve kaynakları döndür (chunk, page, lineNumber dahil)
    // 🖼️  has_images: Kaynak metinde görsel/tablo içeriyor mu?
    return NextResponse.json({
      success: true,
      answer,
      sectionId: savedSectionId,
      sources: contexts.map((c) => ({ 
        id: c.id, 
        file_id: c.file_id,  // 🆔 Her dosya için unique ID
        source: c.source, 
        chunk: c.chunk,
        page: c.page,
        lineNumber: c.lineNumber,
        has_images: (c.metadata as any)?.has_images || false,  // 🖼️  Görsel göstergesi
        metadata: c.metadata 
      })),
    });
  } catch (error: any) {
    console.error("Query hatası:", error);
    return NextResponse.json(
      { error: error.message || "İşleme hatası" },
      { status: 500 }
    );
  }
}