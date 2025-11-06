export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

// 🔗 chain.ts içinden GERÇEK ingest fonksiyonunu getiriyoruz
import { ingestDocument as ingestToPinecone } from '@lib/rag/chain.ts'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const userId = formData.get('userId')?.toString() || 'default-user'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
    }

    let totalChunks = 0

    for (const file of files) {
      const fileType = file.name.split('.').pop()?.toLowerCase()
      const buffer = Buffer.from(await file.arrayBuffer())
      let text = ''

      if (fileType === 'pdf') {
        const data = await pdfParse.default(buffer)
        text = data.text
      } else if (fileType === 'docx') {
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else if (fileType === 'txt') {
        text = buffer.toString()
      } else {
        continue
      }

      if (text && text.trim().length > 50) {
        // 🔥 artık Pinecone’a yazıyoruz
        const result = await ingestToPinecone({
          text,
          metadata: { fileName: file.name, fileType, fileSize: file.size },
          userId,
        })
        totalChunks += result.chunks
      }
    }

    return NextResponse.json({
      success: true,
      message: `📁 ${files.length} dosya yüklendi • Toplam ${totalChunks} parça oluşturuldu.`,
    })
  } catch (error: any) {
    console.error('Ingest API hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}