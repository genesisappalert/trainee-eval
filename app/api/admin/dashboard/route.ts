import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, User, AuditLog } from '@/lib/models';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';

    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const [cycles, totalSupervisors, totalAppraisals, recentLogs] = await Promise.all([
      Cycle.find().sort({ createdAt: -1 }),
      User.countDocuments({ roles: 'supervisor' }),
      Appraisal.countDocuments({ voidedAt: null }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const enrichedCycles = await Promise.all(
      cycles.map(async (c) => {
        const [
          total,
          notStarted,
          traineeDraft,
          awaitingSupervisor,
          supervisorDraft,
          complete,
          flagged,
        ] = await Promise.all([
          Appraisal.countDocuments({ cycleId: c._id, voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, status: 'not_started', voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, status: 'trainee_draft', voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, status: 'awaiting_supervisor', voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, status: 'supervisor_draft', voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, status: { $in: ['complete', 'printed'] }, voidedAt: null }),
          Appraisal.countDocuments({ cycleId: c._id, 'flags.0': { $exists: true }, voidedAt: null }),
        ]);

        return {
          _id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          cohort: c.cohort,
          status: c.status,
          opensAt: c.opensAt ? c.opensAt.toISOString() : '',
          traineeDeadline: c.traineeDeadline ? c.traineeDeadline.toISOString() : '',
          supervisorDeadline: c.supervisorDeadline ? c.supervisorDeadline.toISOString() : '',
          stats: {
            total,
            notStarted,
            traineeDraft,
            awaitingSupervisor,
            supervisorDraft,
            complete,
            flagged,
          },
        };
      })
    );

    interface AuditLogLean {
      action?: string;
      targetType?: string;
      createdAt?: Date | string;
      actorId?: { toString(): string } | string;
    }

    const recentActivity = (recentLogs as AuditLogLean[]).map((log) => ({
      action: log.action || 'activity',
      entity: log.targetType || 'system',
      at: log.createdAt ? new Date(log.createdAt).toISOString() : new Date().toISOString(),
      actorId: log.actorId ? log.actorId.toString() : 'system',
    }));

    return NextResponse.json({
      cycles: enrichedCycles,
      totalSupervisors,
      totalAppraisals,
      recentActivity,
    });
  } catch (error: unknown) {
    console.error('Error fetching admin dashboard data:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
