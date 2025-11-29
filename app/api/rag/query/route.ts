// Next.js API Route: /api/rag/query endpoint'i
// Kullanıcının sorusuna cevap bulur ve kaynakları gösterir
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db";
import { embeddings, llm } from "@/lib/rag/chain";

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
    const separator = "=".repeat(80);
    console.log("\n" + separator);
    console.log("🔍 QUERY DEBUG INFO");
    console.log(separator);
    console.log("📌 SORU:", question);
    console.log("👤 USER ID:", userId);
    console.log("📄 Toplam vector match:", result.rows.length);
    
    // TOP 5 CHUNK'I (RERANKING ÖNCESI)
    console.log("\n📊 TOP 5 VECTOR MATCH (RERANKING ÖNCESİ):");
    result.rows.slice(0, 5).forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. [${r.metadata?.source || 'unknown'}] ${r.content.substring(0, 80)}...`);
    });
    
    console.log("\n🔄 Reranking başladı...");
    
    let rerankResults: any[] = [];
    
    // ✅ RERANKER SUNUCUSUNA GERÇEK ÇAĞRI YAP
    try {
      const rerankerPayload = {
        query: question,
        documents: result.rows.map(r => r.content),
        top_k: 10
      };
      
      console.log(`  📤 Reranker'a gönderiliyor: ${result.rows.length} dokuman...`);
      
      // Promise.race ile timeout simüle et (AbortSignal.timeout uyumluluk için)
      const rerankerPromise = fetch('http://localhost:8000/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rerankerPayload)
      });
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Reranker timeout (180s)')), 180000)
      );
      
      const rerankerResponse = await Promise.race([rerankerPromise, timeoutPromise]) as Response;
      
      if (!rerankerResponse.ok) {
        throw new Error(`Reranker HTTP ${rerankerResponse.status}`);
      }
      
      const rerankerData = await rerankerResponse.json();
      rerankResults = rerankerData.ranked_documents || [];
      
      console.log(`✅ Qwen reranker başarılı: ${rerankResults.length} ranked dokuman`);
    } catch (rerankerError: any) {
      console.warn(`⚠️ Qwen reranker kullanılamadı: ${rerankerError.message}`);
      console.warn("⚠️ Vector similarity sonuçları kullanılıyor (fallback)");
      
      // Fallback: Vector similarity sonuçlarını kullan
      rerankResults = result.rows.map((_, i: number) => ({
        index: i,
        relevance_score: 1 - i * 0.05, // Yaklaşık puanlama (0.95, 0.90, 0.85...)
      }));
    }
    
    // TOP 5 RERANKED SONUÇLARI GÖSTER
    console.log("\n🏆 TOP 5 RERANKED (QWEN SKORU İLE):");
    rerankResults.slice(0, 5).forEach((rr: any, i: number) => {
      const r = result.rows[rr.index];
      const score = rr.relevance_score !== undefined ? rr.relevance_score : rr.score;
      console.log(`  ${i + 1}. SCORE: ${(score * 100).toFixed(1)}% | [${r.metadata?.source || 'unknown'}] ${r.content.substring(0, 70)}...`);
    });
    
    console.log("\n" + separator);

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
      // LLM'e gösterilmek üzere metni 2000 karakterle sınırla (tablolar tam görünsün)
      const excerpt = (r.content || '').slice(0, 2000)
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