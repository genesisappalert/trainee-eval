import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, RosterEntry, Appraisal, User, AuditLog } from '@/lib/models';
import mongoose from 'mongoose';

// GET: List roster entries for a cycle, along with cycle list, supervisors, and stats
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';
    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const reqCycleId = searchParams.get('cycleId');

    // Fetch all cycles to populate selector
    const cycles = await Cycle.find().sort({ createdAt: -1 }).select('_id name slug cohort status');

    // Determine target cycle
    let targetCycle = null;
    if (reqCycleId && mongoose.Types.ObjectId.isValid(reqCycleId)) {
      targetCycle = await Cycle.findById(reqCycleId);
    }
    if (!targetCycle && cycles.length > 0) {
      // Prefer active/open cycle or latest
      targetCycle = cycles.find((c) => c.status === 'open') || cycles[0];
    }

    if (!targetCycle) {
      return NextResponse.json({
        cycles: [],
        activeCycle: null,
        roster: [],
        unmatchedAppraisals: [],
        supervisors: [],
        summary: {
          totalExpected: 0,
          notStarted: 0,
          traineeDraft: 0,
          awaitingSupervisor: 0,
          complete: 0,
          unmatched: 0,
        },
      });
    }

    // Fetch supervisors for dropdown mapping
    const supervisors = await User.find({ roles: 'supervisor' })
      .select('_id name staffId email department location')
      .sort({ name: 1 });

    // Fetch roster entries for target cycle
    const entries = await RosterEntry.find({ cycleId: targetCycle._id })
      .populate('expectedSupervisorId', '_id name staffId email department location')
      .populate('appraisalId', '_id status flags traineeSubmittedAt supervisorSubmittedAt')
      .sort({ name: 1 });

    // Also find all appraisals in this cycle to detect unmatched submissions
    const allAppraisals = await Appraisal.find({
      cycleId: targetCycle._id,
      voidedAt: null,
    }).populate('supervisorId', '_id name staffId email');

    const rosterStaffIds = new Set(entries.map((e) => e.staffId.toUpperCase()));

    // Any appraisal whose traineeStaffId is NOT in the roster is "unmatched"
    const unmatchedAppraisals = allAppraisals
      .filter((app) => !rosterStaffIds.has(app.traineeStaffId.toUpperCase()))
      .map((app) => {
        const sup = app.supervisorId as any;
        return {
          _id: app._id.toString(),
          staffId: app.traineeStaffId,
          name: app.traineeName,
          email: app.traineeEmail,
          department: app.department,
          location: app.location,
          status: app.status,
          flags: app.flags,
          supervisor: sup ? { _id: sup._id.toString(), name: sup.name, staffId: sup.staffId } : null,
          traineeSubmittedAt: app.traineeSubmittedAt,
        };
      });

    // Compute summary stats
    let notStarted = 0;
    let traineeDraft = 0;
    let awaitingSupervisor = 0;
    let complete = 0;

    const formattedRoster = entries.map((entry) => {
      const sup = entry.expectedSupervisorId as any;
      const app = entry.appraisalId as any;

      let status = 'not_started';
      if (app) {
        status = app.status;
      }

      if (status === 'not_started') notStarted++;
      else if (status === 'trainee_draft') traineeDraft++;
      else if (status === 'awaiting_supervisor' || status === 'supervisor_draft' || status === 'needs_reassignment') awaitingSupervisor++;
      else if (status === 'complete' || status === 'printed') complete++;

      return {
        _id: entry._id.toString(),
        cycleId: entry.cycleId.toString(),
        staffId: entry.staffId,
        name: entry.name,
        email: entry.email,
        department: entry.department,
        location: entry.location,
        expectedSupervisor: sup ? {
          _id: sup._id.toString(),
          name: sup.name,
          staffId: sup.staffId,
          email: sup.email,
        } : null,
        appraisal: app ? {
          _id: app._id.toString(),
          status: app.status,
          flags: app.flags || [],
          traineeSubmittedAt: app.traineeSubmittedAt,
          supervisorSubmittedAt: app.supervisorSubmittedAt,
        } : null,
        status,
        createdAt: entry.createdAt,
      };
    });

    return NextResponse.json({
      cycles: cycles.map((c) => ({
        _id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        cohort: c.cohort,
        status: c.status,
      })),
      activeCycle: {
        _id: targetCycle._id.toString(),
        name: targetCycle.name,
        slug: targetCycle.slug,
        cohort: targetCycle.cohort,
        status: targetCycle.status,
      },
      roster: formattedRoster,
      unmatchedAppraisals,
      supervisors: supervisors.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        staffId: s.staffId,
        email: s.email,
        department: s.department,
      })),
      summary: {
        totalExpected: entries.length,
        notStarted,
        traineeDraft,
        awaitingSupervisor,
        complete,
        unmatched: unmatchedAppraisals.length,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching roster:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Add a single trainee or bulk import CSV rows
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';
    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();

    const { cycleId, entries, staffId, name, email, department, location, expectedSupervisorId } = body;

    if (!cycleId || !mongoose.Types.ObjectId.isValid(cycleId)) {
      return NextResponse.json({ error: 'A valid cycle ID is required' }, { status: 400 });
    }

    const cycle = await Cycle.findById(cycleId);
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Single trainee creation
    if (!entries && staffId && name) {
      const cleanStaffId = String(staffId).trim().toUpperCase();

      const existing = await RosterEntry.findOne({ cycleId: cycle._id, staffId: cleanStaffId });
      if (existing) {
        return NextResponse.json({ error: `Trainee with Staff ID ${cleanStaffId} already exists in this roster` }, { status: 409 });
      }

      // Check if an existing appraisal matches this trainee
      const matchedAppraisal = await Appraisal.findOne({
        cycleId: cycle._id,
        traineeStaffId: cleanStaffId,
        voidedAt: null,
      });

      const newEntry = await RosterEntry.create({
        cycleId: cycle._id,
        staffId: cleanStaffId,
        name: String(name).trim(),
        email: String(email || '').trim().toLowerCase(),
        department: String(department || '').trim(),
        location: String(location || '').trim(),
        expectedSupervisorId: expectedSupervisorId && mongoose.Types.ObjectId.isValid(expectedSupervisorId)
          ? new mongoose.Types.ObjectId(expectedSupervisorId)
          : null,
        appraisalId: matchedAppraisal ? matchedAppraisal._id : null,
      });

      if (matchedAppraisal) {
        matchedAppraisal.rosterEntryId = newEntry._id;
        // If it was flagged unmatched, remove unmatched flag
        if (matchedAppraisal.flags.includes('unmatched')) {
          matchedAppraisal.flags = matchedAppraisal.flags.filter((f) => f !== 'unmatched');
        }
        await matchedAppraisal.save();
      }

      await AuditLog.create({
        actorId: session?.user?.id ? new mongoose.Types.ObjectId(session.user.id) : null,
        actorRole: 'hr_admin',
        action: 'roster_entry_created',
        targetType: 'roster_entry',
        targetId: newEntry._id.toString(),
        cycleId: cycle._id,
        metadata: { staffId: cleanStaffId, name: newEntry.name },
      });

      return NextResponse.json({ success: true, entry: newEntry });
    }

    // Bulk entries creation
    if (Array.isArray(entries) && entries.length > 0) {
      const results: { created: number; skipped: number; errors: string[] } = {
        created: 0,
        skipped: 0,
        errors: [],
      };

      // Load all supervisors to map by staffId or name if supervisorStaffId provided
      const allSupervisors = await User.find({ roles: 'supervisor' });
      const supMapByStaffId = new Map(allSupervisors.map((s) => [s.staffId.toUpperCase(), s._id]));
      const supMapByName = new Map(allSupervisors.map((s) => [s.name.toLowerCase().trim(), s._id]));

      for (const item of entries) {
        const rawStaffId = String(item.staffId || '').trim().toUpperCase();
        const rawName = String(item.name || '').trim();

        if (!rawStaffId || !rawName) {
          results.skipped++;
          continue;
        }

        const existing = await RosterEntry.findOne({ cycleId: cycle._id, staffId: rawStaffId });
        if (existing) {
          results.skipped++;
          continue;
        }

        let supId: mongoose.Types.ObjectId | null = null;
        if (item.expectedSupervisorId && mongoose.Types.ObjectId.isValid(item.expectedSupervisorId)) {
          supId = new mongoose.Types.ObjectId(item.expectedSupervisorId);
        } else if (item.supervisorStaffId) {
          const matched = supMapByStaffId.get(String(item.supervisorStaffId).toUpperCase().trim());
          if (matched) supId = matched;
        } else if (item.supervisorName) {
          const matched = supMapByName.get(String(item.supervisorName).toLowerCase().trim());
          if (matched) supId = matched;
        }

        // Check if appraisal already exists for this trainee
        const matchedAppraisal = await Appraisal.findOne({
          cycleId: cycle._id,
          traineeStaffId: rawStaffId,
          voidedAt: null,
        });

        const created = await RosterEntry.create({
          cycleId: cycle._id,
          staffId: rawStaffId,
          name: rawName,
          email: String(item.email || '').trim().toLowerCase(),
          department: String(item.department || '').trim(),
          location: String(item.location || '').trim(),
          expectedSupervisorId: supId,
          appraisalId: matchedAppraisal ? matchedAppraisal._id : null,
        });

        if (matchedAppraisal) {
          matchedAppraisal.rosterEntryId = created._id;
          if (matchedAppraisal.flags.includes('unmatched')) {
            matchedAppraisal.flags = matchedAppraisal.flags.filter((f) => f !== 'unmatched');
          }
          await matchedAppraisal.save();
        }

        results.created++;
      }

      await AuditLog.create({
        actorId: session?.user?.id ? new mongoose.Types.ObjectId(session.user.id) : null,
        actorRole: 'hr_admin',
        action: 'roster_bulk_imported',
        targetType: 'roster',
        targetId: cycle._id.toString(),
        cycleId: cycle._id,
        metadata: { createdCount: results.created, skippedCount: results.skipped },
      });

      return NextResponse.json({ success: true, ...results });
    }

    return NextResponse.json({ error: 'Invalid payload: provide single trainee or entries array' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error adding roster entry:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
