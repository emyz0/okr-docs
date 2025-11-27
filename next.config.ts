import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: Turbopack kullanıyor (webpack gerekli değil)
  // Turbopack pdfjs-dist'i default olarak doğru işliyor
  turbopack: {
    // Turbopack override gerekli değil - default ayarlar yeterli
  },
};

export default nextConfig;
