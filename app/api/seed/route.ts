import { NextRequest, NextResponse } from 'next/server';
import { runSeed } from '@/lib/seed';

export async function GET(request: NextRequest) {
  try {
    const res = await runSeed(false);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const res = await runSeed(body.force === true);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}
