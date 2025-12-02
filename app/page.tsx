// 'use client' direktifi: Bu component'in client-side'da çalışacağını Next.js'e söyler
// Çünkü useState, useEffect gibi React hooks kullanıyoruz (server'da kullanılamaz)
'use client';
import { useState, useEffect } from 'react';

// Source Interface: Veritabanından gelen kaynak bilgisinin yapısını tanımlar
// id: veritabanındaki unique kimlik
// source: PDF dosyasının adı (hangi belgeden geldi)
// chunk: Bu kaynağın kaçıncı bölümü (chunk) olduğu
// page: Hangi sayfada bulunduğu
// lineNumber: Başladığı satır numarası
// has_images: Kaynakta görsel/tablo içeriği var mı? 🖼️
// metadata: Ek bilgiler (sayfa numarası, satır numarası vs.)
interface Source {
  id: number;
  source: string;
  chunk: number;
  page: any;
  lineNumber: any;
  has_images?: boolean;  // 🖼️
  metadata: any;
}

// QueryResponse Interface: API'dan dönen yanıtın yapısını tanımlar
// success: İşlem başarılı mı?
// answer: Model'in ürettiği cevap metni
// sources: Cevabın hangi kaynaklardan alındığı
// sectionId: Cevabın kaydedildiği section'ın ID'si (yeni oluşturulduysa)
// error: Hata mesajı (varsa)
interface QueryResponse {
  success: boolean;
  answer: string;
  sources: Source[];
  sectionId?: number;
  error?: string;
}

// PDF Interface: Sistemdeki yüklü dosyaların bilgisini tanımlar
// name: Dosyanın adı
// fileType: Dosya tipi (.pdf, .xlsx, .docx, .txt)
// chunkCount: Kaç bölüme (chunk) ayrıldığı
interface PDF {
  name: string;
  fileType?: string;
  chunkCount: number;
}

// ConversationTurn Interface: Soru-cevap geçmişinin yapısını tanımlar
// question: Sorulan soru
// answer: Model'in cevabı
// sources: Kaynaklar (hafif versiyon - sadece metadata, embedding yok)
// has_images: Kaynakta görsel/tablo var mı?
interface ConversationTurn {
  question: string;
  answer: string;
  sources: {
    source: string;
    chunk: number;
    page: any;
    lineNumber: any;
    id: number;
    has_images?: boolean;  // 🖼️
  }[];
}

export default function Home() {
  // ===== SORU-CEVAP KISMININ STATE'LERİ =====
  // question: Kullanıcının sorusunu tutar
  const [question, setQuestion] = useState('');
  
  // answer: Model'in ürettiği cevabı tutar (ilk boş, soru sorulduktan sonra doldurulur)
  const [answer, setAnswer] = useState('');
  
  // sources: Cevabın dayandığı kaynakları tutar (PDF, sayfa, satır vb.)
  const [sources, setSources] = useState<Source[]>([]);
  
  // ===== CONVERSATION HISTORY (DEVAM SORULARI İÇİN) =====
  // Önceki soru-cevap çiftlerini saklayıp LLM'e context olarak veririz
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);

  // ===== PDF YÜKLEME KISMININ STATE'LERİ =====
  // pdfFiles: Kullanıcının seçtiği PDF dosyalarını tutar (multiple seçim destekli)
  const [pdfFiles, setPdfFiles] = useState<FileList | null>(null);
  
  // uploadStatus: Yükleme sonucunu gösterir (başarılı, başarısız, hata mesajları)
  const [uploadStatus, setUploadStatus] = useState('');
  
  // uploadKey: File input'u sıfırlamak için kullanılır
  // Key değiştiğinde React bileşeni yeniden oluşturur, input temizlenir
  const [uploadKey, setUploadKey] = useState(0);

  // ===== SECTION YÖNETİMİ =====
  // sections: Kullanıcının conversation history'leri (her biri bir section)
  const [sections, setSections] = useState<any[]>([]);
  // currentSectionId: Şu an aktif olan section
  const [currentSectionId, setCurrentSectionId] = useState<number | null>(null);
  // loadingSections: Section'lar yükleniyor mu?
  const [loadingSections, setLoadingSections] = useState(true);

  // ===== PDF SEÇİM KISMININ STATE'LERİ =====
  // availablePdfs: Sistemde yüklü olan tüm PDF'lerin listesi
  // Her PDF'in adı ve kaç chunk'a bölündüğü bilgisini içerir
  const [availablePdfs, setAvailablePdfs] = useState<PDF[]>([]);
  
  // selectedPdfs: Kullanıcının soru sorarken kullanmak istediği PDF'lerin adlarını tutar
  // Checkbox'larla seçim/deseleksiyon yapılır
  const [selectedPdfs, setSelectedPdfs] = useState<string[]>([]);
  
  // loadingPdfs: PDF listesi yükleniyor mu? (yükleme animasyonu için)
  const [loadingPdfs, setLoadingPdfs] = useState(true);
  
  // pdfSearchQuery: PDF listesinde arama için
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');

  // ===== SAYFA YÜKLENMEĞINDE PDF'LERİ GETIR =====
  // useEffect: Bileşen DOM'a eklendiğinde bir kere çalışır (boş dependency array)
  // Sayfa açılır açılmaz kullanıcının yüklemiş olduğu tüm PDF'leri getirerek listeler
  useEffect(() => {
    fetchAvailablePdfs();
    fetchSections(); // 🆕 Section'ları da getir
  }, []);

  // ===== FUNCTION: SİSTEMDE YÜKLÜ PDF'LERİ GETIR =====
  // Bu fonksiyon /api/rag/pdfs endpoint'ine istek gönderir
  // Veritabanında demo-user için yüklü olan tüm PDF'leri getirir
  const fetchAvailablePdfs = async () => {
    try {
      // Backend'e istek: userId=demo-user olan tüm PDF'leri getir
      const res = await fetch('/api/rag/pdfs?userId=demo-user');
      const data = await res.json();
      
      if (data.success) {
        // Gelen PDF listesini state'e kaydet
        setAvailablePdfs(data.pdfs);
        // Varsayılan olarak TÜM PDF'leri seçili yapıyoruz
        // Böylece kullanıcı istenmedikçe hepsini sorgulamada kullanır
        setSelectedPdfs(data.pdfs.map((p: PDF) => p.name));
      }
    } catch (err) {
      console.error('PDF listesi yüklenemedi:', err);
    } finally {
      // Başarı/hata ne olursa olsun yükleme bitti gösterisini kaldır
      setLoadingPdfs(false);
    }
  };

  // 🆕 FUNCTION: SECTION'LARI GETIR
  const fetchSections = async () => {
    try {
      const res = await fetch('/api/rag/sections?userId=demo-user');
      const data = await res.json();

      if (data.success) {
        setSections(data.sections);
        // En yeni section'ı otomatik seç (varsa)
        if (data.sections.length > 0) {
          setCurrentSectionId(data.sections[0].id);
        }
      }
    } catch (err) {
      console.error('Section\'lar yüklenemedi:', err);
    } finally {
      setLoadingSections(false);
    }
  };

  // 🆕 FUNCTION: SECTION SİL
  const handleDeleteSection = async (sectionId: number) => {
    try {
      const res = await fetch('/api/rag/sections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, userId: 'demo-user' })
      });

      const data = await res.json();
      if (data.success) {
        // State'den sil
        setSections(sections.filter(s => s.id !== sectionId));
        // Eğer silinen section açıksa, başka bir section seç
        if (currentSectionId === sectionId) {
          const remaining = sections.filter(s => s.id !== sectionId);
          setCurrentSectionId(remaining.length > 0 ? remaining[0].id : null);
        }
        console.log('✅ Section silindi');
      }
    } catch (err) {
      console.error('Section silme hatası:', err);
    }
  };

  // 🆕 FUNCTION: Dosya listesine yeni dosya ekle (mevcut dosyaları koruyarak)
  const addFilesToSelection = (newFiles: FileList | null) => {
    if (!newFiles) return;
    
    // Mevcut dosya isimlerinin setini oluştur (duplikasyon kontrolü için)
    const existingNames = pdfFiles ? Array.from(pdfFiles).map(f => f.name) : [];
    
    // Yeni dosyaları DataTransfer ile birleştir
    const dt = new DataTransfer();
    
    // Eski dosyaları ekle
    if (pdfFiles) {
      Array.from(pdfFiles).forEach(file => {
        dt.items.add(file);
      });
    }
    
    // Yeni dosyaları ekle (eğer zaten yoksa)
    Array.from(newFiles).forEach(file => {
      if (!existingNames.includes(file.name)) {
        dt.items.add(file);
      }
    });
    
    // Birleştirilmiş FileList'i set et
    setPdfFiles(dt.files);
  };

  // ===== FUNCTION: PDF DOSYALARINI SUNUCUYA YÜKLE =====
  // Kullanıcının seçtiği PDF dosyalarını FormData ile upload eder
  const handlePDFUpload = async () => {
    // Validasyon: En az 1 PDF seçilmiş mi?
    if (!pdfFiles || pdfFiles.length === 0) {
      setUploadStatus('Lütfen en az bir PDF seçin.');
      return;
    }

    // Kullanıcıya yükleniyor mesajını göster
    setUploadStatus('⏳ Yükleniyor...');

    // FormData kullanarak dosyaları gönderiyoruz
    // FormData multipart/form-data format'ında veri göndermek için JavaScript'in standart yoludur
    const formData = new FormData();
    
    // Seçilen tüm dosyaları döngüyle FormData'ya ekle
    Array.from(pdfFiles).forEach((file) => {
      // Console'a her eklenen dosyayı yaz (debug için)
      console.log('📄 Dosya ekleniyor:', file.name);
      formData.append('files', file);
    });
    
    // Backend'e userId de gönder (farklı kullanıcılar için ayrı belge depolamak için)
    formData.append('userId', 'demo-user');
    
    // Debug: Kaç tane dosya yükleneceğini göster
    console.log('📤 Total dosya sayısı:', pdfFiles.length);

    try {
      // POST isteği gönder /api/rag/upload endpoint'ine
      const res = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
        // FormData otomatik olarak Content-Type: multipart/form-data ayarlar
      });

      const data = await res.json();
      if (data.success) {
        // Başarı mesajını göster (ne kadar chunk kaydedildiğini bildir)
        setUploadStatus(`✅ ${data.message}`);
        // 1 saniye sonra PDF listesini yenile (veritabanındaki yeni PDF'leri görmek için)
        setTimeout(() => {
          fetchAvailablePdfs();
          // Section'ları refresh etmiyoruz - kullanıcı aktif konuşmasını korumak için
        }, 1000);
        // File input'u tamamen sıfırla (yeni dosya seçimini temizle)
        setPdfFiles(null);
        // Key'i değiştirerek input DOM'dan çıkarılıp yeniden oluşturulsun (state sıfırlanması için)
        setUploadKey(prev => prev + 1);
      } else {
        // Hata varsa kullanıcıya göster
        setUploadStatus('❌ Yükleme başarısız: ' + data.error);
      }
    } catch (err) {
      // Network hatası vs. durumda
      setUploadStatus('❌ Sunucu hatası: ' + (err as Error).message);
    }
  };

  // ===== FUNCTION: PDF SEÇİMİNİ TOGGLE ET =====
  // Checkbox'a tıklanınca bu fonksiyon çalışır
  // Eğer PDF daha önce seçiliyse kaldır, değilse ekle
  const togglePdfSelection = (pdfName: string) => {
    setSelectedPdfs(prev =>
      prev.includes(pdfName)
        // Seçiliyse: filtreleyerek çıkar (deselect)
        ? prev.filter(p => p !== pdfName)
        // Seçili değilse: array'e ekle (select)
        : [...prev, pdfName]
    );
    // NOT: PDF seçimi değişse bile, aktif section'ı koruyoruz
    // Kullanıcı aynı section'da farklı PDF'lerle devam edebilir
  };

  // ===== FUNCTION: SORU GÖNDER VE CEVAP AL =====
  // Form'dan (textarea) submit olduğunda çalışır
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Form'un default davranışını (sayfayı yenileme) engelle
    
    // Boş soru gönderme kontrolü
    if (!question.trim()) return;

    // En az 1 PDF seçilmiş mi kontrolü
    if (selectedPdfs.length === 0) {
      setAnswer('❌ Lütfen en az bir PDF seçin.');
      return;
    }

    // Kullanıcıya "çalışıyor" göstergesi
    setAnswer('⏳ Cevap aranıyor...');
    // Eski kaynakları temizle
    setSources([]);

    try {
      // /api/rag/query endpoint'ine POST isteği gönder
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question,              // Kullanıcının sorusu
          userId: 'demo-user',   // Hangi kullanıcı için
          selectedPdfs: selectedPdfs.length > 0 ? selectedPdfs : undefined,  // Hangi PDF'lerden arama yapılacak
          conversationHistory,   // Önceki soru-cevaplar (devam bağlamı için)
          sectionId: currentSectionId  // 🆕 Hangi section'a kaydetmeli
        }),
      });

      const data: QueryResponse = await res.json();
      if (data.success) {
        // Cevapı ve kaynaklarını göster
        setAnswer(data.answer || 'Cevap alınamadı.');
        setSources(data.sources || []);
        
        // 🆕 Eğer yeni section oluşturulduysa, onu set et
        if (data.sectionId) {
          setCurrentSectionId(data.sectionId);
          // Section'ları refresh et
          fetchSections();
        }
        
        // ✅ Yeni soru-cevabı conversation history'e ekle
        // ÖNEMLI: Sources'dan sadece metadata'yı tut (embedding vektörleri gibi ağır veriler olmadan)
        const lightSources = (data.sources || []).map((s: any) => ({
          source: s.source,
          chunk: s.chunk,
          page: s.page,
          lineNumber: s.lineNumber,
          id: s.id
        }));
        
        setConversationHistory([
          ...conversationHistory,
          {
            question: question,
            answer: data.answer || 'Cevap alınamadı.',
            sources: lightSources
          }
        ]);
        
        // Textarea'yı temizle (sonraki soru için) - AMA CEVAP VE KAYNAKLAR GÖSTER!
        setQuestion('');
      } else {
        // Hata mesajı göster
        setAnswer(data.error || 'Cevap alınamadı.');
      }
    } catch (err) {
      // Network hatası
      setAnswer('❌ Soru gönderilirken hata oluştu: ' + (err as Error).message);
    }
  };

  return (
    // Main container: Arka planında gradyan renkli (slate -> purple)
    // min-h-screen: Minimum ekran yüksekliği kadar kaplasın
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Center container: max-w-5xl ile maksimum genişlik sınırlandırılır */}
      <div className="max-w-5xl mx-auto">
        {/* Başlık */}
        <h1 className="text-4xl font-bold text-white mb-2">📚 RAG Model Arayüzü</h1>
        {/* Alt başlık */}
        <p className="text-gray-400 mb-8">Dosyalarınızdan (PDF, Excel, Word, TXT) akıllıca cevaplar alın</p>

        {/* 3 sütunlu grid layout:
            - Sol sütun (1 sütun): PDF Upload + PDF Seçim
            - Sağ sütun (2 sütun): Soru + Cevap
            Desktop'ta 3 sütun, mobile'ta 1 sütun (responsive)
        */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ===== SOL SÜTUN: PDF YÖNETİMİ ===== */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 🆕 --- SECTION'LAR (CONVERSATION HISTORY) --- */}
            <div className="bg-slate-800 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">💬 Konuşmalar</h2>
                {/* + YENİ BUTONU */}
                <button
                  onClick={() => {
                    setCurrentSectionId(null);
                    setConversationHistory([]);
                    setAnswer('');
                    setSources([]);
                    setQuestion('');
                  }}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
                  title="Yeni konuşma başlat"
                >
                  + Yeni
                </button>
              </div>
              
              {loadingSections ? (
                <p className="text-gray-400 text-sm">Yükleniyor...</p>
              ) : sections.length === 0 ? (
                <p className="text-gray-400 text-sm">Henüz soru sorulmamış</p>
              ) : (
                /* VERTICAL LIST */
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className={`p-3 rounded-lg cursor-pointer transition group relative ${
                        currentSectionId === section.id
                          ? 'bg-blue-600/60 border border-blue-400'
                          : 'bg-slate-700/50 border border-transparent hover:bg-slate-700/70 hover:border-slate-600'
                      }`}
                      onClick={() => {
                        setCurrentSectionId(section.id);
                        setConversationHistory(section.messages || []);
                        setAnswer('');
                        setSources([]);
                      }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-blue-300 truncate">{section.title}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {section.messages?.length || 0} soru
                          </p>
                        </div>
                        {/* DELETE BUTONU */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSection(section.id);
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded px-2 py-1 transition opacity-0 group-hover:opacity-100"
                          title="Sil"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* --- PDF YÜKLEME SECTION --- */}
            <div className="bg-slate-800 rounded-lg p-6 border border-purple-500/20">
              <h2 className="text-xl font-semibold text-white mb-4">📂 Dosyaları Yükle</h2>
              <div className="space-y-4">
                {/* FILE INPUT: Çoklu dosya seçimine izin verir (PDF, Excel, Word, TXT) */}
                <div 
                  className="border-2 border-dashed border-purple-500/50 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-purple-500', 'bg-purple-500/10');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-500/10');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-purple-500', 'bg-purple-500/10');
                    addFilesToSelection(e.dataTransfer.files);
                  }}
                >
                  <input
                    key={uploadKey}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.docx,.txt"
                    multiple
                    onChange={(e) => addFilesToSelection(e.target.files)}
                    className="hidden"
                    id="file-input"
                  />
                  <label htmlFor="file-input" className="block cursor-pointer">
                    <p className="text-gray-300 text-sm">📁 Dosyaları buraya sürükle veya tıkla</p>
                    <p className="text-gray-500 text-xs mt-1">PDF, Excel, Word, TXT desteklenir</p>
                    {pdfFiles && pdfFiles.length > 0 && (
                      <div className="text-purple-400 text-sm font-semibold mt-3 p-3 bg-purple-900/20 rounded max-h-48 overflow-y-auto">
                        <div className="flex justify-between items-center mb-2">
                          <p>📋 Seçilen dosyalar ({pdfFiles.length}):</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPdfFiles(null);
                              setUploadKey(prev => prev + 1);
                            }}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition"
                          >
                            ✕ Temizle
                          </button>
                        </div>
                        <ul className="space-y-1 text-xs">
                          {Array.from(pdfFiles).map((file, idx) => (
                            <li key={idx} className="text-purple-300 flex justify-between items-center group">
                              <span>• {file.name}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const dt = new DataTransfer();
                                  Array.from(pdfFiles).forEach((f, i) => {
                                    if (i !== idx) dt.items.add(f);
                                  });
                                  setPdfFiles(dt.files.length > 0 ? dt.files : null);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-lg transition"
                                title="Dosyayı kaldır"
                              >
                                ✕
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </label>
                </div>
                
                {/* YÜKLE BUTONU */}
                <button
                  type="button"
                  onClick={handlePDFUpload} // onClick: Fakat submit değil (form içinde değil)
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                >
                  ⬆️ Dosyaları Yükle
                </button>
                
                {/* YÜKLEME SONUCU MESAJI (Başarı/Hata) */}
                {uploadStatus && (
                  <p className={`text-sm p-3 rounded ${uploadStatus.includes('✅') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {uploadStatus}
                  </p>
                )}
              </div>
            </div>

            {/* --- PDF SEÇİM SECTION --- */}
            <div className="bg-slate-800 rounded-lg p-6 border border-blue-500/20">
              <h2 className="text-xl font-semibold text-white mb-4">✅ Dosyaları Seç</h2>
              
              {/* Yükleniyor göstergesi */}
              {loadingPdfs ? (
                <p className="text-gray-400">Dosyalar yükleniyor...</p>
              ) : availablePdfs.length === 0 ? (
                // Hiç PDF yoksa
                <p className="text-gray-400 text-sm">Henüz dosya yüklenmemiş</p>
              ) : (
                // Dosyaların checkbox listesi
                <div className="space-y-4">
                  {/* 🔍 ARAMA BOX + SELECT ALL / DESELECT ALL BUTONLARI */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="🔍 Dosya adı ile ara..."
                      value={pdfSearchQuery}
                      onChange={(e) => setPdfSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition"
                    />
                    
                    {/* SELECT ALL / DESELECT ALL BUTONLARI */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const filteredNames = availablePdfs
                            .filter(pdf => pdf.name.toLowerCase().includes(pdfSearchQuery.toLowerCase()))
                            .map(pdf => pdf.name);
                          setSelectedPdfs([...new Set([...selectedPdfs, ...filteredNames])]);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition"
                      >
                        ✓ Tümünü Seç
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          const filteredNames = availablePdfs
                            .filter(pdf => pdf.name.toLowerCase().includes(pdfSearchQuery.toLowerCase()))
                            .map(pdf => pdf.name);
                          setSelectedPdfs(selectedPdfs.filter(name => !filteredNames.includes(name)));
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition"
                      >
                        ✗ Seçimi Kaldır
                      </button>
                    </div>
                  </div>
                  
                  {/* FİLTRELENMİŞ DOSYA LİSTESİ */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {availablePdfs
                      .filter(pdf => pdf.name.toLowerCase().includes(pdfSearchQuery.toLowerCase()))
                      .map((pdf) => (
                    // Her PDF için checkbox
                    <label key={pdf.name} className="flex items-center p-3 bg-slate-700/50 rounded cursor-pointer hover:bg-slate-700/70 transition">
                      {/* CHECKBOX */}
                      <input
                        type="checkbox"
                        checked={selectedPdfs.includes(pdf.name)} // Seçili mi kontrolü
                        onChange={() => togglePdfSelection(pdf.name)} // Toggle fonksiyon çalıştır
                        className="w-4 h-4 rounded accent-purple-500"
                      />
                      {/* PDF BİLGİSİ */}
                      <div className="ml-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {pdf.fileType === '.xlsx' || pdf.fileType === '.xls' ? '📊' :
                             pdf.fileType === '.docx' ? '📝' :
                             pdf.fileType === '.txt' ? '📄' : '📑'}
                          </span>
                          <p className="text-sm font-semibold text-white truncate">{pdf.name}</p>
                        </div>
                        <p className="text-xs text-gray-400">{pdf.chunkCount} chunk</p>
                      </div>
                    </label>
                  ))}
                  </div>
                  
                  {/* Kaç PDF seçildiğini göster + filtreleme sonucu */}
                  <p className="text-xs text-gray-500 mt-3">
                    Seçili: {selectedPdfs.length} / {availablePdfs
                      .filter(pdf => pdf.name.toLowerCase().includes(pdfSearchQuery.toLowerCase())).length}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ===== SAĞ SÜTUN: SORU-CEVAP ===== */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* --- SORU SORMA SECTION --- */}
            <div className="bg-slate-800 rounded-lg p-6 border border-purple-500/20">
              <h2 className="text-xl font-semibold text-white mb-4">❓ Soru Sor</h2>
              {/* Form: onSubmit ile Enter'e de yanıt verir */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* SORU TEXTAREA */}
                <textarea
                  placeholder="Sorunuzu yazın..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)} // Yazı yazarken state'i güncelle
                  className="w-full h-32 p-4 bg-slate-700 text-white border border-purple-500/30 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
                />
                
                {/* CEVAP AL BUTONU */}
                <button
                  type="submit" // Form submit (Enter tuşuna da yanıt verir)
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
                >
                  🚀 Cevap Al
                </button>
              </form>
            </div>

            {/* --- CEVAP VE KAYNAKLAR SECTION (Cevap varsa göster) --- */}
            {answer && (
              <div className="space-y-6">
                
                {/* MODEL'İN CEVABI */}
                <div className="bg-slate-800 rounded-lg p-6 border border-blue-500/20">
                  <h3 className="text-lg font-semibold text-blue-400 mb-3">💬 Model Cevabı</h3>
                  {/* whitespace-pre-wrap: Satır kırılmalarını korur */}
                  <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{answer}</p>
                </div>

                {/* KAYNAKLAR LİSTESİ (Kaynaklar varsa göster) */}
                {sources.length > 0 && (
                  <div className="bg-slate-800 rounded-lg p-6 border border-purple-500/20">
                    <h3 className="text-lg font-semibold text-purple-400 mb-4">📖 Kaynaklar</h3>
                    <div className="space-y-3">
                      {/* Her kaynak için kart */}
                      {sources.map((source, idx) => (
                        <div key={idx} className="bg-slate-700/50 rounded p-4 border-l-4 border-purple-500">
                          {/* KAYNAK BAŞLIĞI: PDF adı */}
                          <p className="text-sm font-semibold text-purple-300">
                            📑 {source.source}
                            {source.has_images && <span className="ml-2 text-yellow-400 text-xs font-normal">🖼️ İçeriyor</span>}
                          </p>
                          
                          {/* KAYNAK DETAYLARI: Chunk, Sayfa, Satır, ID */}
                          <div className="text-xs text-gray-400 mt-2 space-y-1">
                            {source.chunk && <p>� Chunk: {source.chunk}</p>}
                            {source.page && source.page !== 'N/A' && <p>� Sayfa: {source.page}</p>}
                            {source.lineNumber && source.lineNumber !== 'N/A' && <p>📍 Satır: {source.lineNumber}</p>}
                            <p>ID: {source.id}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- CONVERSATION HISTORY (ÖNCEKİ SORULAR) --- */}
            {conversationHistory.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-6 border border-green-500/20">
                <h3 className="text-lg font-semibold text-green-400 mb-4">📚 Soru-Cevap Geçmişi ({conversationHistory.length})</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {conversationHistory.map((turn, idx) => (
                    <div key={idx} className="bg-slate-700/50 rounded p-4 border-l-4 border-green-500">
                      <p className="text-sm font-semibold text-green-300 mb-2">❓ Soru {idx + 1}: {turn.question}</p>
                      <p className="text-sm text-gray-300 mb-3 leading-relaxed whitespace-pre-wrap">{turn.answer}</p>
                      
                      {/* KAYNAKLAR: Geçmiş cevaplardaki kaynakları göster */}
                      {turn.sources && turn.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          <p className="text-xs font-semibold text-purple-400 mb-2">📖 Kaynaklar ({turn.sources.length}):</p>
                          <div className="space-y-2">
                            {turn.sources.map((source, srcIdx) => (
                              <div key={srcIdx} className="text-xs bg-slate-600/50 rounded p-2 pl-3 border-l-2 border-purple-400">
                                <p className="text-purple-300 font-semibold">
                                  {source.source}
                                  {source.has_images && <span className="ml-2 text-yellow-400 text-xs font-normal">🖼️ İçeriyor</span>}
                                </p>
                                <div className="text-gray-400 mt-1 space-y-0.5">
                                  {source.chunk && <p>• Chunk: {source.chunk}</p>}
                                  {source.page && source.page !== 'N/A' && <p>• Sayfa: {source.page}</p>}
                                  {source.lineNumber && source.lineNumber !== 'N/A' && <p>• Satır: {source.lineNumber}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}