"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

interface NewsImage {
  id: string
  haberKodu: string
  resimKodu: string
  fullUrl: string
  thumbUrl: string
  base64Data: string
  description: string | null
  orderIndex: number
}

interface EditData {
  id?: string
  haberKodu?: string
  title: string
  subtitle: string
  body: string
  category: string
  aiScore: number
  biasScore: number
  biasExplanation: string
  legalRisk: string
  legalIssues: Array<{
    type: string
    severity: number
    location: string
    flaggedText: string
    suggestion: string
  }>
  seoKeywords: string[]
  readability: number
  requiresManualReview: boolean
}

export default function EditPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState<NewsImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  
  const [data, setData] = useState<EditData>({
    title: "",
    subtitle: "",
    body: "",
    category: "",
    aiScore: 0,
    biasScore: 0,
    biasExplanation: "",
    legalRisk: "low",
    legalIssues: [],
    seoKeywords: [],
    readability: 0,
    requiresManualReview: false
  })
  
  const [selectedImage, setSelectedImage] = useState<NewsImage | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  
  useEffect(() => {
    // URL'den session data'yı çek
    const sessionId = searchParams.get("session")
    if (sessionId) {
      fetchEditData(sessionId)
    } else {
      setLoading(false)
    }
  }, [searchParams])

  const fetchEditData = async (sessionId: string) => {
    try {
      // Geçici olarak localStorage'dan veri çek (production'da API'dan gelecek)
      const stored = localStorage.getItem(`edit_session_${sessionId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setData(parsed)
        
        console.log('📄 Edit data yüklendi:', { haberKodu: parsed.haberKodu, id: parsed.id })
        
        // Görselleri yükle - haberKodu varsa öncelik ver
        if (parsed.haberKodu) {
          await fetchImages(parsed.haberKodu, true) // haberKodu ile ara
        } else if (parsed.id) {
          // id aslında haberKodu formatındaysa (20251106AW... gibi) onu kullan
          const isHaberKoduFormat = /^\d{8}AW\d+$/.test(parsed.id)
          await fetchImages(parsed.id, isHaberKoduFormat)
        }
      }
    } catch (error) {
      console.error("Edit data yüklenemedi:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchImages = async (identifier: string, isHaberKodu: boolean = true) => {
    setLoadingImages(true)
    try {
      // identifier genelde haberKodu'dur (20251106AW574302 formatında)
      const paramName = isHaberKodu ? 'haberKodu' : 'newsId'
      const res = await fetch(`/api/news/images?${paramName}=${identifier}`)
      const result = await res.json()
      
      console.log(`🖼️ Görsel API çağrısı: ${paramName}=${identifier}`, result)
      
      if (result.success && result.images) {
        setImages(result.images)
        console.log(`✅ ${result.images.length} görsel yüklendi`)
        // İlk görseli otomatik seç
        if (result.images.length > 0) {
          setSelectedImage(result.images[0])
          setImagePreview(result.images[0].base64Data)
        }
      } else {
        console.warn('⚠️ Görsel bulunamadı:', result)
      }
    } catch (error) {
      console.error("❌ Görseller yüklenemedi:", error)
    } finally {
      setLoadingImages(false)
    }
  }
  
  const handleSave = async () => {
    setSaving(true)
    try {
      // Database'e kaydet - tüm data'yı gönder (backend'de _publishData kullanacak)
      const res = await fetch("/api/news/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          imageUrl: selectedImage?.base64Data || "",
          imageDescription: selectedImage?.description || ""
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        // Session'ı temizle
        const sessionId = searchParams.get("session")
        if (sessionId) {
          localStorage.removeItem(`edit_session_${sessionId}`)
        }
        
        alert("✅ Haber başarıyla kaydedildi ve yayınlandı!")
        router.push("/kayitlar")
      } else {
        alert("❌ Kaydetme hatası: " + result.error)
      }
    } catch (error) {
      console.error("Kaydetme hatası:", error)
      alert("❌ Kaydetme hatası!")
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Haber yükleniyor...</p>
        </div>
      </div>
    )
  }
  
  const getLegalRiskColor = () => {
    switch (data.legalRisk) {
      case "critical": return "bg-red-600 text-white"
      case "high": return "bg-orange-600 text-white"
      case "medium": return "bg-yellow-500 text-gray-900"
      default: return "bg-green-600 text-white"
    }
  }
  
  const getBiasColor = () => {
    if (data.biasScore > 60) return "bg-red-600 text-white"
    if (data.biasScore > 40) return "bg-orange-500 text-white"
    if (data.biasScore > 20) return "bg-yellow-500 text-gray-900"
    return "bg-green-600 text-white"
  }
  
  const getAIScoreColor = () => {
    if (data.aiScore > 40) return "bg-red-600 text-white"
    if (data.aiScore > 25) return "bg-orange-500 text-white"
    if (data.aiScore > 10) return "bg-yellow-500 text-gray-900"
    return "bg-green-600 text-white"
  }
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">📝 Haber Düzenleme</h1>
            <p className="text-gray-600">Haber yayınlanmadan önce düzenleyin ve analiz sonuçlarını inceleyin</p>
          </div>
          <a
            href="/"
            className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ← Dashboard
          </a>
        </div>
        
        {/* Manuel İnceleme Uyarısı */}
        {data.requiresManualReview && (
          <div className="bg-red-50 border-2 border-red-600 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold text-red-900 mb-1">⚠️ MANUEL İNCELEME GEREKLİ</p>
                <p className="text-red-800 text-sm">
                  Bu haber yüksek riskli içerik barındırıyor. Hukuk/Editör danışmanı ile mutlaka inceleyin!
                  {data.category === "siyaset" && " (Siyasi içerik - özel denetim gerekli)"}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Siyasi İçerik Özel Uyarısı */}
        {data.category === "siyaset" && (
          <div className="bg-blue-50 border-2 border-blue-600 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-bold text-blue-900 mb-1">🏛️ SİYASİ İÇERİK TESPİT EDİLDİ</p>
                <p className="text-blue-800 text-sm">
                  Bu haber siyasi içerikli. Tarafsızlık ve nötr dil kullanımına özellikle dikkat edin. 
                  Tüm siyasi partilerin görüşlerine dengeli yer verildiğinden emin olun.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-3 gap-6">
          {/* Sol Panel - İçerik Düzenleme */}
          <div className="col-span-2 space-y-6">
            {/* Başlık */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">BAŞLIK</label>
              <input
                type="text"
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-bold focus:border-blue-500 focus:outline-none"
                placeholder="Haber başlığı..."
              />
            </div>
            
            {/* Alt Başlık */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">ALT BAŞLIK</label>
              <input
                type="text"
                value={data.subtitle}
                onChange={(e) => setData({ ...data, subtitle: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Kısa özet..."
              />
            </div>
            
            {/* İçerik */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">İÇERİK</label>
              <textarea
                value={data.body}
                onChange={(e) => setData({ ...data, body: e.target.value })}
                rows={20}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg font-mono text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Haber içeriği..."
              />
              <div className="mt-2 text-sm text-gray-600">
                Kelime sayısı: <span className="font-bold">{data.body.split(/\s+/).filter(Boolean).length}</span>
              </div>
            </div>
            
            {/* Görsel Seçimi */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <label className="block text-sm font-bold text-gray-700 mb-4">📷 HABER GÖRSELLERİ</label>
              
              {loadingImages && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-600">Görseller yükleniyor...</p>
                </div>
              )}
              
              {!loadingImages && images.length === 0 && (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 mb-2">Bu habere ait görsel bulunamadı</p>
                  <p className="text-xs text-gray-500">RSS'de görsel yoktu veya indirilemedi</p>
                </div>
              )}
              
              {!loadingImages && images.length > 0 && (
                <div className="space-y-4">
                  {/* Seçili Görsel Önizlemesi */}
                  {selectedImage && (
                    <div className="border-2 border-blue-500 rounded-lg overflow-hidden">
                      <div className="bg-blue-500 text-white px-4 py-2 text-sm font-bold">
                        ✓ Seçili Görsel {selectedImage.orderIndex && `(${selectedImage.orderIndex}/${images.length})`}
                      </div>
                      <img 
                        src={selectedImage.base64Data}
                        alt={selectedImage.description || "Haber görseli"}
                        className="w-full h-auto"
                      />
                      {selectedImage.description && (
                        <div className="bg-gray-50 px-4 py-3 text-sm text-gray-700">
                          <p className="font-semibold mb-1">📝 Açıklama:</p>
                          <p>{selectedImage.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Görsel Galerisi */}
                  {images.length > 1 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3">
                        Diğer Görseller ({images.length - 1}):
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {images.map((img) => (
                          <button
                            key={img.id}
                            onClick={() => {
                              setSelectedImage(img)
                              setImagePreview(img.base64Data)
                            }}
                            className={`relative border-2 rounded-lg overflow-hidden hover:border-blue-400 transition-colors ${
                              selectedImage?.id === img.id ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-300'
                            }`}
                          >
                            <img 
                              src={img.base64Data}
                              alt={img.description || `Görsel ${img.orderIndex}`}
                              className="w-full h-24 object-cover"
                            />
                            <div className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                              {img.orderIndex}
                            </div>
                            {selectedImage?.id === img.id && (
                              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Kaydet Butonu */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <button
                onClick={handleSave}
                disabled={saving || !data.title || !data.body}
                className="w-full px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold rounded-lg text-lg transition-colors disabled:cursor-not-allowed"
              >
                {saving ? "Kaydediliyor..." : "✅ HABERİ KAYDET VE YAYINLA"}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Kaydet butonuna bastıktan sonra haber veritabanına kaydedilecek ve yayınlanacaktır
              </p>
            </div>
          </div>
          
          {/* Sağ Panel - Analiz Sonuçları */}
          <div className="space-y-6">
            {/* Hukuki Risk */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                Hukuki Risk
              </h3>
              <div className={`px-4 py-3 rounded-lg text-center ${getLegalRiskColor()} mb-4`}>
                <p className="text-2xl font-black uppercase">{data.legalRisk}</p>
              </div>
              
              {data.legalIssues.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-red-600">⚠️ Tespit Edilen Sorunlar:</p>
                  {data.legalIssues.map((issue, idx) => (
                    <div key={idx} className="bg-red-50 border-l-4 border-red-600 p-3 text-sm">
                      <p className="font-bold text-red-900 mb-1">
                        {issue.type.toUpperCase()} (Ciddiyet: {issue.severity}/10)
                      </p>
                      <p className="text-gray-700 mb-2">
                        <span className="font-semibold">Yer:</span> {issue.location}
                      </p>
                      <p className="text-gray-700 mb-2">
                        <span className="font-semibold">Sorun:</span> "{issue.flaggedText?.substring(0, 100)}..."
                      </p>
                      <p className="text-green-800">
                        <span className="font-semibold">Öneri:</span> {issue.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              
              {data.legalIssues.length === 0 && (
                <p className="text-sm text-green-600">✅ Hukuki sorun tespit edilmedi</p>
              )}
            </div>
            
            {/* Bias Skoru */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Bias Skoru (Yanlılık)
              </h3>
              <div className={`px-4 py-6 rounded-lg text-center ${getBiasColor()} mb-3`}>
                <p className="text-4xl font-black mb-2">{data.biasScore}%</p>
                <p className="text-sm opacity-90">
                  {data.biasScore < 20 ? "Tarafsız" :
                   data.biasScore < 40 ? "Hafif yanlı" :
                   data.biasScore < 60 ? "Orta yanlı" :
                   "Yüksek yanlılık"}
                </p>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 text-sm">
                <p className="font-bold text-blue-900 mb-1">Bias Nedir?</p>
                <p className="text-gray-700">
                  {data.biasExplanation || "Bias (yanlılık), haberin belirli bir görüşe veya tarafa kayması demektir. Tarafsız gazetecilik tüm tarafları dengeli yansıtmalıdır."}
                </p>
              </div>
            </div>
            
            {/* SEO Anahtar Kelimeleri */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                SEO Anahtar Kelimeler
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.seoKeywords.length > 0 ? (
                  data.seoKeywords.map((kw, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {kw}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">SEO keyword bulunamadı</p>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-3">
                Bu kelimeler SEO için metne otomatik olarak eklenmiştir. 
                Google aramalarında daha görünür olmanızı sağlar.
              </p>
            </div>
            
            {/* Okunabilirlik */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold mb-4">📖 Okunabilirlik Skoru</h3>
              <div className="bg-gray-100 rounded-lg p-4 text-center">
                <p className="text-3xl font-black text-gray-900">{data.readability}%</p>
                <p className="text-sm text-gray-600 mt-1">
                  {data.readability >= 70 ? "Kolay okunur ✅" : "Zor okunur ⚠️"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}