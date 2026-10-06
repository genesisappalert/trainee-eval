import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Appraisal, AuditLog } from '@/lib/models';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { appraisalId, reason, comments } = body;

    if (!appraisalId || !reason) {
      return NextResponse.json({ error: 'Appraisal ID and reason are required' }, { status: 400 });
    }

    const appraisal = await Appraisal.findById(appraisalId);
    if (!appraisal) {
      return NextResponse.json({ error: 'Appraisal not found' }, { status: 404 });
    }

    const isSupervisor = appraisal.supervisorId?.toString() === session.user.id;
    const isHr = (session.user as any).roles?.includes('hr_admin') || (session.user as any).roles?.includes('superadmin');

    if (!isSupervisor && !isHr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update status and flags
    appraisal.status = 'needs_reassignment';
    if (!appraisal.flags.includes('needs_reassignment')) {
      appraisal.flags.push('needs_reassignment');
    }
    await appraisal.save();

    // Log in AuditLog
    await AuditLog.create({
      actorId: session.user.id,
      actorRole: 'supervisor',
      action: 'supervisor_flagged_not_mine',
      targetType: 'appraisal',
      targetId: appraisal._id.toString(),
      cycleId: appraisal.cycleId,
      metadata: {
        traineeStaffId: appraisal.traineeStaffId,
        traineeName: appraisal.traineeName,
        reason,
        comments,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Appraisal flagged for HR reassignment. HR will re-allocate to the correct supervisor.',
    });
  } catch (error: any) {
    console.error('Error handling not-my-trainee reassignment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
