import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, TraineeSheet, User, FormVersion, AppraisalFlag, RosterEntry } from '@/lib/models';
import { createHash, randomBytes } from 'crypto';

// GET /api/trainee/cycle/[slug] — Get cycle info + supervisor list for trainee form
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;

    const cycle = await Cycle.findOne({ slug }).populate('traineeFormVersionId');
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Check if cycle is open
    const now = new Date();
    if (cycle.status !== 'open') {
      return NextResponse.json({
        error: 'cycle_not_open',
        status: cycle.status,
        opensAt: cycle.opensAt,
        traineeDeadline: cycle.traineeDeadline,
        name: cycle.name,
      }, { status: 403 });
    }

    // Get the form version
    const formVersion = await FormVersion.findById(cycle.traineeFormVersionId);

    // Get all active supervisors so any newly created supervisors in the DB are always selectable
    const supervisors = await User.find({
      active: true,
      roles: 'supervisor',
    })
      .select('_id name staffId department')
      .sort({ name: 1 });

    return NextResponse.json({
      cycle: {
        id: cycle._id,
        slug: cycle.slug,
        name: cycle.name,
        cohort: cycle.cohort,
        traineeDeadline: cycle.traineeDeadline,
      },
      formVersion: formVersion,
      supervisors: supervisors.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        staffId: s.staffId,
        department: s.department,
      })),
    });
  } catch (error) {
    console.error('Error fetching cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/trainee/cycle/[slug] — Create or update a trainee draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await connectDB();
    const { slug } = await params;
    const body = await request.json();
    const { token, answers, step } = body;

    const cycle = await Cycle.findOne({ slug, status: 'open' });
    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not open' }, { status: 403 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';

    // Normalize trainee rating comments so both t_c1..t_c5 and t_r1_comment..t_r5_comment stay synced
    const normalizedAnswers: Record<string, any> = { ...(answers || {}) };
    for (let i = 1; i <= 5; i++) {
      const cVal = normalizedAnswers[`t_c${i}`] ?? normalizedAnswers[`t_r${i}_comment`];
      if (cVal !== undefined) {
        normalizedAnswers[`t_c${i}`] = cVal;
        normalizedAnswers[`t_r${i}_comment`] = cVal;
      }
    }

    // If token provided, update existing draft
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const sheet = await TraineeSheet.findOne({ tokenHash, status: { $in: ['draft', 'reopened'] } });

      if (!sheet) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
      }

      // Update answers
      sheet.answers = { ...(sheet.answers || {}), ...normalizedAnswers };
      sheet.markModified('answers');
      await sheet.save();

      // Update appraisal if identity fields changed
      if (normalizedAnswers.t_name || normalizedAnswers.t_staff_id || normalizedAnswers.t_department || normalizedAnswers.t_location || normalizedAnswers.t_email) {
        const updateFields: Record<string, unknown> = {};
        if (normalizedAnswers.t_name) updateFields.traineeName = normalizedAnswers.t_name;
        if (normalizedAnswers.t_staff_id) updateFields.traineeStaffId = String(normalizedAnswers.t_staff_id).trim().toUpperCase();
        if (normalizedAnswers.t_department) updateFields.department = normalizedAnswers.t_department;
        if (normalizedAnswers.t_location) updateFields.location = normalizedAnswers.t_location;
        if (normalizedAnswers.t_email) updateFields.traineeEmail = normalizedAnswers.t_email;
        if (normalizedAnswers.t_supervisor && normalizedAnswers.t_supervisor !== 'unassigned') {
          updateFields.supervisorId = normalizedAnswers.t_supervisor;
        }

        await Appraisal.updateOne({ _id: sheet.appraisalId }, { $set: updateFields });
      }

      // Handle supervisor selection flags & roster linking
      const appraisal = await Appraisal.findById(sheet.appraisalId);
      if (appraisal) {
        if (normalizedAnswers.t_supervisor) {
          if (normalizedAnswers.t_supervisor === 'unassigned') {
            appraisal.supervisorId = null;
            if (!appraisal.flags.includes('unassigned')) {
              appraisal.flags.push('unassigned');
            }
          } else {
            appraisal.supervisorId = normalizedAnswers.t_supervisor;
            appraisal.flags = appraisal.flags.filter((f: string) => f !== 'unassigned');
          }
        }

        if (appraisal.traineeStaffId) {
          const cleanStaffId = appraisal.traineeStaffId.trim().toUpperCase();
          const rosterMatch = await RosterEntry.findOne({
            cycleId: cycle._id,
            staffId: cleanStaffId,
          });
          if (rosterMatch) {
            appraisal.rosterEntryId = rosterMatch._id;
            appraisal.flags = appraisal.flags.filter((f: string) => f !== 'unmatched');
            if (!rosterMatch.appraisalId) {
              rosterMatch.appraisalId = appraisal._id;
              await rosterMatch.save();
            }
          }
        }
        await appraisal.save();
      }

      return NextResponse.json({
        success: true,
        token,
        appraisalId: sheet.appraisalId.toString(),
      });
    }

    // New submission — create appraisal + trainee sheet
    // Generate a private token (128-bit)
    const newToken = randomBytes(16).toString('hex');
    const tokenHash = createHash('sha256').update(newToken).digest('hex');

    const cleanStaffId = normalizedAnswers.t_staff_id ? String(normalizedAnswers.t_staff_id).trim().toUpperCase() : '';

    // Check for duplicates in this cycle
    const flags: AppraisalFlag[] = [];
    if (cleanStaffId) {
      const existing = await Appraisal.findOne({
        cycleId: cycle._id,
        traineeStaffId: cleanStaffId,
        voidedAt: null,
      });
      if (existing) {
        flags.push('duplicate');
      }
    }

    // Check roster entry match
    let matchedRoster: any = null;
    if (cleanStaffId) {
      matchedRoster = await RosterEntry.findOne({
        cycleId: cycle._id,
        staffId: cleanStaffId,
      });
    }

    // Handle supervisor
    let supervisorId = null;
    if (normalizedAnswers.t_supervisor && normalizedAnswers.t_supervisor !== 'unassigned') {
      supervisorId = normalizedAnswers.t_supervisor;
    } else if (matchedRoster?.expectedSupervisorId && !normalizedAnswers.t_supervisor) {
      supervisorId = matchedRoster.expectedSupervisorId;
    } else {
      flags.push('unassigned');
    }

    // Create appraisal record with unique private supervisor evaluation token
    const supervisorEvalToken = randomBytes(16).toString('hex');
    const supervisorEvalTokenHash = createHash('sha256').update(supervisorEvalToken).digest('hex');
    const appraisalDoc = await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: cleanStaffId,
      traineeName: normalizedAnswers.t_name || matchedRoster?.name || '',
      traineeEmail: normalizedAnswers.t_email || matchedRoster?.email || '',
      department: normalizedAnswers.t_department || matchedRoster?.department || '',
      location: normalizedAnswers.t_location || matchedRoster?.location || '',
      supervisorId,
      supervisorEvalToken,
      supervisorEvalTokenHash,
      rosterEntryId: matchedRoster ? matchedRoster._id : null,
      status: 'trainee_draft',
      flags,
    });
    const appraisal = appraisalDoc as any;

    if (matchedRoster && !matchedRoster.appraisalId) {
      matchedRoster.appraisalId = appraisal._id;
      await matchedRoster.save();
    }

    // Create trainee sheet
    const sheet = await TraineeSheet.create({
      appraisalId: appraisal._id,
      formVersionId: cycle.traineeFormVersionId,
      answers: normalizedAnswers,
      status: 'draft',
      tokenHash,
      submitIp: ip,
      userAgent,
    });

    // Link sheet to appraisal
    appraisal.traineeSheetId = sheet._id;
    await appraisal.save();

    return NextResponse.json({
      success: true,
      token: newToken,
      supervisorToken: supervisorEvalToken,
      appraisalId: appraisal._id.toString(),
    });
  } catch (error) {
    console.error('Error saving trainee data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
