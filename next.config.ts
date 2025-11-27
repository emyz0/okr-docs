import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // pdfjs-dist için fallback ayarı
    // Node.js ortamında DOM-based kütüphaneleri devre dışı bırak
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "canvas": false,
      "encoding": false,
      "fs": false,
    };

    // pdfjs-dist'i uygun şekilde yükle
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push("pdfjs-dist");
    }

    return config;
  },
};

export default nextConfig;
