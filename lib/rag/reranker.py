#!/usr/bin/env python3
"""
🤖 QWEN3 RERANKER MODULE
Qwen/Qwen3-Reranker-4B modelini kullanarak dokümantasyonu query'ye göre sıralar
Direct Python import olarak çalışır (FastAPI server'a gerek yok)
"""

import torch
import torch.nn.functional as F
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from typing import List, Dict
import logging

# Logging ayarla
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model ve tokenizer (lazy loading - ilk çalıştırıldığında yüklenir)
_model = None
_tokenizer = None
_device = None

def _load_model():
    """Model ve tokenizer'ı lazy load et"""
    global _model, _tokenizer, _device
    
    if _model is not None:
        return _model, _tokenizer, _device
    
    logger.info("🤖 Qwen3-Reranker-4B model yükleniyor...")
    
    # Device seç (GPU varsa kullan)
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"📍 Device: {_device}")
    
    # Model ve tokenizer yükle
    model_name = "Qwen/Qwen3-Reranker-4B"
    try:
        _tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        
        # Padding token'ını ayarla - Qwen için kritik!
        if _tokenizer.pad_token is None:
            _tokenizer.pad_token = "<|endoftext|>"  # Qwen pad token'ı
        
        logger.info(f"✅ Tokenizer yüklendi (pad_token={_tokenizer.pad_token}, pad_token_id={_tokenizer.pad_token_id})")
        
        _model = AutoModelForSequenceClassification.from_pretrained(
            model_name, 
            trust_remote_code=True,
            torch_dtype=torch.float32,
            pad_token_id=_tokenizer.pad_token_id  # Kritik! Model'a pad_token_id'yi ver
        ).to(_device)
        _model.eval()  # Evaluation mode
        
        logger.info("✅ Model başarıyla yüklendi")
        return _model, _tokenizer, _device
        
    except Exception as e:
        logger.error(f"❌ Model yükleme hatası: {e}")
        raise

def rerank_documents(
    query: str,
    documents: List[str],
    top_k: int = 3
) -> List[Dict]:
    """
    Sorgu ve dokümanlara göre rerank yapıp en iyi sonuçları döndür
    
    Args:
        query: Arama sorgusu
        documents: Dokümantasyon listesi
        top_k: Kaç tane döndürülecek (default: 3)
    
    Returns:
        List[Dict]: Sıralanmış dokümantasyon
        [
            {
                "index": 0,
                "document": "...",
                "score": 0.95
            },
            ...
        ]
    """
    # Model ve tokenizer'ı yükle
    model, tokenizer, device = _load_model()
    
    if not documents:
        logger.warning("⚠️ Dokümantasyon listesi boş")
        return []
    
    try:
        logger.info(f"🔄 Reranking başladı: sorgu='{query[:50]}...', dokü={len(documents)}")
        
        # Her dokümantı sorgu ile pair yap
        pairs = [[query, doc] for doc in documents]
        
        # Tokenize et - daha kısa max_length ve padding kontrolü
        with torch.no_grad():
            inputs = tokenizer(
                pairs,
                padding=True,  # Dinamik padding
                truncation=True,
                return_tensors='pt',
                max_length=128  # Daha kısa - inference'ı hızlandır
            ).to(device)
            
            logger.info(f"   ✅ Tokenize başarılı: input shape={inputs['input_ids'].shape}")
            logger.info(f"   📝 Input keys: {list(inputs.keys())}")
            logger.info(f"   🔧 Attention mask: {inputs['attention_mask'][0][:20]}...")
            
            # Model çalıştır
            try:
                logger.info(f"   🚀 Model inference başladı...")
                # Explicit attention mask ve token_type_ids ekle
                model_inputs = {
                    'input_ids': inputs['input_ids'],
                    'attention_mask': inputs['attention_mask']
                }
                if 'token_type_ids' in inputs:
                    model_inputs['token_type_ids'] = inputs['token_type_ids']
                
                outputs = model(**model_inputs)
                logger.info(f"   ✅ Model inference başarılı, logits shape={outputs.logits.shape}")
                
                # Logits shape: (batch_size, num_labels=2)
                # Label 0: not-relevant, Label 1: relevant
                # Logits'i softmax ile probability'ye dönüştür
                logits = outputs.logits
                logger.info(f"   📊 Logits sample: {logits[0].detach().cpu().tolist()}")
                
                probs = F.softmax(logits, dim=-1)  # Softmax
                logger.info(f"   📊 Probs sample: {probs[0].detach().cpu().tolist()}")
                
                scores = probs[:, 1].cpu().tolist()  # Relevant class'ın probability'si
                logger.info(f"   ✅ Scores hesaplandı: {scores[:3]}...")
                
            except Exception as e:
                logger.error(f"   ❌ Model output hatası: {str(e)}")
                logger.error(f"      Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"      Traceback: {traceback.format_exc()}")
                # Fallback: outputlar olduğu gibi kullan
                scores = [float(i) for i in range(len(documents))]
                logger.warning(f"   ⚠️ Fallback score'lar kullanılıyor: {scores}")
        
        # Skor ile indeks pair yap
        scored_docs = [
            {
                "index": idx,
                "document": doc,
                "score": float(score)
            }
            for idx, (doc, score) in enumerate(zip(documents, scores))
        ]
        
        # Skor'a göre azalan sırada sırala
        ranked = sorted(scored_docs, key=lambda x: x["score"], reverse=True)
        
        # Top K al
        top_k = min(top_k, len(ranked))
        ranked = ranked[:top_k]
        
        logger.info(f"✅ Reranking tamamlandı: top {top_k} seçildi")
        logger.info(f"   En yüksek skor: {ranked[0]['score']:.4f}")
        
        return ranked
        
    except Exception as e:
        logger.error(f"❌ Reranking hatası: {str(e)}")
        raise

if __name__ == "__main__":
    # Test
    query = "Türkiye'nin başkenti neresi?"
    documents = [
        "Ankara, Türkiye'nin başkenti. Ankara, Anadolu'nun ortasında yer alır.",
        "İstanbul, Türkiye'nin en büyük şehridir.",
    ]
    
    result = rerank_documents(query, documents, top_k=2)
    print("\n✅ Reranking Result:")
    for item in result:
        print(f"  [{item['index']}] Score: {item['score']:.4f} - {item['document'][:50]}...")
