#!/usr/bin/env python3
"""
🤖 QWEN3 RERANKER SERVER
FastAPI ile Qwen/Qwen3-Reranker-4B modelini çalıştıran server
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import logging

# Logging ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Qwen3 Reranker Server", version="1.0")

# Global model ve tokenizer (sunucu başlangıcında yüklenir)
model = None
tokenizer = None
device = None

class RerankerRequest(BaseModel):
    """Reranking isteği"""
    query: str
    documents: List[str]
    top_k: int = 10

class RerankerResponse(BaseModel):
    """Reranking yanıtı"""
    query: str
    ranked_documents: List[dict]  # [{"index": 0, "document": "...", "score": 0.95}, ...]
    total_documents: int

@app.on_event("startup")
async def load_model():
    """Sunucu başlatıldığında model yükle"""
    global model, tokenizer, device
    
    logger.info("🤖 Qwen3-Reranker-4B model yükleniyor...")
    
    # Device seç (GPU varsa kullan)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"📍 Device: {device}")
    
    # Model ve tokenizer yükle
    model_name = "Qwen/Qwen3-Reranker-4B"
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        
        # Padding token'ını ayarla - Qwen için kritik!
        if tokenizer.pad_token is None:
            tokenizer.pad_token = "<|endoftext|>"  # Qwen pad token'ı
        
        logger.info(f"✅ Tokenizer yüklendi (pad_token={tokenizer.pad_token}, pad_token_id={tokenizer.pad_token_id})")
        
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name, 
            trust_remote_code=True,
            torch_dtype=torch.float32,
            pad_token_id=tokenizer.pad_token_id  # Kritik! Model'a pad_token_id'yi ver
        ).to(device)
        model.eval()  # Evaluation mode
        
        logger.info("✅ Model başarıyla yüklendi")
    except Exception as e:
        logger.error(f"❌ Model yükleme hatası: {e}")
        raise

@app.post("/rerank", response_model=RerankerResponse)
async def rerank(request: RerankerRequest) -> RerankerResponse:
    """
    Sorgu ve dokümanlara göre rerank yapıp en iyi sonuçları döndür
    
    Args:
        request.query: Arama sorgusu
        request.documents: Dokümantasyon listesi
        request.top_k: Kaç tane döndürülecek
    
    Returns:
        RerankerResponse: Sıralanmış dokümantasyon
    """
    if not model or not tokenizer:
        raise HTTPException(status_code=500, detail="Model yüklenmedi")
    
    if not request.documents:
        raise HTTPException(status_code=400, detail="Dokümantasyon boş")
    
    try:
        logger.info(f"🔄 Reranking başladı: sorgu='{request.query[:50]}...', dokü={len(request.documents)}")
        
        # Her dokümantı sorgu ile pair yap
        pairs = [[request.query, doc] for doc in request.documents]
        
        # Tokenize et - batch processing optimize et
        with torch.no_grad():
            # Daha küçük batch'ler ile işle (CPU'da daha hızlı)
            batch_size = 4
            all_scores = []
            
            for i in range(0, len(pairs), batch_size):
                batch_pairs = pairs[i:i+batch_size]
                
                inputs = tokenizer(
                    batch_pairs,
                    padding="max_length",  # Explicit padding
                    truncation=True,
                    return_tensors='pt',
                    max_length=256  # CPU performansı için düşürdük (512'den)
                ).to(device)
                
                logger.info(f"   � Batch {i//batch_size + 1}: {len(batch_pairs)} pair işleniyor...")
                
                # Model çalıştır
                try:
                    outputs = model(**inputs)
                    probs = F.softmax(outputs.logits, dim=-1)  # Softmax
                    batch_scores = probs[:, 1].cpu().tolist()  # Relevant class'ın probability'si
                    all_scores.extend(batch_scores)
                    
                except Exception as e:
                    logger.error(f"   ❌ Batch hatası: {str(e)}")
                    # Fallback: bu batch için dummy scores
                    all_scores.extend([0.5] * len(batch_pairs))
            
            scores = all_scores
            logger.info(f"   ✅ Scores hesaplandı: {scores[:3]}...")
        
        # Skor ile indeks pair yap
        scored_docs = [
            {
                "index": idx,
                "document": doc,
                "score": float(score)
            }
            for idx, (doc, score) in enumerate(zip(request.documents, scores))
        ]
        
        # Skor'a göre azalan sırada sırala
        ranked = sorted(scored_docs, key=lambda x: x["score"], reverse=True)
        
        # Top K al
        top_k = min(request.top_k, len(ranked))
        ranked = ranked[:top_k]
        
        logger.info(f"✅ Reranking tamamlandı: top {top_k} seçildi")
        logger.info(f"   En yüksek skor: {ranked[0]['score']:.4f}")
        
        return RerankerResponse(
            query=request.query,
            ranked_documents=ranked,
            total_documents=len(request.documents)
        )
        
    except Exception as e:
        logger.error(f"❌ Reranking hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reranking hatası: {str(e)}")

@app.get("/health")
async def health():
    """Sunucu sağlık kontrolü"""
    return {
        "status": "healthy",
        "model": "Qwen/Qwen3-Reranker-4B",
        "device": str(device),
        "model_loaded": model is not None
    }

@app.get("/")
async def root():
    """Ana sayfa"""
    return {
        "name": "Qwen3 Reranker Server",
        "version": "1.0",
        "endpoints": [
            "/rerank (POST) - Dokümantasyonu sırala",
            "/health (GET) - Sunucu durumu"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
