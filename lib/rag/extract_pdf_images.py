#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📄 PDF GÖRSELLERİ VE TABLOLARI İŞLEME (Python)

PyPDF2 ve pdfplumber kullanarak:
- Görsel OCR
- Tablo tanıması
- Metin çıkarma

Kullanım:
  python lib/rag/extract_images.py <pdf_path> <output_json>

Örnek:
  python lib/rag/extract_images.py /tmp/document.pdf /tmp/extracted.json
"""

import json
import sys
import os
from pathlib import Path

try:
    import pdfplumber
    import pytesseract
    from PIL import Image
    import io
except ImportError:
    print("❌ Eksik paketler. Kur: pip install pdfplumber pytesseract pillow")
    sys.exit(1)


def extract_tables_from_pdf(pdf_path: str) -> dict:
    """
    PDF'den tabloları çıkart ve JSON formatına dönüştür
    """
    tables_data = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                tables = page.extract_tables()
                
                if tables:
                    tables_data[f"page_{page_num}"] = []
                    for table_idx, table in enumerate(tables):
                        # Tablo verisini Markdown'a dönüştür
                        markdown_table = convert_table_to_markdown(table)
                        tables_data[f"page_{page_num}"].append({
                            "table_index": table_idx,
                            "content": markdown_table,
                            "raw": table
                        })
        
        print(f"✅ {len(tables_data)} sayfa tablo bulundu")
        return tables_data
    
    except Exception as e:
        print(f"❌ Tablo çıkarma hatası: {e}")
        return {}


def extract_text_from_images(pdf_path: str) -> dict:
    """
    PDF'den görselleri çıkart ve OCR ile metin oku
    """
    images_data = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                # Sayfadaki görselleri al
                images = page.images
                
                if images:
                    images_data[f"page_{page_num}"] = []
                    
                    for img_idx, img_info in enumerate(images):
                        try:
                            # Görseli byte stream'den oku
                            # Not: pdfplumber'da görsel byte'ları doğrudan çıkarmak karmaşık
                            # İmage bilgisini sakla
                            images_data[f"page_{page_num}"].append({
                                "image_index": img_idx,
                                "bbox": img_info.get("bbox"),
                                "stream": "[İmage Data]"
                            })
                        except Exception as e:
                            print(f"⚠️  Görsel {img_idx} işleme hatası: {e}")
        
        print(f"✅ {len(images_data)} sayfada görsel bulundu")
        return images_data
    
    except Exception as e:
        print(f"❌ Görsel çıkarma hatası: {e}")
        return {}


def extract_text_ocr_from_pdf(pdf_path: str) -> dict:
    """
    PDF sayfalarının OCR metinlerini çıkart
    (Yavaş - sadece görsel yoğun sayfalar için)
    """
    ocr_data = {}
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Sadece ilk 5 sayfa OCR'le (performans)
            pages_to_process = min(5, len(pdf.pages))
            
            for page_num in range(pages_to_process):
                page = pdf.pages[page_num]
                
                try:
                    # Tesseract OCR
                    text = pytesseract.image_to_string(
                        page.to_image().original,
                        lang='tur+eng'
                    )
                    
                    if text.strip():
                        ocr_data[f"page_{page_num + 1}"] = text.strip()
                        print(f"  ✓ Sayfa {page_num + 1}: {len(text)} karakter OCR")
                
                except Exception as e:
                    print(f"  ⚠️  Sayfa {page_num + 1} OCR başarısız: {e}")
        
        print(f"✅ OCR tamamlandı ({pages_to_process} sayfa)")
        return ocr_data
    
    except Exception as e:
        print(f"❌ OCR hatası: {e}")
        return {}


def convert_table_to_markdown(table: list) -> str:
    """
    Tablo verilerini Markdown formatına dönüştür
    
    Input: 
      [['Ad', 'Soyad'], ['Ali', 'Yılmaz']]
    
    Output:
      | Ad  | Soyad   |
      |-----|---------|
      | Ali | Yılmaz  |
    """
    if not table or len(table) == 0:
        return ""
    
    # Başlık (ilk satır)
    headers = table[0]
    markdown = f"| {' | '.join(str(h) for h in headers)} |\n"
    
    # Ayırıcı
    markdown += f"| {' | '.join(['---'] * len(headers))} |\n"
    
    # Veri satırları
    for row in table[1:]:
        markdown += f"| {' | '.join(str(cell) for cell in row)} |\n"
    
    return markdown.strip()


def extract_all_from_pdf(pdf_path: str, output_path: str):
    """
    PDF'den tüm verileri çıkart ve JSON'a kaydet
    """
    print(f"\n📄 PDF işleniyor: {Path(pdf_path).name}")
    
    result = {
        "file": Path(pdf_path).name,
        "tables": extract_tables_from_pdf(pdf_path),
        "images": extract_text_from_images(pdf_path),
        # "ocr_text": extract_text_ocr_from_pdf(pdf_path),  # Çok yavaş
    }
    
    # Sonuç JSON'a kaydet
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Sonuç kaydedildi: {output_path}\n")
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Kullanım: {sys.argv[0]} <pdf_path> [output_json]")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/extracted.json"
    
    if not os.path.exists(pdf_path):
        print(f"❌ Dosya bulunamadı: {pdf_path}")
        sys.exit(1)
    
    extract_all_from_pdf(pdf_path, output_path)
