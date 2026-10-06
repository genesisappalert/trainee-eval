import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, TraineeSheet, SupervisorSheet } from '@/lib/models';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userRoles = (session.user as any).roles || [];
    if (!userRoles.includes('hr_admin') && !userRoles.includes('superadmin') && !userRoles.includes('hr_viewer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId');

    const cycleQuery: any = cycleId ? { _id: cycleId } : {};
    const cycle = await Cycle.findOne(cycleQuery).sort({ createdAt: -1 });

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    const appraisals = await Appraisal.find({ cycleId: cycle._id, voidedAt: null })
      .populate('supervisorId', 'name staffId email department')
      .populate('traineeSheetId')
      .populate('supervisorSheetId')
      .sort({ traineeStaffId: 1 });

    // 1. Build Wide Format Sheet
    const wideData = appraisals.map((a) => {
      const sup = a.supervisorId as any;
      const tSheet = (a.traineeSheetId as any)?.answers || {};
      const sSheet = (a.supervisorSheetId as any)?.answers || {};

      return {
        'Appraisal ID': a._id.toString(),
        'Cycle Name': cycle.name,
        'Cohort': cycle.cohort,
        'Trainee Staff ID': a.traineeStaffId,
        'Trainee Name': a.traineeName,
        'Trainee Email': a.traineeEmail,
        'Department': a.department,
        'Location': a.location,
        'Supervisor Staff ID': sup?.staffId || 'Unassigned',
        'Supervisor Name': sup?.name || 'Unassigned',
        'Status': a.status,
        'Flags': a.flags.join(', '),
        'Trainee Submitted At': a.traineeSubmittedAt ? new Date(a.traineeSubmittedAt).toISOString() : '',
        'Supervisor Submitted At': a.supervisorSubmittedAt ? new Date(a.supervisorSubmittedAt).toISOString() : '',
        // Trainee Answers
        'Trainee Rating 1 (Integration)': tSheet.t_r1 || '',
        'Trainee R1 Remarks': tSheet.t_r1_comment || '',
        'Trainee Rating 2 (KPI Delivery)': tSheet.t_r2 || '',
        'Trainee R2 Remarks': tSheet.t_r2_comment || '',
        'Trainee Rating 3 (Technical Systems)': tSheet.t_r3 || '',
        'Trainee R3 Remarks': tSheet.t_r3_comment || '',
        'Trainee Rating 4 (Supervision - Confidential)': tSheet.t_r4 || '',
        'Trainee R4 Remarks (Confidential)': tSheet.t_r4_comment || '',
        'Trainee Rating 5 (Brand Values)': tSheet.t_r5 || '',
        'Trainee R5 Remarks': tSheet.t_r5_comment || '',
        'Trainee Key Achievement 1': tSheet.t_q1a || '',
        'Trainee Key Achievement 2': tSheet.t_q1b || '',
        'Trainee Key Achievement 3': tSheet.t_q1c || '',
        'Trainee Challenges Encountered': tSheet.t_q2 || '',
        'Trainee L&D Needs (Confidential)': tSheet.t_q3 || '',
        'Trainee Career Aspirations': tSheet.t_q4 || '',
        'Trainee Overall Self-Rating': tSheet.t_overall || '',
        // Supervisor Answers
        'Supervisor R1 (Job Knowledge)': sSheet.s_r1 || '',
        'Supervisor R2 (Quality of Work)': sSheet.s_r2 || '',
        'Supervisor R3 (Productivity)': sSheet.s_r3 || '',
        'Supervisor R4 (Dependability)': sSheet.s_r4 || '',
        'Supervisor R5 (Initiative)': sSheet.s_r5 || '',
        'Supervisor R6 (Teamwork)': sSheet.s_r6 || '',
        'Supervisor R7 (Communication)': sSheet.s_r7 || '',
        'Supervisor Key Strength 1': sSheet.s_q1a || '',
        'Supervisor Key Strength 2': sSheet.s_q1b || '',
        'Supervisor Key Strength 3': sSheet.s_q1c || '',
        'Supervisor Improvement Areas': sSheet.s_q_dev || '',
        'Supervisor Recommended Training': sSheet.s_q2 || '',
        'Supervisor Overall Rating': sSheet.s_overall || '',
        'Supervisor Recommendation': sSheet.s_recommendation || '',
      };
    });

    // 2. Build Long Format Sheet
    const longData: any[] = [];
    appraisals.forEach((a) => {
      const tSheet = (a.traineeSheetId as any)?.answers || {};
      const sSheet = (a.supervisorSheetId as any)?.answers || {};

      Object.entries(tSheet).forEach(([fieldId, val]) => {
        longData.push({
          'Appraisal ID': a._id.toString(),
          'Trainee Staff ID': a.traineeStaffId,
          'Trainee Name': a.traineeName,
          'Respondent': 'Trainee',
          'Field ID': fieldId,
          'Value': typeof val === 'object' ? JSON.stringify(val) : String(val),
        });
      });

      Object.entries(sSheet).forEach(([fieldId, val]) => {
        longData.push({
          'Appraisal ID': a._id.toString(),
          'Trainee Staff ID': a.traineeStaffId,
          'Trainee Name': a.traineeName,
          'Respondent': 'Supervisor',
          'Field ID': fieldId,
          'Value': typeof val === 'object' ? JSON.stringify(val) : String(val),
        });
      });
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    const wsWide = XLSX.utils.json_to_sheet(wideData);
    const wsLong = XLSX.utils.json_to_sheet(longData);

    XLSX.utils.book_append_sheet(wb, wsWide, 'Appraisals Master');
    XLSX.utils.book_append_sheet(wb, wsLong, 'Responses Long Format');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `MTP_Appraisals_${cycle.slug}_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating Excel export:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
