#!/usr/bin/env python3
"""
🖼️ QWEN VLM SERVER - HUGGING FACE INFERENCE API (OpenAI Compatible)
Hugging Face router.huggingface.co API'si ile Qwen Vision Language Model'i çalıştırır
Model: Qwen/Qwen2-VL-32B-Instruct (32 Milyar parametre)

OpenAI client'i kullanıyor (HF router'ı OpenAI-compatible endpoint sunuyor)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
from io import BytesIO
from PIL import Image
import logging
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# .env.local dosyasını yükle
load_dotenv()

# Logging ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Qwen VLM Server (HF Inference)", version="2.0")

# Hugging Face API anahtarı
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
if not HF_API_KEY:
    logger.warning("⚠️ HUGGINGFACE_API_KEY environment variable set edilmedi!")
    logger.warning("   .env.local dosyasına ekle: HUGGINGFACE_API_KEY=hf_...")

# Model seçim
MODEL_ID = "Qwen/Qwen2-VL-32B-Instruct"  # 32B Vision Language Model

# OpenAI-compatible client (HF router endpoint'ine)
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_API_KEY,
)

logger.info(f"🖼️ Model: {MODEL_ID}")
logger.info(f"   Provider: HuggingFace Router (OpenAI-compatible)")

class VLMRequest(BaseModel):
    """VLM analiz isteği"""
    image_base64: str  # Base64 encoded image
    task: str = "extract"  # "extract", "describe", "table", "diagram"
    language: str = "turkish"  # "turkish", "english"

class VLMResponse(BaseModel):
    """VLM analiz yanıtı"""
    task: str
    analysis: str
    confidence: float
    content_type: str  # "text", "table", "diagram", "chart", "mixed"

async def call_hf_inference(image: Image.Image, prompt: str) -> str:
    """
    Hugging Face Router API'ye çağrı yap (OpenAI-compatible)
    
    Args:
        image: PIL Image object
        prompt: Metin talimatı
    
    Returns:
        Model'in yanıtı (string)
    """
    if not HF_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="HUGGINGFACE_API_KEY ayarlanmadı. .env.local dosyasına ekle"
        )
    
    try:
        # Image'i base64'e encode et
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=95)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        
        logger.info(f"📡 HF Router'a istek gönderiliyor...")
        
        # OpenAI client kullanarak VLM çağrısı yap
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=512,
            temperature=0.2,
        )
        
        analysis = completion.choices[0].message.content
        
        logger.info(f"✅ Analiz başarılı: {analysis[:100]}...")
        return analysis
        
    except Exception as e:
        logger.error(f"❌ HF Router API çağrı hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API hatası: {str(e)}")

@app.post("/analyze", response_model=VLMResponse)
async def analyze_image(request: VLMRequest) -> VLMResponse:
    """
    Görsel analiz yap - tablo, diagram, metin çıkar
    (HF Inference API kullanarak)
    
    Args:
        request.image_base64: Base64 encoded görsel
        request.task: Ne yapılacak (extract, describe, table, diagram)
        request.language: Hangi dilde sonuç istediğimiz
    
    Returns:
        VLMResponse: Analiz sonucu
    """
    try:
        logger.info(f"🖼️ Görsel analizi başladı (task={request.task})")
        
        # Base64'ten görsele dönüştür
        image_data = base64.b64decode(request.image_base64)
        image = Image.open(BytesIO(image_data)).convert("RGB")
        
        # Görev spesifik prompt'lar
        prompts = {
            "extract": "Bu görselde tablo var mı? Diyagram var mı? Grafik var mı? Sadece şu cevaplardan birini ver: 'TABLO', 'DIYAGRAM', 'GRAFIK', 'METIN'. Başka birşey yazma!",
            "describe": "Bu görseli kısaca açıkla. Ne görmektedir? Türkçe olarak cevap ver.",
            "table": "Bu görselde tablo var mı? Varsa tablo içeriğini Markdown formatında göster. Türkçe olarak cevap ver.",
            "diagram": "Bu görselde diyagram, grafik veya şekil var mı? Varsa ne anlattığını açıkla. Türkçe olarak cevap ver.",
        }
        
        prompt = prompts.get(request.task, prompts["extract"])
        
        # HF Inference API'ye çağrı yap
        analysis = await call_hf_inference(image, prompt)
        
        # İçerik türünü belirle
        analysis_lower = analysis.lower()
        
        if "tablo" in analysis_lower:
            content_type = "table"
        elif "diyagram" in analysis_lower or "şema" in analysis_lower:
            content_type = "diagram"
        elif "grafik" in analysis_lower or "chart" in analysis_lower:
            content_type = "chart"
        else:
            content_type = "text"
        
        logger.info(f"✅ Analiz tamamlandı (type={content_type})")
        
        return VLMResponse(
            task=request.task,
            analysis=analysis,
            confidence=0.95,  # HF daha güvenilir
            content_type=content_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Analiz hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analiz hatası: {str(e)}")

@app.get("/health")
async def health():
    """Sunucu sağlık kontrolü"""
    return {
        "status": "healthy",
        "model": MODEL_ID,
        "type": "hugging_face_inference",
        "api_key_set": HF_API_KEY is not None
    }

@app.get("/")
async def root():
    """Ana sayfa"""
    return {
        "name": "Qwen VLM Server (HF Inference)",
        "version": "2.0",
        "model": MODEL_ID,
        "type": "hugging_face_inference_api",
        "endpoints": [
            "/analyze (POST) - Görsel analiz et",
            "/health (GET) - Sunucu durumu"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
