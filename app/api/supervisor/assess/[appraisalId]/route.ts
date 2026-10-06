import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Appraisal, TraineeSheet, SupervisorSheet, Cycle, FormVersion, AuditLog } from '@/lib/models';
import { SUPERVISOR_V1_FIELDS } from '@/lib/forms/definitions';

// GET: Fetch appraisal details, sanitized trainee answers, and existing supervisor answers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appraisalId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { appraisalId } = await params;

    const appraisal = await Appraisal.findById(appraisalId)
      .populate('cycleId')
      .populate('traineeSheetId')
      .populate('supervisorSheetId');

    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    // Authorization: supervisor must be assigned, or user must be hr_admin
    const isSupervisor = appraisal.supervisorId?.toString() === session.user.id;
    const isHr = (session.user as any).roles?.includes('hr_admin') || (session.user as any).roles?.includes('superadmin');

    if (!isSupervisor && !isHr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Trainee answers sanitization: S-10 & T-11: Trainee's confidential answers (t_r4, t_r4_comment, t_q3)
    // MUST NOT be visible to the supervisor
    let sanitizedTraineeAnswers: Record<string, any> = {};
    if (appraisal.traineeSheetId) {
      const traineeSheet = appraisal.traineeSheetId as any;
      const raw = traineeSheet.answers || {};
      for (const [key, value] of Object.entries(raw)) {
        if (key === 't_r4' || key === 't_r4_comment' || key === 't_q3') {
          // Confidential to HR — Redacted
          continue;
        }
        sanitizedTraineeAnswers[key] = value;
      }
    }

    // Get supervisor form version
    const cycle = appraisal.cycleId as any;
    const supervisorForm = await FormVersion.findById(cycle.supervisorFormVersionId);

    // Existing supervisor draft answers if any
    let supervisorAnswers: Record<string, any> = {};
    let supervisorStatus = 'not_started';
    if (appraisal.supervisorSheetId) {
      const supSheet = appraisal.supervisorSheetId as any;
      supervisorAnswers = supSheet.answers || {};
      supervisorStatus = supSheet.status || 'draft';
    }

    return NextResponse.json({
      appraisal: {
        _id: appraisal._id.toString(),
        traineeStaffId: appraisal.traineeStaffId,
        traineeName: appraisal.traineeName,
        traineeEmail: appraisal.traineeEmail,
        department: appraisal.department,
        location: appraisal.location,
        status: appraisal.status,
        flags: appraisal.flags,
        traineeSubmittedAt: appraisal.traineeSubmittedAt,
        supervisorSubmittedAt: appraisal.supervisorSubmittedAt,
        cycleName: cycle.name,
        supervisorDeadline: cycle.supervisorDeadline,
      },
      traineeAnswers: sanitizedTraineeAnswers,
      rawTraineeAnswers: isHr && appraisal.traineeSheetId ? (appraisal.traineeSheetId as any).answers : sanitizedTraineeAnswers,
      traineeSignatureSvg: appraisal.traineeSheetId ? ((appraisal.traineeSheetId as any).signatureSvg || (appraisal.traineeSheetId as any).signatureKey) : null,
      supervisorAnswers,
      supervisorStatus,
      currentUserName: session.user.name || '',
      formVersion: supervisorForm || { fields: SUPERVISOR_V1_FIELDS },
    });
  } catch (error: any) {
    console.error('Error fetching appraisal for assessment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Save supervisor draft (autosave)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ appraisalId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { appraisalId } = await params;
    const body = await request.json();
    const { answers } = body;

    const appraisal = await Appraisal.findById(appraisalId);
    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    const isSupervisor = appraisal.supervisorId?.toString() === session.user.id;
    const isHr = (session.user as any).roles?.includes('hr_admin') || (session.user as any).roles?.includes('superadmin');

    if (!isSupervisor && !isHr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // If already complete and not reopened, reject edit
    if (appraisal.status === 'complete' && !isHr) {
      return NextResponse.json({ error: 'This appraisal has already been submitted.' }, { status: 400 });
    }

    let sheet: any;
    if (appraisal.supervisorSheetId) {
      sheet = await SupervisorSheet.findById(appraisal.supervisorSheetId);
      if (sheet) {
        sheet.answers = { ...(sheet.answers || {}), ...answers };
        sheet.status = 'draft';
        await sheet.save();
      }
    }

    if (!sheet) {
      const cycle = await Cycle.findById(appraisal.cycleId);
      sheet = await SupervisorSheet.create({
        appraisalId: appraisal._id,
        supervisorId: session.user.id,
        formVersionId: cycle?.supervisorFormVersionId,
        answers: answers || {},
        status: 'draft',
      });
      appraisal.supervisorSheetId = sheet._id;
    }

    if (appraisal.status === 'awaiting_supervisor') {
      appraisal.status = 'supervisor_draft';
    }
    await appraisal.save();

    return NextResponse.json({ success: true, savedAt: new Date() });
  } catch (error: any) {
    console.error('Error saving supervisor draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Final Submission
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appraisalId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { appraisalId } = await params;
    const body = await request.json();
    const { answers } = body;

    const appraisal = await Appraisal.findById(appraisalId);
    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    const isSupervisor = appraisal.supervisorId?.toString() === session.user.id;
    const isHr = (session.user as any).roles?.includes('hr_admin') || (session.user as any).roles?.includes('superadmin');

    if (!isSupervisor && !isHr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Required fields validation
    const requiredRatings = ['s_r1', 's_r2', 's_r3', 's_r4', 's_r5', 's_r6', 's_r7'];
    for (const r of requiredRatings) {
      if (!answers[r]) {
        return NextResponse.json({ error: `Missing required rating for item ${r}` }, { status: 400 });
      }
    }

    if (!answers.s_overall) {
      return NextResponse.json({ error: 'Overall assessment rating is required.' }, { status: 400 });
    }
    if (!answers.s_signature_name) {
      return NextResponse.json({ error: 'Supervisor signature name is required.' }, { status: 400 });
    }

    const now = new Date();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    let sheet: any;
    if (appraisal.supervisorSheetId) {
      sheet = await SupervisorSheet.findById(appraisal.supervisorSheetId);
      if (sheet) {
        sheet.answers = answers;
        sheet.status = 'submitted';
        sheet.submittedAt = now;
        sheet.submitIp = ip;
        await sheet.save();
      }
    }

    if (!sheet) {
      const cycle = await Cycle.findById(appraisal.cycleId);
      sheet = await SupervisorSheet.create({
        appraisalId: appraisal._id,
        supervisorId: session.user.id,
        formVersionId: cycle?.supervisorFormVersionId,
        answers,
        status: 'submitted',
        submittedAt: now,
        submitIp: ip,
      });
      appraisal.supervisorSheetId = sheet._id;
    }

    appraisal.status = 'complete';
    appraisal.supervisorSubmittedAt = now;
    // Clear needs_reassignment flag if it was resolved
    appraisal.flags = appraisal.flags.filter((f: string) => f !== 'needs_reassignment');
    await appraisal.save();

    // Audit log
    await AuditLog.create({
      actorId: session.user.id,
      actorRole: 'supervisor',
      action: 'supervisor_sheet_submitted',
      targetType: 'appraisal',
      targetId: appraisal._id.toString(),
      cycleId: appraisal.cycleId,
      metadata: {
        traineeStaffId: appraisal.traineeStaffId,
        traineeName: appraisal.traineeName,
        overallRating: answers.s_overall,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Appraisal assessment successfully submitted',
      submittedAt: now,
    });
  } catch (error: any) {
    console.error('Error submitting supervisor assessment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
