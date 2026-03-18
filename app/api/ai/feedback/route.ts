import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function POST(req: NextRequest) {
  try {
    const { skill, contactName, feedback } = await req.json()
    if (!skill || !feedback?.trim()) {
      return NextResponse.json({ error: 'Missing skill or feedback' }, { status: 400 })
    }
    const record = await prisma.aiFeedback.create({
      data: { skill, contactName: contactName || null, feedback: feedback.trim() }
    })
    return NextResponse.json({ ok: true, id: record.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const skill = req.nextUrl.searchParams.get('skill')
    const records = await prisma.aiFeedback.findMany({
      where: skill ? { skill } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json(records)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
