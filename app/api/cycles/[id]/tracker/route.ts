import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, User, TraineeSheet, SupervisorSheet, AuditLog } from '@/lib/models';
import { createHash, randomBytes } from 'crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    const cycle = await Cycle.findById(id);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Fetch appraisals
    const appraisals = await Appraisal.find({ cycleId: cycle._id, voidedAt: null })
      .populate('supervisorId', 'name staffId email department')
      .populate('traineeSheetId')
      .populate('supervisorSheetId')
      .sort({ createdAt: -1 });

    // Aggregate summary counters (PRD A-12)
    const counters = {
      total: appraisals.length,
      traineeDraft: appraisals.filter((a) => a.status === 'trainee_draft').length,
      awaitingSupervisor: appraisals.filter((a) => a.status === 'awaiting_supervisor').length,
      supervisorDraft: appraisals.filter((a) => a.status === 'supervisor_draft').length,
      complete: appraisals.filter((a) => a.status === 'complete' || a.status === 'printed').length,
      needsReassignment: appraisals.filter((a) => a.status === 'needs_reassignment' || a.flags.includes('needs_reassignment')).length,
      unassigned: appraisals.filter((a) => a.flags.includes('unassigned')).length,
      duplicate: appraisals.filter((a) => a.flags.includes('duplicate')).length,
    };

    const now = new Date().getTime();
    const rows = appraisals.map((a) => {
      const sup = a.supervisorId as any;
      const tSheet = a.traineeSheetId as any;
      const sSheet = a.supervisorSheetId as any;

      let daysOutstanding = 0;
      if (a.traineeSubmittedAt && a.status !== 'complete') {
        const submitted = new Date(a.traineeSubmittedAt).getTime();
        daysOutstanding = Math.floor((now - submitted) / (1000 * 60 * 60 * 24));
      }

      return {
        _id: a._id.toString(),
        traineeStaffId: a.traineeStaffId,
        traineeName: a.traineeName,
        traineeEmail: a.traineeEmail,
        department: a.department,
        location: a.location,
        supervisor: sup ? { _id: sup._id.toString(), name: sup.name, staffId: sup.staffId, email: sup.email } : null,
        status: a.status,
        flags: a.flags,
        traineeSubmittedAt: a.traineeSubmittedAt,
        supervisorSubmittedAt: a.supervisorSubmittedAt,
        daysOutstanding,
        hasTraineeSheet: !!tSheet,
        hasSupervisorSheet: !!sSheet,
        traineeOverall: tSheet?.answers?.t_overall || null,
        supervisorOverall: sSheet?.answers?.s_overall || null,
        releaseWithheld: a.releaseWithheld,
      };
    });

    // Supervisors for reassign picker
    const allSupervisors = await User.find({ roles: 'supervisor', active: true })
      .select('name staffId department');

    return NextResponse.json({
      cycle: {
        _id: cycle._id.toString(),
        name: cycle.name,
        slug: cycle.slug,
        cohort: cycle.cohort,
        status: cycle.status,
        traineeDeadline: cycle.traineeDeadline,
        supervisorDeadline: cycle.supervisorDeadline,
      },
      counters,
      rows,
      supervisors: allSupervisors,
    });
  } catch (error: any) {
    console.error('Error fetching tracker data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Actions on trainee record (Reassign, Reopen, Reissue Link, Withhold)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userRoles = (session.user as any).roles || [];
    if (!userRoles.includes('hr_admin') && !userRoles.includes('superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action, appraisalId } = body;

    const appraisal = await Appraisal.findById(appraisalId);
    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    if (action === 'reassign') {
      const { newSupervisorId, reason } = body;
      const oldSupervisorId = appraisal.supervisorId;
      appraisal.supervisorId = newSupervisorId;
      // Clear reassignment flags
      appraisal.flags = appraisal.flags.filter(
        (f: string) => f !== 'needs_reassignment' && f !== 'unassigned'
      );
      if (appraisal.status === 'needs_reassignment') {
        appraisal.status = 'awaiting_supervisor';
      }
      await appraisal.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'supervisor_reassigned',
        targetType: 'appraisal',
        targetId: appraisal._id.toString(),
        cycleId: appraisal.cycleId,
        metadata: { oldSupervisorId, newSupervisorId, reason },
      });

      return NextResponse.json({ success: true, message: 'Supervisor reassigned successfully' });
    }

    if (action === 'reopen') {
      const { target, reason } = body; // target: 'trainee' | 'supervisor'
      if (!reason) {
        return NextResponse.json({ error: 'Reason for reopening is mandatory' }, { status: 400 });
      }

      if (target === 'supervisor') {
        appraisal.status = 'awaiting_supervisor';
        if (appraisal.supervisorSheetId) {
          await SupervisorSheet.findByIdAndUpdate(appraisal.supervisorSheetId, { status: 'reopened' });
        }
      } else {
        appraisal.status = 'reopened';
        if (appraisal.traineeSheetId) {
          await TraineeSheet.findByIdAndUpdate(appraisal.traineeSheetId, { status: 'reopened' });
        }
      }
      await appraisal.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: target === 'supervisor' ? 'supervisor_sheet_reopened' : 'trainee_sheet_reopened',
        targetType: 'appraisal',
        targetId: appraisal._id.toString(),
        cycleId: appraisal.cycleId,
        metadata: { target, reason },
      });

      return NextResponse.json({ success: true, message: `${target} sheet reopened for editing` });
    }

    if (action === 'reissue_link') {
      // Reissue trainee link token (A-19)
      const newToken = randomBytes(16).toString('hex');
      const tokenHash = createHash('sha256').update(newToken).digest('hex');

      if (appraisal.traineeSheetId) {
        await TraineeSheet.findByIdAndUpdate(appraisal.traineeSheetId, { tokenHash });
      }

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'trainee_link_reissued',
        targetType: 'appraisal',
        targetId: appraisal._id.toString(),
        cycleId: appraisal.cycleId,
        metadata: { traineeEmail: appraisal.traineeEmail },
      });

      const cycle = await Cycle.findById(appraisal.cycleId);
      const resumeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/a/${cycle?.slug}?token=${newToken}`;

      return NextResponse.json({
        success: true,
        message: 'New trainee access link generated',
        token: newToken,
        resumeUrl,
      });
    }

    if (action === 'toggle_withhold') {
      appraisal.releaseWithheld = !appraisal.releaseWithheld;
      await appraisal.save();
      return NextResponse.json({ success: true, releaseWithheld: appraisal.releaseWithheld });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error performing tracker action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
