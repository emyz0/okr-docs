import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const haberKodu = searchParams.get("haberKodu");
    const newsId = searchParams.get("newsId");

    if (!haberKodu && !newsId) {
      return NextResponse.json(
        { error: "haberKodu veya newsId gerekli" },
        { status: 400 }
      );
    }

    // TODO: Veritabanından görselleri çek
    // Şimdilik boş array dönüyoruz
    const images: any[] = [];

    return NextResponse.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error("Görsel çekme hatası:", error);
    return NextResponse.json(
      { error: error.message || "İşleme hatası" },
      { status: 500 }
    );
  }
}
