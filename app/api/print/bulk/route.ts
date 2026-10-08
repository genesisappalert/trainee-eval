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

    const items = appraisals.map((appraisal: any) => {
      const cycle = appraisal.cycleId as any;
      const traineeSheet = appraisal.traineeSheetId as any;
      const supSheet = appraisal.supervisorSheetId as any;
      const supervisor = appraisal.supervisorId as any;

      // Trainee answers (raw vs sanitized)
      const rawTraineeAnswers = traineeSheet?.answers || {};
      const sanitizedTraineeAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawTraineeAnswers)) {
        if (key === 't_r4' || key === 't_r4_comment' || key === 't_q3') {
          continue;
        }
        sanitizedTraineeAnswers[key] = value;
      }

      const supervisorAnswers = supSheet?.answers || {};

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
