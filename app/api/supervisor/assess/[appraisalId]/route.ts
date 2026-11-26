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

    // Trainee answers sanitization: S-10 & T-11: Trainee's confidential answers (t_r4, t_c4, t_r4_comment, t_q3)
    // MUST NOT be visible to the supervisor
    const CONFIDENTIAL_TRAINEE_KEYS = new Set(['t_r4', 't_c4', 't_r4_comment', 't_q3']);
    const sanitizedTraineeAnswers: Record<string, any> = {};
    if (appraisal.traineeSheetId) {
      const traineeSheet = appraisal.traineeSheetId as any;
      const raw = traineeSheet.answers || {};
      for (const [key, value] of Object.entries(raw)) {
        if (CONFIDENTIAL_TRAINEE_KEYS.has(key)) {
          // Confidential to HR — Redacted
          continue;
        }
        sanitizedTraineeAnswers[key] = value;
      }
      // Normalize trainee comment keys so both t_c1..t_c5 and t_r1_comment..t_r5_comment are available
      for (let i = 1; i <= 5; i++) {
        if (i === 4) continue; // confidential
        const cVal = sanitizedTraineeAnswers[`t_c${i}`] ?? sanitizedTraineeAnswers[`t_r${i}_comment`];
        if (cVal !== undefined) {
          sanitizedTraineeAnswers[`t_c${i}`] = cVal;
          sanitizedTraineeAnswers[`t_r${i}_comment`] = cVal;
        }
      }
    }

    // Normalize rawTraineeAnswers for HR copy as well
    let normalizedRawTraineeAnswers: Record<string, any> = sanitizedTraineeAnswers;
    if (isHr && appraisal.traineeSheetId) {
      normalizedRawTraineeAnswers = { ...((appraisal.traineeSheetId as any).answers || {}) };
      for (let i = 1; i <= 5; i++) {
        const cVal = normalizedRawTraineeAnswers[`t_c${i}`] ?? normalizedRawTraineeAnswers[`t_r${i}_comment`];
        if (cVal !== undefined) {
          normalizedRawTraineeAnswers[`t_c${i}`] = cVal;
          normalizedRawTraineeAnswers[`t_r${i}_comment`] = cVal;
        }
      }
    }

    // Get supervisor form version
    const cycle = appraisal.cycleId as any;
    const supervisorForm = await FormVersion.findById(cycle.supervisorFormVersionId);

    // Populate supervisor user info for print/display fallbacks
    await appraisal.populate('supervisorId', 'name staffId email department location savedSignatureKey');
    const supervisorUser = appraisal.supervisorId as any;

    // Existing supervisor answers — merge across any duplicate SupervisorSheets for this appraisal
    const allSupSheets = await SupervisorSheet.find({ appraisalId: appraisal._id }).sort({ updatedAt: 1 });
    let supervisorAnswers: Record<string, any> = {};
    let supervisorStatus = 'not_started';
    for (const s of allSupSheets) {
      if (s.answers && typeof s.answers === 'object') {
        for (const [k, v] of Object.entries(s.answers)) {
          if (v !== undefined && v !== null && v !== '') {
            supervisorAnswers[k] = v;
          } else if (!(k in supervisorAnswers)) {
            supervisorAnswers[k] = v;
          }
        }
      }
      if (s.status === 'submitted') {
        supervisorStatus = 'submitted';
      } else if (supervisorStatus !== 'submitted') {
        supervisorStatus = s.status || 'draft';
      }
    }
    if (appraisal.supervisorSheetId) {
      const primarySheet = appraisal.supervisorSheetId as any;
      if (primarySheet?.answers) {
        for (const [k, v] of Object.entries(primarySheet.answers)) {
          if (v !== undefined && v !== null && v !== '') {
            supervisorAnswers[k] = v;
          }
        }
      }
    }
    // Normalize supervisor comment keys so both s_c1..s_c7 and s_r1_comment..s_r7_comment are always populated
    for (let i = 1; i <= 7; i++) {
      const cVal = supervisorAnswers[`s_c${i}`] ?? supervisorAnswers[`s_r${i}_comment`];
      if (cVal !== undefined) {
        supervisorAnswers[`s_c${i}`] = cVal;
        supervisorAnswers[`s_r${i}_comment`] = cVal;
      }
    }

    const traineeSheetDoc = appraisal.traineeSheetId as any;
    const primarySupSheet = appraisal.supervisorSheetId as any;

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
        createdAt: appraisal.createdAt,
        cycleName: cycle.name,
        cohort: cycle.cohort,
        supervisorDeadline: cycle.supervisorDeadline,
      },
      supervisor: supervisorUser
        ? {
            _id: supervisorUser._id?.toString(),
            name: supervisorUser.name,
            staffId: supervisorUser.staffId,
            email: supervisorUser.email,
            department: supervisorUser.department,
            location: supervisorUser.location,
          }
        : null,
      traineeAnswers: sanitizedTraineeAnswers,
      rawTraineeAnswers: normalizedRawTraineeAnswers,
      traineeSignatureSvg: traineeSheetDoc
        ? traineeSheetDoc.signatureSvg || traineeSheetDoc.signatureKey || traineeSheetDoc.answers?.t_signature || traineeSheetDoc.answers?.t_signature_svg || null
        : null,
      supervisorSignatureSvg:
        primarySupSheet?.signatureKey ||
        primarySupSheet?.signatureSvg ||
        supervisorAnswers?.s_signature_svg ||
        supervisorAnswers?.s_signature ||
        supervisorUser?.savedSignatureKey ||
        null,
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

    // If already complete and not reopened, reject draft autosave so in-flight PUTs never overwrite submitted sheet
    if (appraisal.status === 'complete' || appraisal.status === 'printed') {
      return NextResponse.json({ error: 'This appraisal has already been submitted.' }, { status: 400 });
    }

    // Normalize both s_c1..s_c7 and s_r1_comment..s_r7_comment in incoming answers
    const normalizedIncoming: Record<string, any> = { ...(answers || {}) };
    for (let i = 1; i <= 7; i++) {
      const cVal = normalizedIncoming[`s_c${i}`] ?? normalizedIncoming[`s_r${i}_comment`];
      if (cVal !== undefined) {
        normalizedIncoming[`s_c${i}`] = cVal;
        normalizedIncoming[`s_r${i}_comment`] = cVal;
      }
    }

    // Find existing sheet by supervisorSheetId OR by appraisalId (prevents duplicate sheet creation on concurrent PUTs)
    let sheet: any = null;
    if (appraisal.supervisorSheetId) {
      sheet = await SupervisorSheet.findById(appraisal.supervisorSheetId);
    }
    if (!sheet) {
      sheet = await SupervisorSheet.findOne({ appraisalId: appraisal._id }).sort({ updatedAt: -1 });
    }

    if (sheet) {
      sheet.answers = { ...(sheet.answers || {}), ...normalizedIncoming };
      sheet.markModified('answers');
      if (sheet.status !== 'submitted') {
        sheet.status = 'draft';
      }
      await sheet.save();
      if (!appraisal.supervisorSheetId) {
        appraisal.supervisorSheetId = sheet._id;
      }
    } else {
      const cycle = await Cycle.findById(appraisal.cycleId);
      sheet = await SupervisorSheet.create({
        appraisalId: appraisal._id,
        supervisorId: session.user.id,
        formVersionId: cycle?.supervisorFormVersionId,
        answers: normalizedIncoming,
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

    // Normalize both s_c1..s_c7 and s_r1_comment..s_r7_comment in submitted answers
    const normalizedSubmitted: Record<string, any> = { ...(answers || {}) };
    for (let i = 1; i <= 7; i++) {
      const cVal = normalizedSubmitted[`s_c${i}`] ?? normalizedSubmitted[`s_r${i}_comment`];
      if (cVal !== undefined) {
        normalizedSubmitted[`s_c${i}`] = cVal;
        normalizedSubmitted[`s_r${i}_comment`] = cVal;
      }
    }

    let sheet: any = null;
    if (appraisal.supervisorSheetId) {
      sheet = await SupervisorSheet.findById(appraisal.supervisorSheetId);
    }
    if (!sheet) {
      sheet = await SupervisorSheet.findOne({ appraisalId: appraisal._id }).sort({ updatedAt: -1 });
    }

    if (sheet) {
      sheet.answers = { ...(sheet.answers || {}), ...normalizedSubmitted };
      sheet.markModified('answers');
      if (normalizedSubmitted.s_signature_svg) {
        sheet.signatureKey = normalizedSubmitted.s_signature_svg;
        sheet.signedAt = now;
      }
      sheet.status = 'submitted';
      sheet.submittedAt = now;
      sheet.submitIp = ip;
      await sheet.save();
      if (!appraisal.supervisorSheetId) {
        appraisal.supervisorSheetId = sheet._id;
      }
    } else {
      const cycle = await Cycle.findById(appraisal.cycleId);
      sheet = await SupervisorSheet.create({
        appraisalId: appraisal._id,
        supervisorId: session.user.id,
        formVersionId: cycle?.supervisorFormVersionId,
        answers: normalizedSubmitted,
        signatureKey: normalizedSubmitted.s_signature_svg || null,
        signedAt: normalizedSubmitted.s_signature_svg ? now : null,
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
