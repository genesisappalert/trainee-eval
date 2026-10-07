import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { RosterEntry, Appraisal, AuditLog } from '@/lib/models';
import mongoose from 'mongoose';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';
    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const entry = await RosterEntry.findById(id);
    if (!entry) {
      return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, department, location, expectedSupervisorId } = body;

    if (name) entry.name = String(name).trim();
    if (email !== undefined) entry.email = String(email).trim().toLowerCase();
    if (department !== undefined) entry.department = String(department).trim();
    if (location !== undefined) entry.location = String(location).trim();

    if (expectedSupervisorId !== undefined) {
      if (expectedSupervisorId && mongoose.Types.ObjectId.isValid(expectedSupervisorId)) {
        entry.expectedSupervisorId = new mongoose.Types.ObjectId(expectedSupervisorId);
      } else {
        entry.expectedSupervisorId = null;
      }
    }

    await entry.save();

    await AuditLog.create({
      actorId: session?.user?.id ? new mongoose.Types.ObjectId(session.user.id) : null,
      actorRole: 'hr_admin',
      action: 'roster_entry_updated',
      targetType: 'roster_entry',
      targetId: entry._id.toString(),
      cycleId: entry.cycleId,
      metadata: { staffId: entry.staffId, name: entry.name },
    });

    return NextResponse.json({ success: true, entry });
  } catch (error: unknown) {
    console.error('Error updating roster entry:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';
    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const entry = await RosterEntry.findById(id);
    if (!entry) {
      return NextResponse.json({ error: 'Roster entry not found' }, { status: 404 });
    }

    // Unlink any appraisal
    if (entry.appraisalId) {
      await Appraisal.updateOne(
        { _id: entry.appraisalId },
        {
          $set: { rosterEntryId: null },
          $addToSet: { flags: 'unmatched' },
        }
      );
    }

    await RosterEntry.deleteOne({ _id: entry._id });

    await AuditLog.create({
      actorId: session?.user?.id ? new mongoose.Types.ObjectId(session.user.id) : null,
      actorRole: 'hr_admin',
      action: 'roster_entry_deleted',
      targetType: 'roster_entry',
      targetId: entry._id.toString(),
      cycleId: entry.cycleId,
      metadata: { staffId: entry.staffId, name: entry.name },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting roster entry:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
