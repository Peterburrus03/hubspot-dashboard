import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

const BD_CONTEXT = readFileSync(join(process.cwd(), 'lib/ai/bd-context.md'), 'utf-8')

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }
  const body = await req.json()

  // Prepend BD context to any system prompt provided by the caller
  const enrichedBody = {
    ...body,
    system: body.system
      ? `${BD_CONTEXT}\n\n---\n\n${body.system}`
      : BD_CONTEXT,
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(enrichedBody),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
