import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data.title || !data.body) {
      return NextResponse.json(
        { error: "title ve body gerekli" },
        { status: 400 }
      );
    }

    // TODO: Veritabanına kaydet
    // Şimdilik başarı dönüyoruz
    console.log("📰 Haber kaydediliyor:", {
      id: data.id,
      title: data.title,
      category: data.category,
    });

    return NextResponse.json({
      success: true,
      message: "Haber başarıyla kaydedildi",
      id: data.id || "new-" + Date.now(),
    });
  } catch (error: any) {
    console.error("Haber kaydetme hatası:", error);
    return NextResponse.json(
      { error: error.message || "İşleme hatası" },
      { status: 500 }
    );
  }
}
