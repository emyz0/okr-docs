#!/bin/bash
# 🤖 QWEN3 RERANKER SERVER SETUP SCRIPT

echo "🚀 Qwen3 Reranker Server Kurulum Başladı"
echo "========================================"

# Python versiyonu kontrolü
echo "🐍 Python sürümü kontrol ediliyor..."
python3 --version

# Virtual environment oluştur (eğer yoksa)
if [ ! -d "reranker_env" ]; then
    echo "📦 Virtual environment oluşturuluyor..."
    python3 -m venv reranker_env
fi

# Virtual environment'i aktifleştir
echo "🔌 Virtual environment aktifleştiriliyor..."
source reranker_env/bin/activate

# Bağımlılıkları yükle
echo "📥 Bağımlılıklar yükleniyor (ilk kez biraz uzun sürebilir)..."
pip install --upgrade pip
pip install -r reranker_requirements.txt

echo ""
echo "✅ Kurulum tamamlandı!"
echo "========================================"
echo ""
echo "🎯 Qwen3 Reranker Server'ı başlatmak için:"
echo "   python3 reranker_server.py"
echo ""
echo "veya arka planda çalıştırmak için:"
echo "   nohup python3 reranker_server.py > reranker.log 2>&1 &"
echo ""
echo "Server sağlığını kontrol etmek için:"
echo "   curl http://localhost:8000/health"
echo ""
