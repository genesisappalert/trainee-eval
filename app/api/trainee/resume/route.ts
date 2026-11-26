import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import connectDB from '@/lib/db';
import { TraineeSheet, Appraisal } from '@/lib/models';

// POST /api/trainee/resume — Load an existing trainee sheet by private token
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token.trim()).digest('hex');
    const sheet = await TraineeSheet.findOne({ tokenHash });

    if (!sheet) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const appraisal = await Appraisal.findById(sheet.appraisalId);
    const normalizedAnswers: Record<string, any> = { ...(sheet.answers || {}) };
    for (let i = 1; i <= 5; i++) {
      const cVal = normalizedAnswers[`t_c${i}`] ?? normalizedAnswers[`t_r${i}_comment`];
      if (cVal !== undefined) {
        normalizedAnswers[`t_c${i}`] = cVal;
        normalizedAnswers[`t_r${i}_comment`] = cVal;
      }
    }

    return NextResponse.json({
      success: true,
      appraisalId: sheet.appraisalId.toString(),
      status: appraisal?.status === 'reopened' ? 'reopened' : sheet.status,
      answers: normalizedAnswers,
      signatureKey: sheet.signatureKey || normalizedAnswers.t_signature_svg || null,
      submittedAt: sheet.submittedAt,
    });
  } catch (error) {
    console.error('Error resuming trainee draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
