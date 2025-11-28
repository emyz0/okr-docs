#!/usr/bin/env python3
"""
HuggingFace Inference API ile Qwen2.5-32B test
"""

import requests
import os
from dotenv import load_dotenv

# .env.local'den token oku
load_dotenv()
HF_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

if not HF_TOKEN:
    print("❌ HUGGINGFACE_API_KEY ayarlanmadı!")
    exit(1)

MODEL_NAME = "Qwen/Qwen2-VL-32B-Instruct"  # 32B Vision Language Model

headers = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json"
}

def call_llm(prompt):
    """
    HuggingFace Inference API ile LLM çağır
    """
    payload = {
        "inputs": prompt,  # ✅ Doğru format
        "parameters": {
            "max_new_tokens": 512,
            "temperature": 0.2,
            "top_p": 0.95
        }
    }

    print(f"📡 API'ye istek gönderiliyor...")
    print(f"   Model: {MODEL_NAME}")
    print(f"   Prompt: {prompt[:50]}...")

    response = requests.post(
        f"https://router.huggingface.co/models/{MODEL_NAME}",  # ✅ Updated endpoint
        headers=headers,
        json=payload,
        timeout=120
    )

    print(f"📡 Status Code: {response.status_code}")

    if response.status_code != 200:
        print(f"❌ Hata: {response.text}")
        return None

    output = response.json()
    
    try:
        # Format: [{"generated_text": "..."}]
        if isinstance(output, list) and len(output) > 0:
            return output[0]["generated_text"]
        else:
            return output
    except Exception as e:
        print(f"❌ Parse hatası: {e}")
        print(f"   Response: {output}")
        return None

# Test çağrısı
if __name__ == "__main__":
    test_prompt = "Merhaba! Sen kimsin?"
    
    result = call_llm(test_prompt)
    
    if result:
        print(f"\n✅ Cevap:")
        print(f"{result}")
    else:
        print(f"\n❌ Cevap alınamadı")
