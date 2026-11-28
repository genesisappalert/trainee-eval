import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import connectDB from '@/lib/db';
import { Appraisal, SupervisorSheet, Cycle, FormVersion, AuditLog } from '@/lib/models';
import { SUPERVISOR_V1_FIELDS } from '@/lib/forms/definitions';

async function findAppraisalBySupervisorToken(rawToken: string) {
  const cleanToken = rawToken.trim();
  if (!cleanToken) return null;
  const tokenHash = createHash('sha256').update(cleanToken).digest('hex');

  return Appraisal.findOne({
    $or: [{ supervisorEvalToken: cleanToken }, { supervisorEvalTokenHash: tokenHash }],
    voidedAt: null,
  })
    .populate('cycleId')
    .populate('traineeSheetId')
    .populate('supervisorSheetId')
    .populate('supervisorId', 'name staffId email department location savedSignatureKey');
}

// GET /api/supervisor/token/[token] — Load appraisal + sanitized trainee answers for supervisor link
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await params;

    const appraisal = await findAppraisalBySupervisorToken(token);
    if (!appraisal) {
      return NextResponse.json(
        { error: 'Invalid or expired supervisor evaluation link.' },
        { status: 404 }
      );
    }

    // Strictly redact confidential trainee answers (t_r4, t_c4, t_r4_comment, t_q3)
    const CONFIDENTIAL_TRAINEE_KEYS = new Set(['t_r4', 't_c4', 't_r4_comment', 't_q3']);
    const sanitizedTraineeAnswers: Record<string, any> = {};
    let rawSupervisorHintName = '';

    if (appraisal.traineeSheetId) {
      const traineeSheet = appraisal.traineeSheetId as any;
      const raw = traineeSheet.answers || {};
      if (raw.t_supervisor_other) {
        rawSupervisorHintName = String(raw.t_supervisor_other).split(/[—\-/(]/)[0].trim();
      }
      for (const [key, value] of Object.entries(raw)) {
        if (CONFIDENTIAL_TRAINEE_KEYS.has(key)) continue;
        sanitizedTraineeAnswers[key] = value;
      }
      for (let i = 1; i <= 5; i++) {
        if (i === 4) continue;
        const cVal = sanitizedTraineeAnswers[`t_c${i}`] ?? sanitizedTraineeAnswers[`t_r${i}_comment`];
        if (cVal !== undefined) {
          sanitizedTraineeAnswers[`t_c${i}`] = cVal;
          sanitizedTraineeAnswers[`t_r${i}_comment`] = cVal;
        }
      }
    }

    const cycle = appraisal.cycleId as any;
    const supervisorForm = cycle?.supervisorFormVersionId
      ? await FormVersion.findById(cycle.supervisorFormVersionId)
      : null;

    const supervisorUser = appraisal.supervisorId as any;

    // Merge across any existing SupervisorSheets for this appraisal
    const allSupSheets = await SupervisorSheet.find({ appraisalId: appraisal._id }).sort({ updatedAt: 1 });
    const supervisorAnswers: Record<string, any> = {};
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

    for (let i = 1; i <= 7; i++) {
      const cVal = supervisorAnswers[`s_c${i}`] ?? supervisorAnswers[`s_r${i}_comment`];
      if (cVal !== undefined) {
        supervisorAnswers[`s_c${i}`] = cVal;
        supervisorAnswers[`s_r${i}_comment`] = cVal;
      }
    }

    const primarySupSheet = appraisal.supervisorSheetId as any;
    const defaultSupervisorName =
      supervisorAnswers.s_signature_name ||
      supervisorUser?.name ||
      rawSupervisorHintName ||
      '';

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
        cycleName: cycle?.name || 'MTP Assessment',
        cohort: cycle?.cohort || '',
        supervisorDeadline: cycle?.supervisorDeadline || null,
      },
      traineeAnswers: sanitizedTraineeAnswers,
      supervisorAnswers,
      supervisorStatus,
      defaultSupervisorName,
      supervisorSignatureSvg:
        primarySupSheet?.signatureKey ||
        primarySupSheet?.signatureSvg ||
        supervisorAnswers?.s_signature_svg ||
        supervisorAnswers?.s_signature ||
        supervisorUser?.savedSignatureKey ||
        null,
      formVersion: supervisorForm || { fields: SUPERVISOR_V1_FIELDS },
    });
  } catch (error: any) {
    console.error('Error loading token-based supervisor evaluation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/supervisor/token/[token] — Autosave supervisor draft via private link
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await params;
    const body = await request.json();
    const { answers } = body;

    const appraisal = await findAppraisalBySupervisorToken(token);
    if (!appraisal) {
      return NextResponse.json({ error: 'Invalid or expired supervisor evaluation link.' }, { status: 404 });
    }

    if (appraisal.status === 'complete' || appraisal.status === 'printed') {
      return NextResponse.json({ error: 'This appraisal has already been submitted.' }, { status: 400 });
    }

    const normalizedIncoming: Record<string, any> = { ...(answers || {}) };
    for (let i = 1; i <= 7; i++) {
      const cVal = normalizedIncoming[`s_c${i}`] ?? normalizedIncoming[`s_r${i}_comment`];
      if (cVal !== undefined) {
        normalizedIncoming[`s_c${i}`] = cVal;
        normalizedIncoming[`s_r${i}_comment`] = cVal;
      }
    }

    let sheet: any = null;
    if (appraisal.supervisorSheetId) {
      sheet = await SupervisorSheet.findById(appraisal.supervisorSheetId);
    }
    if (!sheet) {
      sheet = await SupervisorSheet.findOne({ appraisalId: appraisal._id }).sort({ updatedAt: -1 });
    }

    const supUserId = (appraisal.supervisorId as any)?._id || appraisal.supervisorId || null;

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
        supervisorId: supUserId,
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
    console.error('Error autosaving token-based supervisor draft:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/supervisor/token/[token] — Submit final supervisor evaluation via private link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDB();
    const { token } = await params;
    const body = await request.json();
    const { answers } = body;

    const appraisal = await findAppraisalBySupervisorToken(token);
    if (!appraisal) {
      return NextResponse.json({ error: 'Invalid or expired supervisor evaluation link.' }, { status: 404 });
    }

    if (appraisal.status === 'complete' || appraisal.status === 'printed') {
      return NextResponse.json({ error: 'This evaluation has already been submitted.' }, { status: 400 });
    }

    const requiredRatings = ['s_r1', 's_r2', 's_r3', 's_r4', 's_r5', 's_r6', 's_r7'];
    for (const r of requiredRatings) {
      if (!answers?.[r]) {
        return NextResponse.json({ error: `Missing required rating for item ${r}` }, { status: 400 });
      }
    }

    if (!answers?.s_overall) {
      return NextResponse.json({ error: 'Overall assessment rating is required.' }, { status: 400 });
    }
    if (!answers?.s_recommendation) {
      return NextResponse.json({ error: 'Official recommendation on trainee status is required.' }, { status: 400 });
    }
    if (!answers?.s_signature_name) {
      return NextResponse.json({ error: 'Supervisor full name is required for signature declaration.' }, { status: 400 });
    }

    const now = new Date();
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

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

    const supUserId = (appraisal.supervisorId as any)?._id || appraisal.supervisorId || null;

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
        supervisorId: supUserId,
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
    // Clear unassigned / needs_reassignment flags once evaluated via unique link
    appraisal.flags = appraisal.flags.filter(
      (f: string) => f !== 'needs_reassignment' && f !== 'unassigned'
    );
    await appraisal.save();

    await AuditLog.create({
      actorId: supUserId || normalizedSubmitted.s_signature_name,
      actorRole: 'supervisor',
      action: 'supervisor_sheet_submitted',
      targetType: 'appraisal',
      targetId: appraisal._id.toString(),
      cycleId: (appraisal.cycleId as any)?._id || appraisal.cycleId,
      metadata: {
        traineeStaffId: appraisal.traineeStaffId,
        traineeName: appraisal.traineeName,
        supervisorName: normalizedSubmitted.s_signature_name,
        overallRating: normalizedSubmitted.s_overall,
        viaPrivateLink: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Supervisor evaluation submitted successfully.',
      submittedAt: now,
    });
  } catch (error: any) {
    console.error('Error submitting token-based supervisor evaluation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
