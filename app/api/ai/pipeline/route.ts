import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { readFileSync } from 'fs'
import { join } from 'path'
import { format } from 'date-fns'

const BD_CONTEXT = readFileSync(join(process.cwd(), 'lib/ai/bd-context.md'), 'utf-8')

async function buildFeedbackBlock(skill?: string): Promise<string> {
  try {
    const records = await prisma.aiFeedback.findMany({
      where: skill ? { skill } : {},
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    if (!records.length) return ''

    const lines = records.map(r => {
      const date = format(new Date(r.createdAt), 'MMM d, yyyy')
      const who = r.contactName ? ` / ${r.contactName}` : ''
      return `- [${date}]${who}: "${r.feedback}"`
    })

    return `\n\n---\n\n## User Feedback From Previous Runs\n\nThe following feedback was provided by the team after reviewing prior AI recommendations. Incorporate it — correct errors, avoid repeating suggestions flagged as wrong, and reinforce approaches that were validated.\n\n${lines.join('\n')}`
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { skill, ...anthropicBody } = body

  const feedbackBlock = await buildFeedbackBlock(skill)
  const enrichedContext = `${BD_CONTEXT}${feedbackBlock}`

  const enrichedBody = {
    ...anthropicBody,
    system: anthropicBody.system
      ? `${enrichedContext}\n\n---\n\n${anthropicBody.system}`
      : enrichedContext,
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
