import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { TraineeSheet, Appraisal, Cycle } from '@/lib/models';
import { createHash } from 'crypto';

// POST /api/trainee/submit — Submit a completed trainee sheet
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { token, signatureDataUrl } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const sheet = await TraineeSheet.findOne({ tokenHash });

    if (!sheet) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (sheet.status === 'submitted') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 400 });
    }

    const appraisal = await Appraisal.findById(sheet.appraisalId);
    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    const cycle = await Cycle.findById(appraisal.cycleId);
    if (!cycle || cycle.status !== 'open') {
      return NextResponse.json({ error: 'Cycle is not open' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const now = new Date();

    // Store signature (in v1, store as base64 data URL; later move to object storage)
    if (signatureDataUrl) {
      sheet.signatureKey = signatureDataUrl;
      sheet.signedAt = now;
    }

    // Lock the sheet
    sheet.status = 'submitted';
    sheet.submittedAt = now;
    sheet.submitIp = ip;
    await sheet.save();

    // Update appraisal status
    appraisal.status = 'awaiting_supervisor';
    await appraisal.save();

    // TODO: Send confirmation email to trainee
    // TODO: Notify supervisor

    return NextResponse.json({
      success: true,
      message: 'Your appraisal has been submitted successfully.',
    });
  } catch (error) {
    console.error('Error submitting trainee sheet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
