export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
// 🔗 chain.ts’ten sorgu fonksiyonunu getir
import { queryRAG } from '@lib/rag/chain.ts'

export async function POST(req: NextRequest) {
  try {
    const { question, userId } = await req.json()
    if (!question) {
      return NextResponse.json({ error: 'Soru eksik' }, { status: 400 })
    }

    // 🔥 gerçek sorgu
    const { answer, sources } = await queryRAG({ question, userId: userId || 'default-user' })

    return NextResponse.json({
      success: true,
      answer,
      sources,
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message || 'Hata' }, { status: 500 })
  }
}