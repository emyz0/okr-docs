// Next.js API Route: /api/rag/pdfs endpoint'i
// Kullanıcının yüklemiş olduğu tüm PDF'lerin listesini getir
// Frontend'de dropdown/checkbox list'inde göstermek için

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db";

// GET isteği: Parametre almak için
export async function GET(req: NextRequest) {
  try {
    // URL parametrelerini oku (query string'den)
    // userId: Hangi kullanıcının PDF'lerini getireceğiz
    // Örnek: /api/rag/pdfs?userId=demo-user
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "demo-user";

    // ===== SQL SORGUSU: DISTINCT DOSYALAR VE CHUNK SAYILARI =====
    // SELECT DISTINCT metadata->>'source': Dosya adlarını tekil olarak getir
    // COUNT(*): Her dosyanın kaç chunk'a bölündüğünü say
    // WHERE user_id = $1: Sadece bu kullanıcının verilerini getir
    // WHERE metadata->>'source' IS NOT NULL: Boş kaynak olmayan veriler
    // GROUP BY metadata->>'source', metadata->>'file_type': Dosyaya ve tipine göre grupla
    // ORDER BY file_name: İsimde göre sırala
    const result = await pool.query(
      `SELECT DISTINCT metadata->>'source' as file_name,
              metadata->>'file_type' as file_type,
              COUNT(*) as chunk_count
       FROM public.documents
       WHERE user_id = $1
       AND metadata->>'source' IS NOT NULL
       GROUP BY metadata->>'source', metadata->>'file_type'
       ORDER BY file_name`,
      [userId]
    );

    // ===== SONUÇ FORMATLAMA =====
    // Veritabanı sonuçlarını frontend için uygun format'e dönüştür
    return NextResponse.json({
      success: true,
      pdfs: result.rows.map((row: any) => ({
        name: row.file_name,              // Dosyanın adı (PDF, Excel, Word, TXT)
        fileType: row.file_type || 'pdf', // Dosya tipi (.pdf, .xlsx, .docx, .txt)
        chunkCount: parseInt(row.chunk_count), // Chunk sayısını number'a dönüştür
      })),
    });
  } catch (error: any) {
    console.error("PDF listesi hatası:", error);
    return NextResponse.json(
      { error: error.message || "İşleme hatası" },
      { status: 500 }
    );
  }
}
