#!/bin/bash
# 🖼️ QWEN3 VLM SERVER SETUP SCRIPT

echo "🚀 Qwen3 VLM Server Kurulum Başladı"
echo "========================================"

# Python versiyonu kontrolü
echo "🐍 Python sürümü kontrol ediliyor..."
python3 --version

# Virtual environment oluştur (eğer yoksa)
if [ ! -d "vlm_env" ]; then
    echo "📦 Virtual environment oluşturuluyor..."
    python3 -m venv vlm_env
fi

# Virtual environment'i aktifleştir
echo "🔌 Virtual environment aktifleştiriliyor..."
source vlm_env/bin/activate

# Bağımlılıkları yükle
echo "📥 Bağımlılıklar yükleniyor (ilk kez biraz uzun sürebilir, özellikle torch)..."
pip install --upgrade pip
pip install -r vlm_requirements.txt

echo ""
echo "✅ Kurulum tamamlandı!"
echo "========================================"
echo ""
echo "🎯 Qwen3 VLM Server'ı başlatmak için:"
echo "   python3 vlm_server.py"
echo ""
echo "veya arka planda çalıştırmak için:"
echo "   nohup python3 vlm_server.py > vlm.log 2>&1 &"
echo ""
echo "Server sağlığını kontrol etmek için:"
echo "   curl http://localhost:8001/health"
echo ""
echo "⚠️ NOT: VLM modeli ilk kez ~10-15 dakika sürebilir (model indirme + yükleme)"
echo ""
