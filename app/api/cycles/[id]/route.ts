import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, User, AuditLog } from '@/lib/models';

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

    const cycle = await Cycle.findById(id).populate('supervisorIds', 'name staffId email department');
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Also get all available supervisors for assigning to cycle
    const allSupervisors = await User.find({ roles: 'supervisor', active: true })
      .select('name staffId email department');

    return NextResponse.json({ cycle, allSupervisors });
  } catch (error: any) {
    console.error('Error getting cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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

    const cycle = await Cycle.findById(id);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Update allowable fields
    if (body.name) cycle.name = body.name;
    if (body.cohort) cycle.cohort = body.cohort;
    if (body.status) cycle.status = body.status;
    if (body.opensAt) cycle.opensAt = new Date(body.opensAt);
    if (body.traineeDeadline) cycle.traineeDeadline = new Date(body.traineeDeadline);
    if (body.supervisorDeadline) cycle.supervisorDeadline = new Date(body.supervisorDeadline);
    if (body.supervisorIds) cycle.supervisorIds = body.supervisorIds;
    if (body.resultsReleased !== undefined) cycle.resultsReleased = body.resultsReleased;

    await cycle.save();

    await AuditLog.create({
      actorId: session.user.id,
      actorRole: 'hr_admin',
      action: 'cycle_updated',
      targetType: 'cycle',
      targetId: cycle._id.toString(),
      cycleId: cycle._id,
      metadata: { updatedFields: Object.keys(body) },
    });

    return NextResponse.json({ success: true, cycle });
  } catch (error: any) {
    console.error('Error updating cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
