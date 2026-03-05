import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

const DEFAULT_PRIORITIES = [1, 2, 3, 4, 5].map((id) => ({ id, text: '', impact: '', done: false }))

export async function GET() {
  try {
    const rows = await prisma.priority.findMany({ orderBy: { id: 'asc' } })
    if (rows.length === 0) return NextResponse.json(DEFAULT_PRIORITIES)
    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    // body can be a single { id, text, impact, done } or an array of 5
    const items: { id: number; text: string; impact: string; done: boolean }[] = Array.isArray(body) ? body : [body]

    await Promise.all(
      items.map((item) =>
        prisma.priority.upsert({
          where: { id: item.id },
          update: { text: item.text, impact: item.impact, done: item.done },
          create: { id: item.id, text: item.text, impact: item.impact, done: item.done },
        })
      )
    )

    const rows = await prisma.priority.findMany({ orderBy: { id: 'asc' } })
    return NextResponse.json(rows)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 })
  }
}
