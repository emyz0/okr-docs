#!/usr/bin/env python3
"""
🖼️ QWEN3 VLM SERVER
Qwen/Qwen3-VL-4B-Instruct modeli ile görselleri analiz eden FastAPI server
PDF sayfalarından tablo, diagram, grafik çıkarımı yapıyor
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFilter
import logging
from transformers import AutoProcessor, Qwen2VLForConditionalGeneration
import pytesseract
import numpy as np

# Logging ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Qwen3 VLM Server", version="1.0")

# Global model ve processor
model = None
processor = None
device = None

class VLMRequest(BaseModel):
    """VLM analiz isteği"""
    image_base64: str  # Base64 encoded image
    task: str = "extract"  # "extract", "describe", "table", "diagram"
    language: str = "turkish"  # "turkish", "english", "mixed"

class VLMResponse(BaseModel):
    """VLM analiz yanıtı"""
    task: str
    analysis: str
    confidence: float
    content_type: str  # "text", "table", "diagram", "chart", "mixed"

@app.on_event("startup")
async def load_model():
    """Sunucu başlatıldığında model yükle"""
    global model, processor, device
    
    logger.info("🖼️ Qwen3-VL-4B-Instruct model yükleniyor...")
    
    # Device seç
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"📍 Device: {device}")
    
    model_name = "Qwen/Qwen3-VL-4B-Instruct"
    try:
        # Processor ve model yükle
        processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)
        model = Qwen2VLForConditionalGeneration.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device.type == "cuda" else torch.float32,
            attn_implementation="flash_attention_2" if device.type == "cuda" else "eager",
            device_map="auto" if device.type == "cuda" else None
        )
        
        if device.type == "cpu":
            model = model.to(device)
        
        model.eval()
        logger.info("✅ VLM Model başarıyla yüklendi")
    except Exception as e:
        logger.error(f"❌ Model yükleme hatası: {e}")
        raise

@app.post("/analyze", response_model=VLMResponse)
async def analyze_image(request: VLMRequest) -> VLMResponse:
    """
    Görsel analiz yap - tablo, diagram, metin çıkar
    
    Args:
        request.image_base64: Base64 encoded görsel
        request.task: Ne yapılacak (extract, describe, table, diagram)
        request.language: Hangi dilde sonuç istediğimiz
    
    Returns:
        VLMResponse: Analiz sonucu
    """
    if not model or not processor:
        raise HTTPException(status_code=500, detail="Model yüklenmedi")
    
    try:
        logger.info(f"🖼️ Görsel analizi başladı (task={request.task})")
        
        # Base64'ten görsele dönüştür
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(BytesIO(image_data)).convert("RGB")
        
        # Görev spesifik prompt'lar - İçerik TÜRÜNÜ tespit et
        prompts = {
            "extract": "Bu görselde tablo var mı? Diyagram var mı? Grafik var mı? Sadece şu cevaplardan birini ver: 'TABLO', 'DIYAGRAM', 'GRAFIK', 'METIN'. Başka birşey yazma!",
            "describe": "Bu görseli kısaca açıkla. Ne görmektedir? Türkçe olarak cevap ver.",
            "table": "Bu görselde tablo var mı? Varsa tablo içeriğini Markdown formatında göster. Türkçe olarak cevap ver.",
            "diagram": "Bu görselde diyagram, grafik veya şekil var mı? Varsa ne anlattığını açıkla. Türkçe olarak cevap ver.",
        }
        
        prompt = prompts.get(request.task, prompts["extract"])
        
        # Modeli çalıştır
        with torch.no_grad():
            # Görseli ve prompt'u processor'a gönder
            inputs = processor(
                text=prompt,
                images=[image],
                return_tensors="pt"
            ).to(device)
            
            # Model inference
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.1,  # Deterministik cevap
                top_p=0.95,
            )
            
            # Sonucu decode et
            analysis = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        # VLM sonucundan içerik türünü çıkar
        analysis_lower = analysis.lower()
        
        # İçerik türünü belirle (VLM hatasına karşı fallback)
        if "tablo" in analysis_lower:
            content_type = "table"
            # Tabloyu OCR ile çıkar
            try:
                ocr_text = pytesseract.image_to_string(image, lang='tur+eng')
                analysis = f"[TABLO]\n\n{ocr_text}\n\n[VLM Açıklaması]\n{analysis}"
            except:
                pass
        elif "diyagram" in analysis_lower or "şema" in analysis_lower:
            content_type = "diagram"
        elif "grafik" in analysis_lower or "chart" in analysis_lower or "grafik" in analysis_lower:
            content_type = "chart"
        else:
            # Fallback: OCR ile metin çıkar
            content_type = "text"
            try:
                ocr_text = pytesseract.image_to_string(image, lang='tur+eng')
                if ocr_text.strip():
                    analysis = f"{ocr_text}\n\n[VLM Açıklaması]\n{analysis}"
            except:
                pass
        
        logger.info(f"✅ Analiz tamamlandı (type={content_type})")
        logger.info(f"   Sonuç: {analysis[:100]}...")
        
        return VLMResponse(
            task=request.task,
            analysis=analysis,
            confidence=0.90,
            content_type=content_type
        )
        
    except Exception as e:
        logger.error(f"❌ Analiz hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analiz hatası: {str(e)}")

@app.get("/health")
async def health():
    """Sunucu sağlık kontrolü"""
    return {
        "status": "healthy",
        "model": "Qwen/Qwen3-VL-4B-Instruct",
        "device": str(device),
        "model_loaded": model is not None
    }

@app.get("/")
async def root():
    """Ana sayfa"""
    return {
        "name": "Qwen3 VLM Server",
        "version": "1.0",
        "endpoints": [
            "/analyze (POST) - Görsel analiz et",
            "/health (GET) - Sunucu durumu"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
