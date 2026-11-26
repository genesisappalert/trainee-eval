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
    const idsParam = searchParams.get('ids');

    const cycleQuery: any = cycleId ? { _id: cycleId } : {};
    const cycle = await Cycle.findOne(cycleQuery).sort({ createdAt: -1 });

    if (!cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    const appraisalFilter: Record<string, any> = { cycleId: cycle._id, voidedAt: null };
    if (idsParam) {
      const idList = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (idList.length > 0) {
        appraisalFilter._id = { $in: idList };
      }
    }

    const appraisals = await Appraisal.find(appraisalFilter)
      .populate('supervisorId', 'name staffId email department')
      .populate('traineeSheetId')
      .populate('supervisorSheetId')
      .sort({ traineeStaffId: 1 });

    // Load all SupervisorSheets for these appraisals in case of duplicate sheets
    const appraisalIds = appraisals.map((a) => a._id);
    const allSupSheets = await SupervisorSheet.find({ appraisalId: { $in: appraisalIds } }).sort({ updatedAt: 1 });
    const supSheetsByAppraisal = new Map<string, any[]>();
    for (const s of allSupSheets) {
      const key = s.appraisalId.toString();
      if (!supSheetsByAppraisal.has(key)) supSheetsByAppraisal.set(key, []);
      supSheetsByAppraisal.get(key)!.push(s);
    }

    // 1. Build Wide Format Sheet
    const wideData = appraisals.map((a) => {
      const sup = a.supervisorId as any;
      const tSheet = (a.traineeSheetId as any)?.answers || {};
      const sSheet: Record<string, any> = {};
      for (const s of supSheetsByAppraisal.get(a._id.toString()) || []) {
        if (s.answers && typeof s.answers === 'object') {
          for (const [k, v] of Object.entries(s.answers)) {
            if (v !== undefined && v !== null && v !== '') {
              sSheet[k] = v;
            } else if (!(k in sSheet)) {
              sSheet[k] = v;
            }
          }
        }
      }
      if ((a.supervisorSheetId as any)?.answers) {
        for (const [k, v] of Object.entries((a.supervisorSheetId as any).answers)) {
          if (v !== undefined && v !== null && v !== '') {
            sSheet[k] = v;
          }
        }
      }

      return {
        'Assessment ID': a._id.toString(),
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
        'Trainee Rating 1 (Onboarding & Support)': tSheet.t_r1 || '',
        'Trainee R1 Remarks': tSheet.t_c1 || tSheet.t_r1_comment || '',
        'Trainee Rating 2 (KPIs & Deliverables)': tSheet.t_r2 || '',
        'Trainee R2 Remarks': tSheet.t_c2 || tSheet.t_r2_comment || '',
        'Trainee Rating 3 (Classroom Training)': tSheet.t_r3 || '',
        'Trainee R3 Remarks': tSheet.t_c3 || tSheet.t_r3_comment || '',
        'Trainee Rating 4 (Unit & Manager - Confidential)': tSheet.t_r4 || '',
        'Trainee R4 Remarks (Confidential)': tSheet.t_c4 || tSheet.t_r4_comment || '',
        'Trainee Rating 5 (Operational Independence)': tSheet.t_r5 || '',
        'Trainee R5 Remarks': tSheet.t_c5 || tSheet.t_r5_comment || '',
        'Trainee Key Achievement 1': tSheet.t_q1a || '',
        'Trainee Key Achievement 2': tSheet.t_q1b || '',
        'Trainee Key Achievement 3': tSheet.t_q1c || '',
        'Trainee Workflow / Cost-Saving Improvements': tSheet.t_q2 || '',
        'Trainee Supervisor / Unit Feedback (Confidential)': tSheet.t_q3 || '',
        'Trainee Career Readiness & Resources Needed': tSheet.t_q4 || '',
        'Trainee Overall Self-Rating': tSheet.t_overall || '',
        // Supervisor Answers & Comments
        'Supervisor R1 (KPIs & Deadlines)': sSheet.s_r1 || '',
        'Supervisor R1 Comments': sSheet.s_c1 || sSheet.s_r1_comment || '',
        'Supervisor R2 (Functional Knowledge & Accuracy)': sSheet.s_r2 || '',
        'Supervisor R2 Comments': sSheet.s_c2 || sSheet.s_r2_comment || '',
        'Supervisor R3 (Proactiveness & Problem Solving)': sSheet.s_r3 || '',
        'Supervisor R3 Comments': sSheet.s_c3 || sSheet.s_r3_comment || '',
        'Supervisor R4 (Workflow Improvement Initiatives)': sSheet.s_r4 || '',
        'Supervisor R4 Comments': sSheet.s_c4 || sSheet.s_r4_comment || '',
        'Supervisor R5 (Collaboration & Relationships)': sSheet.s_r5 || '',
        'Supervisor R5 Comments': sSheet.s_c5 || sSheet.s_r5_comment || '',
        'Supervisor R6 (Coachability & Agility)': sSheet.s_r6 || '',
        'Supervisor R6 Comments': sSheet.s_c6 || sSheet.s_r6_comment || '',
        'Supervisor R7 (Ownership & Leadership Potential)': sSheet.s_r7 || '',
        'Supervisor R7 Comments': sSheet.s_c7 || sSheet.s_r7_comment || '',
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
          'Assessment ID': a._id.toString(),
          'Trainee Staff ID': a.traineeStaffId,
          'Trainee Name': a.traineeName,
          'Respondent': 'Trainee',
          'Field ID': fieldId,
          'Value': typeof val === 'object' ? JSON.stringify(val) : String(val),
        });
      });

      Object.entries(sSheet).forEach(([fieldId, val]) => {
        longData.push({
          'Assessment ID': a._id.toString(),
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

    XLSX.utils.book_append_sheet(wb, wsWide, 'Assessments Master');
    XLSX.utils.book_append_sheet(wb, wsLong, 'Responses Long Format');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `MTP_Assessments_${cycle.slug}_${new Date().toISOString().split('T')[0]}.xlsx`;

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
