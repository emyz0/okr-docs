import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, MessageSquare, Loader2 } from 'lucide-react'

export function RAGChat({ userId }: { userId: string }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  /**
   * Soru sor
   */
  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true)
    setAnswer('')
    setSources([])

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, userId }),
      })

      const data = await res.json()
      if (data.success) {
        setAnswer(data.answer)
        setSources(data.sources || [])
      } else {
        setAnswer('Hata: ' + data.error)
      }
    } catch (error) {
      setAnswer('Bir hata oluştu.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Döküman yükle
   */
  // 1) Tek dosya yerine çoklu dosya kabul et
const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  if (!files || files.length === 0) return

  setUploading(true)

  try {
    const formData = new FormData()
    // Birden fazla dosyayı formData'ya ekle
    Array.from(files).forEach((file) => {
      formData.append('files', file) // backend için "files" olarak gönderiyoruz
    })
    formData.append('userId', userId)

    const res = await fetch('/api/rag/ingest', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    if (data.success) {
      alert(`✅ ${data.message}`)
    } else {
      alert('❌ Hata: ' + data.error)
    }
  } catch (error) {
    alert('❌ Yükleme başarısız')
    console.error(error)
  } finally {
    setUploading(false)
    e.target.value = '' // Input'u temizle
  }
}

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Döküman Yükleme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Döküman Yükle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              type="file"
              multiple          // ✅ EKLENDİ
              accept=".pdf,.docx,.txt"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading && (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            PDF, Word veya Text dosyası yükleyin
          </p>
        </CardContent>
      </Card>

      {/* Soru Sor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Soru Sor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Sorunuzu yazın... (örn: 'İzin politikası nedir?')"
            rows={3}
            disabled={loading}
          />
          <Button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Düşünüyor...
              </>
            ) : (
              'Sor'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Cevap */}
      {answer && (
        <Card>
          <CardHeader>
            <CardTitle>Cevap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{answer}</p>
            </div>

            {sources.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Kaynaklar:</h4>
                <div className="space-y-2">
                  {sources.map((source, i) => (
                    <div
                      key={i}
                      className="text-sm bg-muted p-3 rounded-md"
                    >
                      <p className="text-muted-foreground">
                        {source.content}
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        Dosya: {source.metadata?.fileName || 'Bilinmiyor'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}