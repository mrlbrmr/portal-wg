import { NextRequest, NextResponse } from 'next/server'

// GET — verificação de webhook Meta Cloud API
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — módulo WhatsApp temporariamente desativado
export async function POST(_req: NextRequest) {
  return new NextResponse('ok', { status: 200 })
}
