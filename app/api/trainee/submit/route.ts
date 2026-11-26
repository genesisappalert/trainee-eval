import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { TraineeSheet, Appraisal, Cycle, RosterEntry, AuditLog } from '@/lib/models';
import { createHash } from 'crypto';

// POST /api/trainee/submit — Submit a completed trainee sheet
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { token, signatureDataUrl, answers } = body;

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

    // Merge any final answers and normalize comment keys
    const mergedAnswers: Record<string, any> = {
      ...(sheet.answers || {}),
      ...(answers || {}),
    };
    for (let i = 1; i <= 5; i++) {
      const cVal = mergedAnswers[`t_c${i}`] ?? mergedAnswers[`t_r${i}_comment`];
      if (cVal !== undefined) {
        mergedAnswers[`t_c${i}`] = cVal;
        mergedAnswers[`t_r${i}_comment`] = cVal;
      }
    }
    if (signatureDataUrl) {
      mergedAnswers.t_signature = signatureDataUrl;
      mergedAnswers.t_signature_svg = signatureDataUrl;
      sheet.signatureKey = signatureDataUrl;
      sheet.signedAt = now;
    }
    if (!mergedAnswers.t_signature_date) {
      mergedAnswers.t_signature_date = now.toISOString().split('T')[0];
    }

    sheet.answers = mergedAnswers;
    sheet.markModified('answers');
    sheet.status = 'submitted';
    sheet.submittedAt = now;
    sheet.submitIp = ip;
    await sheet.save();

    // Update appraisal identity & status
    if (mergedAnswers.t_name) appraisal.traineeName = mergedAnswers.t_name;
    if (mergedAnswers.t_staff_id) appraisal.traineeStaffId = String(mergedAnswers.t_staff_id).trim().toUpperCase();
    if (mergedAnswers.t_email) appraisal.traineeEmail = mergedAnswers.t_email;
    if (mergedAnswers.t_department) appraisal.department = mergedAnswers.t_department;
    if (mergedAnswers.t_location) appraisal.location = mergedAnswers.t_location;
    if (mergedAnswers.t_supervisor && mergedAnswers.t_supervisor !== 'unassigned') {
      appraisal.supervisorId = mergedAnswers.t_supervisor;
      appraisal.flags = appraisal.flags.filter((f: string) => f !== 'unassigned');
    }

    // Link to RosterEntry if not already linked
    if (appraisal.traineeStaffId && !appraisal.rosterEntryId) {
      const rosterMatch = await RosterEntry.findOne({
        cycleId: cycle._id,
        staffId: appraisal.traineeStaffId,
      });
      if (rosterMatch) {
        appraisal.rosterEntryId = rosterMatch._id;
        appraisal.flags = appraisal.flags.filter((f: string) => f !== 'unmatched');
        if (!rosterMatch.appraisalId) {
          rosterMatch.appraisalId = appraisal._id;
          await rosterMatch.save();
        }
      }
    }

    appraisal.status = 'awaiting_supervisor';
    appraisal.traineeSubmittedAt = now;
    await appraisal.save();

    await AuditLog.create({
      actorType: 'trainee',
      actorId: appraisal.traineeStaffId || appraisal._id.toString(),
      actorRole: 'trainee',
      action: 'trainee_sheet_submitted',
      targetType: 'appraisal',
      targetId: appraisal._id.toString(),
      cycleId: cycle._id,
      metadata: {
        traineeStaffId: appraisal.traineeStaffId,
        traineeName: appraisal.traineeName,
        overallRating: mergedAnswers.t_overall,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Your appraisal has been submitted successfully.',
    });
  } catch (error) {
    console.error('Error submitting trainee sheet:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
