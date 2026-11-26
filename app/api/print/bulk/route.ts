import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Appraisal, TraineeSheet, SupervisorSheet, Cycle, User, AuditLog } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRoles = (session.user as any).roles || [];
    const isHr = userRoles.includes('hr_admin') || userRoles.includes('superadmin');
    if (!isHr) {
      return NextResponse.json({ error: 'Forbidden: HR Admin access required for bulk printing' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId');
    const idsParam = searchParams.get('ids');
    const statusParam = searchParams.get('status') || 'complete';

    const filter: Record<string, any> = { voidedAt: null };

    if (idsParam) {
      const idList = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));

      if (idList.length === 0) {
        return NextResponse.json({ error: 'No valid appraisal IDs provided' }, { status: 400 });
      }
      filter._id = { $in: idList };
    } else if (cycleId) {
      if (!mongoose.Types.ObjectId.isValid(cycleId)) {
        return NextResponse.json({ error: 'Invalid cycleId provided' }, { status: 400 });
      }
      filter.cycleId = cycleId;

      if (statusParam === 'complete') {
        filter.status = { $in: ['complete', 'printed'] };
      } else if (statusParam !== 'all') {
        filter.status = statusParam;
      }
    } else {
      return NextResponse.json(
        { error: 'Please provide either ?cycleId or ?ids parameter' },
        { status: 400 }
      );
    }

    // Retrieve matching appraisals with populated documents
    const appraisals = await Appraisal.find(filter)
      .populate('cycleId')
      .populate('traineeSheetId')
      .populate('supervisorSheetId')
      .populate('supervisorId', 'name staffId email department location savedSignatureKey')
      .sort({ traineeName: 1 });

    // Load all SupervisorSheets for these appraisals so comments from any duplicate sheets are merged
    const appraisalIds = appraisals.map((a) => a._id);
    const allSupSheets = await SupervisorSheet.find({ appraisalId: { $in: appraisalIds } }).sort({ updatedAt: 1 });
    const supSheetsByAppraisal = new Map<string, any[]>();
    for (const s of allSupSheets) {
      const key = s.appraisalId.toString();
      if (!supSheetsByAppraisal.has(key)) supSheetsByAppraisal.set(key, []);
      supSheetsByAppraisal.get(key)!.push(s);
    }

    const CONFIDENTIAL_TRAINEE_KEYS = new Set(['t_r4', 't_c4', 't_r4_comment', 't_q3']);

    const items = appraisals.map((appraisal: any) => {
      const cycle = appraisal.cycleId as any;
      const traineeSheet = appraisal.traineeSheetId as any;
      const supSheet = appraisal.supervisorSheetId as any;
      const supervisor = appraisal.supervisorId as any;

      // Trainee answers (raw vs sanitized)
      const rawTraineeAnswers: Record<string, any> = { ...(traineeSheet?.answers || {}) };
      for (let i = 1; i <= 5; i++) {
        const cVal = rawTraineeAnswers[`t_c${i}`] ?? rawTraineeAnswers[`t_r${i}_comment`];
        if (cVal !== undefined) {
          rawTraineeAnswers[`t_c${i}`] = cVal;
          rawTraineeAnswers[`t_r${i}_comment`] = cVal;
        }
      }

      const sanitizedTraineeAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawTraineeAnswers)) {
        if (CONFIDENTIAL_TRAINEE_KEYS.has(key)) {
          continue;
        }
        sanitizedTraineeAnswers[key] = value;
      }

      // Merge supervisor answers across all sheets for this appraisal
      const supervisorAnswers: Record<string, any> = {};
      const sheetsForApp = supSheetsByAppraisal.get(appraisal._id.toString()) || [];
      for (const s of sheetsForApp) {
        if (s.answers && typeof s.answers === 'object') {
          for (const [k, v] of Object.entries(s.answers)) {
            if (v !== undefined && v !== null && v !== '') {
              supervisorAnswers[k] = v;
            } else if (!(k in supervisorAnswers)) {
              supervisorAnswers[k] = v;
            }
          }
        }
      }
      if (supSheet?.answers) {
        for (const [k, v] of Object.entries(supSheet.answers)) {
          if (v !== undefined && v !== null && v !== '') {
            supervisorAnswers[k] = v;
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

      const traineeSignatureSvg =
        traineeSheet?.signatureSvg ||
        traineeSheet?.signatureKey ||
        rawTraineeAnswers?.t_signature ||
        null;

      const supervisorSignatureSvg =
        supSheet?.signatureKey ||
        supSheet?.signatureSvg ||
        supervisorAnswers?.s_signature_svg ||
        supervisorAnswers?.s_signature ||
        supervisor?.savedSignatureKey ||
        null;

      return {
        appraisal: {
          _id: appraisal._id.toString(),
          traineeStaffId: appraisal.traineeStaffId,
          traineeName: appraisal.traineeName,
          traineeEmail: appraisal.traineeEmail,
          department: appraisal.department,
          location: appraisal.location,
          status: appraisal.status,
          flags: appraisal.flags || [],
          traineeSubmittedAt: appraisal.traineeSubmittedAt,
          supervisorSubmittedAt: appraisal.supervisorSubmittedAt,
          createdAt: appraisal.createdAt,
          cycleName: cycle?.name || 'MTP Appraisal',
          cohort: cycle?.cohort || '',
          printConfidentialOnHrCopy: cycle?.printConfidentialOnHrCopy ?? true,
        },
        supervisor: supervisor
          ? {
              _id: supervisor._id?.toString(),
              name: supervisor.name,
              staffId: supervisor.staffId,
              email: supervisor.email,
              department: supervisor.department,
              location: supervisor.location,
            }
          : null,
        traineeAnswers: sanitizedTraineeAnswers,
        rawTraineeAnswers,
        traineeSignatureSvg,
        supervisorAnswers,
        supervisorSignatureSvg,
      };
    });

    // Optional audit log for bulk printing export
    if (items.length > 0) {
      try {
        await AuditLog.create({
          actorId: session.user.id,
          actorRole: userRoles.includes('superadmin') ? 'superadmin' : 'hr_admin',
          action: 'bulk_print_accessed',
          entity: 'appraisal_bundle',
          entityId: cycleId || 'custom_selection',
          targetType: 'cycle',
          targetId: cycleId || '',
          cycleId: cycleId && mongoose.Types.ObjectId.isValid(cycleId) ? cycleId : null,
          metadata: {
            itemCount: items.length,
            requestedStatus: statusParam,
            traineeCount: items.length,
          },
        });
      } catch (auditErr) {
        // Non-fatal if audit logging encounters an issue
        console.warn('Could not record bulk print audit log:', auditErr);
      }
    }

    const firstCycle = appraisals[0]?.cycleId as any;

    return NextResponse.json({
      success: true,
      count: items.length,
      cycleName: firstCycle?.name || null,
      cohort: firstCycle?.cohort || null,
      items,
    });
  } catch (error: any) {
    console.error('Error handling bulk print API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
