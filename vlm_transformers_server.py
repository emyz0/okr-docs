#!/usr/bin/env python3
"""
🖼️ QWEN2.5-VL-7B-INSTRUCT + LOKAL TRANSFORMERS
Lokal GPU/CPU üzerinde FastAPI inference server
HF Inference API gerektirmez
"""

import os
import base64
import io
import logging
import torch
from PIL import Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoProcessor, AutoModelForVision2Seq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vlm")

MODEL_ID = "Qwen/Qwen2.5-VL-7B-Instruct"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
TORCH_DTYPE = torch.float16 if torch.cuda.is_available() else torch.float32

app = FastAPI(title="Qwen2.5-VL-7B (Lokal)", version="1.0")

class VLMRequest(BaseModel):
    image_base64: str
    task: str = "extract"
    language: str = "turkish"

class VLMResponse(BaseModel):
    task: str
    analysis: str
    confidence: float
    content_type: str

# Global yüklenen model
model = None
processor = None


# --------------------------------------------------------
# MODEL YÜKLEME
# --------------------------------------------------------
def init_model():
    """Model ve processor'ü lokal olarak yükle"""
    global model, processor
    try:
        logger.info(f"📥 Model indiriliyor / yükleniyor: {MODEL_ID}")
        logger.info(f"📟 Device: {DEVICE} | Dtype: {TORCH_DTYPE}")

        processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)

        model = AutoModelForVision2Seq.from_pretrained(
            MODEL_ID,
            torch_dtype=TORCH_DTYPE,
            device_map="auto" if DEVICE == "cuda" else None,
            trust_remote_code=True
        )

        if DEVICE == "cpu":
            model.to("cpu")

        logger.info(f"✅ Model yüklendi ve hazır")
        return True

    except Exception as e:
        logger.error(f"❌ Model yükleme hatası: {e}")
        return False


@app.on_event("startup")
async def startup():
    logger.info("🚀 VLM Server başlıyor...")
    init_model()



# --------------------------------------------------------
# INFERENCE FONKSİYONU
# --------------------------------------------------------
async def infer_with_model(image_base64: str, prompt: str) -> str:
    """Base64 image + prompt -> model output"""
    if model is None or processor is None:
        raise ValueError("Model not loaded")

    try:
        # Base64 görüntüyü çöz
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        logger.info(f"🔄 Qwen2.5-VL-7B çalışıyor ({DEVICE})...")

        # Chat formatı
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": prompt}
                ],
            }
        ]

        # Chat template → text prompt
        text_prompt = processor.apply_chat_template(
            messages, add_generation_prompt=True
        )

        # Tek bir birleşik processor çağrısı yeterli
        inputs = processor(
            text=[text_prompt],
            images=[image],
            padding=True,
            return_tensors="pt"
        ).to(DEVICE)

        # Generate
        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=1024,
            )

        result = processor.batch_decode(
            generated_ids, skip_special_tokens=True
        )[0]

        logger.info(f"✅ Model çıktı: {result[:80]}...")
        return result

    except Exception as e:
        logger.error(f"❌ Inference hatası: {e}")
        raise



# --------------------------------------------------------
# YARDIMCI — içerik tipi tespiti
# --------------------------------------------------------
def detect_content_type(analysis: str) -> str:
    text = analysis.lower()
    if "table" in text or "tablo" in text:
        return "table"
    if "grafik" in text or "chart" in text:
        return "chart"
    if "diagram" in text or "diyagram" in text or "şema" in text:
        return "diagram"
    return "text"



# --------------------------------------------------------
# API ENDPOINTS
# --------------------------------------------------------
@app.post("/analyze", response_model=VLMResponse)
async def analyze_image(request: VLMRequest) -> VLMResponse:
    try:
        logger.info(f"📥 Analiz isteği: task={request.task}")

        # Görev bazlı prompt seçimi
        prompts = {
            "extract": "Bu görselde ne var? (Tablo, grafik, diyagram, metin?) Kısaca cevapla.",
            "describe": "Bu görseli detaylı olarak Türkçe açıkla.",
            "table": "Eğer bu görselde tablo varsa, Markdown formatında çıkar. Yoksa 'Tablo yok' de.",
            "diagram": "Eğer bu görselde diyagram varsa, neyi gösterdiğini açıkla. Yoksa 'Diyagram yok' de."
        }

        prompt = prompts.get(request.task, prompts["extract"])

        # Modelden çıktı al
        analysis = await infer_with_model(request.image_base64, prompt)
        content_type = detect_content_type(analysis)

        logger.info(f"✅ Analiz tamamlandı. type={content_type}")

        return VLMResponse(
            task=request.task,
            analysis=analysis,
            confidence=0.95,
            content_type=content_type
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/health")
async def health():
    return {
        "status": "healthy" if model is not None else "loading",
        "model": MODEL_ID,
        "device": DEVICE,
        "dtype": str(TORCH_DTYPE),
        "model_loaded": model is not None
    }



@app.get("/")
async def root():
    return {
        "name": "Qwen2.5-VL-7B-Instruct (Lokal Transformers)",
        "endpoints": ["/analyze", "/health"],
        "device": DEVICE
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
