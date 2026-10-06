import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, FormVersion, User, AuditLog } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const cycles = await Cycle.find().sort({ createdAt: -1 });

    // Aggregate stats per cycle
    const enriched = await Promise.all(
      cycles.map(async (c) => {
        const total = await Appraisal.countDocuments({ cycleId: c._id, voidedAt: null });
        const awaitingSupervisor = await Appraisal.countDocuments({ cycleId: c._id, status: 'awaiting_supervisor', voidedAt: null });
        const complete = await Appraisal.countDocuments({ cycleId: c._id, status: { $in: ['complete', 'printed'] }, voidedAt: null });
        const flagged = await Appraisal.countDocuments({ cycleId: c._id, 'flags.0': { $exists: true }, voidedAt: null });

        return {
          _id: c._id.toString(),
          name: c.name,
          slug: c.slug,
          cohort: c.cohort,
          status: c.status,
          opensAt: c.opensAt,
          traineeDeadline: c.traineeDeadline,
          supervisorDeadline: c.supervisorDeadline,
          supervisorCount: c.supervisorIds?.length || 0,
          stats: { total, awaitingSupervisor, complete, flagged },
        };
      })
    );

    return NextResponse.json({ cycles: enriched });
  } catch (error: any) {
    console.error('Error listing cycles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userRoles = (session.user as any).roles || [];
    if (!userRoles.includes('hr_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const body = await request.json();
    const {
      name,
      slug,
      cohort,
      opensAt,
      traineeDeadline,
      supervisorDeadline,
      supervisorIds,
    } = body;

    if (!name || !slug || !cohort || !opensAt || !traineeDeadline || !supervisorDeadline) {
      return NextResponse.json({ error: 'Please provide all required cycle fields' }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await Cycle.findOne({ slug });
    if (existing) {
      return NextResponse.json({ error: 'A cycle with this slug already exists' }, { status: 400 });
    }

    // Default to active v1 form versions
    const traineeForm = await FormVersion.findOne({ kind: 'trainee', active: true });
    const supervisorForm = await FormVersion.findOne({ kind: 'supervisor', active: true });

    if (!traineeForm || !supervisorForm) {
      return NextResponse.json({ error: 'Active form versions not found. Please run seed first.' }, { status: 400 });
    }

    const newCycle = await Cycle.create({
      name,
      slug,
      cohort,
      status: 'draft',
      opensAt: new Date(opensAt),
      traineeDeadline: new Date(traineeDeadline),
      supervisorDeadline: new Date(supervisorDeadline),
      traineeFormVersionId: traineeForm._id,
      supervisorFormVersionId: supervisorForm._id,
      supervisorIds: supervisorIds || [],
      printConfidentialOnHrCopy: true,
    });

    await AuditLog.create({
      actorId: session.user.id,
      actorRole: 'hr_admin',
      action: 'cycle_created',
      targetType: 'cycle',
      targetId: newCycle._id.toString(),
      cycleId: newCycle._id,
      metadata: { name, slug, cohort },
    });

    return NextResponse.json({ success: true, cycle: newCycle });
  } catch (error: any) {
    console.error('Error creating cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
