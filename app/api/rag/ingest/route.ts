// Next.js API Route: /api/rag/ingest endpoint'i
// PDF olmadan direkt metin gönderilerek işleme yapar
// Kullanım: Ham metin, API yanıtları, web içeriği vs. yüklemek için

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db";
import { embeddings, textSplitter } from "@/lib/rag/chain";

export async function POST(req: NextRequest) {
  try {
    // Request body'den parametreleri oku
    // text: İşlenecek metin
    // metadata: Ekstra bilgiler (kaynak, kategori vs.)
    // userId: Hangi kullanıcı için veri yüklüyorsa
    const { text, metadata, userId } = await req.json();

    // Validasyon: text ve userId zorunlu
    if (!text || !userId) {
      return NextResponse.json(
        { error: "text ve userId gerekli" },
        { status: 400 }
      );
    }

    // Metni chunk'lara böl
    // /upload route'unda PDF loader açıkça chunk'ladığı için
    // burada textSplitter kullanıyoruz (aynı ayarlarla)
    const chunks = await textSplitter.splitText(text);

    // Her chunk'ı işle ve DB'ye kaydet
    for (const chunk of chunks) {
      // Chunk'ı embedding modeline gönder (vektöre dönüştür)
      const emb = await embeddings.embedQuery(chunk);

      // Veritabanına insert et
      // Fark: Burada embedding direkt array string'i gönderiliyor
      // (upload/route.ts'de JSON.stringify kullanıyor)
      await pool.query(
        `INSERT INTO public.documents (user_id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4)`,
        [userId, chunk, JSON.stringify(metadata), `[${emb.join(",")}]`]
      );
    }

    // Başarı cevabı: Kaç chunk işlendiğini göster
    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (error: any) {
    console.error("Ingest hatası:", error);
    return NextResponse.json(
      { error: error.message || "İşleme hatası" },
      { status: 500 }
    );
  }
}