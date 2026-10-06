import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, User } from '@/lib/models';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.user.id);
    if (!user || (!user.roles.includes('supervisor') && !user.roles.includes('hr_admin') && !user.roles.includes('superadmin'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cycleSlug = searchParams.get('cycle');

    // Get active or selected cycle
    let cycleQuery: any = { status: { $in: ['open', 'closed'] } };
    if (cycleSlug) {
      cycleQuery = { slug: cycleSlug };
    }
    const currentCycle = await Cycle.findOne(cycleQuery).sort({ createdAt: -1 });

    if (!currentCycle) {
      return NextResponse.json({
        cycle: null,
        trainees: [],
        stats: { total: 0, pending: 0, drafts: 0, complete: 0 },
      });
    }

    // Find appraisals where supervisorId matches this user
    // Note: if hr_admin is testing, also show appraisals or filter by supervisor
    const supervisorId = session.user.id;
    const appraisals = await Appraisal.find({
      cycleId: currentCycle._id,
      supervisorId: supervisorId,
      voidedAt: null,
    }).populate('traineeSheetId').sort({ traineeSubmittedAt: -1, createdAt: -1 });

    const stats = {
      total: appraisals.length,
      pending: appraisals.filter((a) => a.status === 'awaiting_supervisor').length,
      drafts: appraisals.filter((a) => a.status === 'supervisor_draft').length,
      complete: appraisals.filter((a) => a.status === 'complete' || a.status === 'printed').length,
    };

    // Calculate days outstanding
    const now = new Date().getTime();
    const formattedList = appraisals.map((a) => {
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
        status: a.status,
        flags: a.flags,
        traineeSubmittedAt: a.traineeSubmittedAt,
        supervisorSubmittedAt: a.supervisorSubmittedAt,
        daysOutstanding,
      };
    });

    // Also get all available cycles for cycle switcher
    const allCycles = await Cycle.find({ status: { $ne: 'archived' } })
      .select('name slug status')
      .sort({ createdAt: -1 });

    return NextResponse.json({
      currentCycle: {
        _id: currentCycle._id.toString(),
        name: currentCycle.name,
        slug: currentCycle.slug,
        cohort: currentCycle.cohort,
        supervisorDeadline: currentCycle.supervisorDeadline,
        status: currentCycle.status,
      },
      allCycles,
      stats,
      trainees: formattedList,
      user: {
        name: user.name,
        staffId: user.staffId,
        department: user.department,
      },
    });
  } catch (error: any) {
    console.error('Error fetching supervisor queue:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
