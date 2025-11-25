// Next.js API Route: /api/rag/sections endpoint'i
// Kullanıcının section'larını yönetir (listele, sil)
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/rag/db";

export async function GET(req: NextRequest) {
  try {
    // Query parametrelerinden userId'yi al
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "demo-user";

    // Kullanıcının tüm section'larını listele (en yenisi başta)
    const result = await pool.query(
      `SELECT id, title, created_at, (messages::text)::json as messages, is_active
       FROM public.sections
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log(`📂 ${result.rows.length} section bulundu (userId: ${userId})`);

    return NextResponse.json({
      success: true,
      sections: result.rows,
    });
  } catch (err: any) {
    console.error("❌ Section listesi hatası:", err.message);
    return NextResponse.json(
      { error: err.message || "Section listesi alınamadı" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Request body'den sectionId ve userId'yi al
    const { sectionId, userId } = await req.json();

    // Validasyon
    if (!sectionId || !userId) {
      return NextResponse.json(
        { error: "sectionId ve userId gerekli" },
        { status: 400 }
      );
    }

    // 🗑️ Section'ı tamamen sil (veritabanından çıkar)
    // Soft delete değil, hard delete - veri tamamen silinir
    const result = await pool.query(
      `DELETE FROM public.sections
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [sectionId, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Section bulunamadı veya sizin değil" },
        { status: 404 }
      );
    }

    console.log(`🗑️ Section silindi: ${sectionId}`);

    return NextResponse.json({
      success: true,
      message: "Section başarıyla silindi",
    });
  } catch (err: any) {
    console.error("❌ Section silme hatası:", err.message);
    return NextResponse.json(
      { error: err.message || "Section silinemedi" },
      { status: 500 }
    );
  }
}
