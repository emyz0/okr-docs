#!/bin/bash
# 🚀 VLM Server - Lokal Transformers ile Başlat
# Qwen2.5-VL-7B-Instruct (GPU/CPU)

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🖼️  VLM SERVER (LOKAL TRANSFORMERS)"
echo "═══════════════════════════════════════════════════════════════"

# Ortam değişkenleri
export VLM_MODEL="Qwen/Qwen2.5-VL-7B-Instruct"

# .env.local yükle (opsiyonel - lokal inference için gerek yok)
if [ -f ".env.local" ]; then
    echo "📝 .env.local yükleniyor..."
    export $(grep -v '^#' .env.local | xargs)
fi

# Virtual environment
if [ ! -d "vlm_env" ]; then
    echo "🔨 Virtual environment oluşturuluyor..."
    python3 -m venv vlm_env
fi

source vlm_env/bin/activate

# Dependencies
echo "📦 Dependencies kontrol..."
if ! python -c "import torch" 2>/dev/null; then
    echo "📥 Paketler yükleniyor (ilk sefer uzun sürebilir)..."
    pip install -q -r vlm_transformers_requirements.txt
fi

# Device kontrol
if python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}')" | grep -q "CUDA: True"; then
    DEVICE="GPU (CUDA)"
else
    DEVICE="CPU"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Server başlatılıyor..."
echo "   Model: $VLM_MODEL"
echo "   Provider: Lokal Transformers"
echo "   Device: $DEVICE"
echo "   Port: 8001"
echo "   Health: http://localhost:8001/health"
echo "═══════════════════════════════════════════════════════════════"
echo ""

python vlm_transformers_server.py

