/**
 * 🖼️ VLM PDF ANALYZER
 * Qwen3-VL-4B-Instruct ile PDF sayfalarını analiz eden library
 * Tabloları, diyagramları, grafikleri çıkarıp Markdown'a dönüştürüyor
 */

import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist";
import { createCanvas } from "canvas";

// Node.js ortamında DOMMatrix tanımla (pdfjs için gerekli)
if (typeof globalThis !== "undefined" && !("DOMMatrix" in globalThis)) {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor(public values: number[]) {}
  };
}

// PDFDocument'i ayarla
const PDFDocument = (pdfjsLib as any).getDocument;

// Worker dosyasını Node.js'e hazırla
if (typeof globalThis !== "undefined" && "pdfjsWorker" in pdfjsLib) {
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${(pdfjsLib as any).version}/pdf.worker.min.js`;
}

/**
 * PDF sayfasını Base64 görsele dönüştür
 */
export async function renderPdfPageToBase64(
  pdfPath: string,
  pageNum: number
): Promise<string> {
  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument({ data: pdfBuffer }).promise;
    const page = await pdf.getPage(pageNum);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL().split(",")[1]; // Base64 only
  } catch (error: any) {
    console.error(`❌ PDF render hatası (sayfa ${pageNum}):`, error.message);
    throw error;
  }
}

/**
 * VLM Server'a görsel gönder ve analiz al
 */
export async function analyzeImageWithVLM(
  imageBase64: string,
  task: string = "extract"
): Promise<{
  analysis: string;
  contentType: string;
  confidence: number;
}> {
  try {
    const response = await fetch("http://localhost:8001/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: imageBase64,
        task: task,
        language: "turkish",
      }),
    });

    if (!response.ok) {
      throw new Error(`VLM API hatası: ${response.status}`);
    }

    const result = await response.json();
    return {
      analysis: result.analysis,
      contentType: result.content_type,
      confidence: result.confidence,
    };
  } catch (error: any) {
    console.error("❌ VLM analiz hatası:", error.message);
    throw error;
  }
}

/**
 * PDF'den VLM analizi ile içerik çıkar
 * Sayfaları render et → VLM ile analiz et → Chunks oluştur
 */
export async function extractContentWithVLM(
  pdfPath: string,
  maxPages: number = 20,
  sourceFile: string = "unknown"
): Promise<
  Array<{
    pageNum: number;
    contentType: string;
    analysis: string;
    confidence: number;
  }>
> {
  const results: Array<{
    pageNum: number;
    contentType: string;
    analysis: string;
    confidence: number;
  }> = [];

  try {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdf = await PDFDocument({ data: pdfBuffer }).promise;
    const totalPages = pdf.numPages;

    console.log(
      `📄 VLM analizi başladı: ${sourceFile} (max ${maxPages} sayfa)`
    );

    // İlk maxPages sayfa analiz et
    const pagesToAnalyze = Math.min(maxPages, totalPages);

    for (let i = 1; i <= pagesToAnalyze; i++) {
      try {
        console.log(`   📖 Sayfa ${i}/${pagesToAnalyze} render ediliyor...`);

        // Sayfayı görsele dönüştür
        const base64 = await renderPdfPageToBase64(pdfPath, i);

        console.log(`   🔍 VLM analizi yapılıyor...`);

        // VLM ile analiz et
        const analysis = await analyzeImageWithVLM(base64, "extract");

        results.push({
          pageNum: i,
          contentType: analysis.contentType,
          analysis: analysis.analysis,
          confidence: analysis.confidence,
        });

        console.log(
          `   ✅ Sayfa ${i} analiz edildi (type=${analysis.contentType})`
        );
      } catch (pageError: any) {
        console.warn(
          `   ⚠️ Sayfa ${i} analiz başarısız: ${pageError.message}`
        );
        // Devam et, diğer sayfaları analiz et
        continue;
      }
    }

    console.log(`✅ VLM analizi tamamlandı: ${results.length} sayfa`);
    return results;
  } catch (error: any) {
    console.error("❌ VLM extraction genel hatası:", error.message);
    throw error;
  }
}

/**
 * VLM analiz sonuçlarını chunks'a dönüştür
 * Tabloları Markdown, diyagramları açıklama olarak tutar
 */
export async function formatVLMChunks(
  results: Array<{
    pageNum: number;
    contentType: string;
    analysis: string;
    confidence: number;
  }>,
  sourceFile: string
): Promise<
  Array<{
    content: string;
    metadata: {
      source: string;
      type: string;
      page: number;
      contentType: string;
      confidence: number;
      has_images: boolean;
    };
  }>
> {
  const chunks: Array<{
    content: string;
    metadata: {
      source: string;
      type: string;
      page: number;
      contentType: string;
      confidence: number;
      has_images: boolean;
    };
  }> = [];

  for (const result of results) {
    // İçerik türüne göre format
    let formattedContent = "";

    if (result.contentType === "table") {
      formattedContent = `[VLM - Tablo - Sayfa ${result.pageNum}]\n\n${result.analysis}`;
    } else if (result.contentType === "diagram" || result.contentType === "chart") {
      formattedContent = `[VLM - Diyagram/Grafik - Sayfa ${result.pageNum}]\n\n${result.analysis}`;
    } else {
      formattedContent = `[VLM - Analiz - Sayfa ${result.pageNum}]\n\n${result.analysis}`;
    }

    chunks.push({
      content: formattedContent,
      metadata: {
        source: sourceFile,
        type: "vlm",
        page: result.pageNum,
        contentType: result.contentType,
        confidence: result.confidence,
        has_images: true,
      },
    });
  }

  return chunks;
}
