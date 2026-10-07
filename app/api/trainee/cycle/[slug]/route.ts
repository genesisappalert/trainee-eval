import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, TraineeSheet, User, FormVersion, AppraisalFlag } from '@/lib/models';
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

    // If token provided, update existing draft
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const sheet = await TraineeSheet.findOne({ tokenHash, status: { $in: ['draft', 'reopened'] } });

      if (!sheet) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
      }

      // Update answers
      sheet.answers = { ...sheet.answers, ...answers };
      await sheet.save();

      // Update appraisal if identity fields changed
      if (answers.t_name || answers.t_staff_id || answers.t_department || answers.t_location || answers.t_email) {
        const updateFields: Record<string, unknown> = {};
        if (answers.t_name) updateFields.traineeName = answers.t_name;
        if (answers.t_staff_id) updateFields.traineeStaffId = answers.t_staff_id;
        if (answers.t_department) updateFields.department = answers.t_department;
        if (answers.t_location) updateFields.location = answers.t_location;
        if (answers.t_email) updateFields.traineeEmail = answers.t_email;
        if (answers.t_supervisor && answers.t_supervisor !== 'unassigned') {
          updateFields.supervisorId = answers.t_supervisor;
        }

        await Appraisal.updateOne({ _id: sheet.appraisalId }, { $set: updateFields });
      }

      // Handle supervisor selection flags
      if (answers.t_supervisor) {
        const appraisal = await Appraisal.findById(sheet.appraisalId);
        if (appraisal) {
          if (answers.t_supervisor === 'unassigned') {
            appraisal.supervisorId = null;
            if (!appraisal.flags.includes('unassigned')) {
              appraisal.flags.push('unassigned');
            }
          } else {
            appraisal.supervisorId = answers.t_supervisor;
            appraisal.flags = appraisal.flags.filter((f: string) => f !== 'unassigned');
          }
          await appraisal.save();
        }
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

    // Check for duplicates in this cycle
    const flags: AppraisalFlag[] = [];
    if (answers.t_staff_id) {
      const existing = await Appraisal.findOne({
        cycleId: cycle._id,
        traineeStaffId: answers.t_staff_id,
        voidedAt: null,
      });
      if (existing) {
        flags.push('duplicate');
      }
    }

    // Handle supervisor
    let supervisorId = null;
    if (answers.t_supervisor && answers.t_supervisor !== 'unassigned') {
      supervisorId = answers.t_supervisor;
    } else {
      flags.push('unassigned');
    }

    // Create appraisal record
    const appraisalDoc = await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: answers.t_staff_id || '',
      traineeName: answers.t_name || '',
      traineeEmail: answers.t_email || '',
      department: answers.t_department || '',
      location: answers.t_location || '',
      supervisorId,
      status: 'trainee_draft',
      flags,
    });
    const appraisal = appraisalDoc as any;

    // Create trainee sheet
    const sheet = await TraineeSheet.create({
      appraisalId: appraisal._id,
      formVersionId: cycle.traineeFormVersionId,
      answers: answers || {},
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
      appraisalId: appraisal._id.toString(),
    });
  } catch (error) {
    console.error('Error saving trainee data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
