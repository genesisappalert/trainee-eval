import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runSeed } from '@/lib/seed';

async function isAuthorizedForSeed(): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') return true;
  const session = await auth();
  const roles = ((session?.user as any)?.roles as string[]) || [];
  return roles.includes('superadmin') || roles.includes('hr_admin');
}

export async function GET(_request: NextRequest) {
  try {
    if (!(await isAuthorizedForSeed())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const res = await runSeed(false);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAuthorizedForSeed())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const res = await runSeed(body.force === true);
    return NextResponse.json(res);
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
}
