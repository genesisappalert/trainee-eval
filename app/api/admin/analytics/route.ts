import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Cycle, Appraisal, SupervisorSheet, RosterEntry } from '@/lib/models';

const SUPERVISOR_COMPETENCIES = [
  { id: 's_r1', cid: 's_c1', shortLabel: 'KPIs & Deadlines', fullLabel: 'Independently meets KPIs, operational goals & deadlines' },
  { id: 's_r2', cid: 's_c2', shortLabel: 'Functional Knowledge & Accuracy', fullLabel: 'Demonstrates functional knowledge, technical skill & accuracy' },
  { id: 's_r3', cid: 's_c3', shortLabel: 'Proactiveness & Problem Solving', fullLabel: 'Handles ambiguous situations proactively & resolves challenges' },
  { id: 's_r4', cid: 's_c4', shortLabel: 'Workflow Improvements', fullLabel: 'Identifies inefficiencies & implements workflow improvements' },
  { id: 's_r5', cid: 's_c5', shortLabel: 'Collaboration & Teamwork', fullLabel: 'Collaborates effectively across peers, units & subordinates' },
  { id: 's_r6', cid: 's_c6', shortLabel: 'Coachability & Agility', fullLabel: 'Accepts constructive criticism & applies coaching' },
  { id: 's_r7', cid: 's_c7', shortLabel: 'Ownership & Leadership Potential', fullLabel: 'Exhibits ownership, accountability & leadership readiness' },
];

const TRAINEE_AREAS = [
  { id: 't_r1', cid: 't_c1', shortLabel: 'Onboarding & Role Support', fullLabel: 'Smooth onboarding, transition & role scope support', confidential: false },
  { id: 't_r2', cid: 't_c2', shortLabel: 'KPIs & Business Alignment', fullLabel: 'Clear understanding of daily KPIs & deliverables', confidential: false },
  { id: 't_r3', cid: 't_c3', shortLabel: 'Induction & Classroom Training', fullLabel: 'Foundational MTP classroom training effectiveness', confidential: false },
  { id: 't_r4', cid: 't_c4', shortLabel: 'Unit & Line Manager Experience', fullLabel: 'Positive experience in assigned unit & with line manager (HR Confidential)', confidential: true },
  { id: 't_r5', cid: 't_c5', shortLabel: 'Operational Independence', fullLabel: 'Confidence handling operational challenges independently', confidential: false },
];

function normalizeOverallTier(val: unknown): 'tier5' | 'tier4' | 'tier3' | 'tier2' | 'tier1' | null {
  if (!val) return null;
  const v = String(val).toLowerCase().trim();
  if (v === 'exceptional' || v === 'excellent') return 'tier5';
  if (v === 'exceeds_expectations' || v === 'exceeds expectation' || v === 'very_good' || v === 'very good') return 'tier4';
  if (v === 'meets_expectations' || v === 'meets expectation' || v === 'good') return 'tier3';
  if (v === 'needs_development' || v === 'fair' || v === 'satisfactory') return 'tier2';
  if (v === 'unsatisfactory' || v === 'poor' || v === 'needs improvement') return 'tier1';
  return null;
}

function tierToNumeric(tier: 'tier5' | 'tier4' | 'tier3' | 'tier2' | 'tier1' | null): number | null {
  if (tier === 'tier5') return 5;
  if (tier === 'tier4') return 4;
  if (tier === 'tier3') return 3;
  if (tier === 'tier2') return 2;
  if (tier === 'tier1') return 1;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const isDev = process.env.NODE_ENV === 'development';
    if (!session?.user && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session?.user) {
      const roles = ((session.user as any).roles as string[]) || [];
      if (!roles.includes('hr_admin') && !roles.includes('superadmin') && !roles.includes('hr_viewer')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const reqCycleId = searchParams.get('cycleId');

    const cycles = await Cycle.find().sort({ createdAt: -1 }).lean();

    let selectedCycle: any = null;
    if (reqCycleId && reqCycleId !== 'all' && mongoose.Types.ObjectId.isValid(reqCycleId)) {
      selectedCycle = cycles.find((c: any) => c._id.toString() === reqCycleId) || null;
    } else if (!reqCycleId && cycles.length > 0) {
      selectedCycle = cycles.find((c: any) => c.status === 'open') || cycles[0];
    }

    const appraisalFilter: Record<string, any> = { voidedAt: null };
    const rosterFilter: Record<string, any> = {};
    if (selectedCycle) {
      appraisalFilter.cycleId = selectedCycle._id;
      rosterFilter.cycleId = selectedCycle._id;
    }

    const [appraisals, rosterCount] = await Promise.all([
      Appraisal.find(appraisalFilter)
        .populate('cycleId', 'name slug cohort status traineeDeadline supervisorDeadline')
        .populate('supervisorId', 'name staffId email department location')
        .populate('traineeSheetId')
        .populate('supervisorSheetId')
        .sort({ traineeName: 1 })
        .lean(),
      RosterEntry.countDocuments(rosterFilter),
    ]);

    // Merge all SupervisorSheets per appraisal (in case duplicate sheets exist)
    const appraisalIds = appraisals.map((a: any) => a._id);
    const allSupSheets = await SupervisorSheet.find({ appraisalId: { $in: appraisalIds } })
      .sort({ updatedAt: 1 })
      .lean();
    const supSheetsByAppraisal = new Map<string, any[]>();
    for (const s of allSupSheets) {
      const key = s.appraisalId.toString();
      if (!supSheetsByAppraisal.has(key)) supSheetsByAppraisal.set(key, []);
      supSheetsByAppraisal.get(key)!.push(s);
    }

    // Counters
    const statusCounts = {
      totalAppraisals: appraisals.length,
      rosterExpected: Math.max(rosterCount, appraisals.length),
      notStarted: Math.max(0, rosterCount - appraisals.length),
      traineeDraft: 0,
      awaitingSupervisor: 0,
      supervisorDraft: 0,
      needsReassignment: 0,
      complete: 0,
      flagged: 0,
    };

    // Competency accumulators
    const supCompStats = SUPERVISOR_COMPETENCIES.map((c) => ({
      id: c.id,
      cid: c.cid,
      shortLabel: c.shortLabel,
      fullLabel: c.fullLabel,
      sum: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      commentsCount: 0,
    }));

    const traineeAreaStats = TRAINEE_AREAS.map((t) => ({
      id: t.id,
      cid: t.cid,
      shortLabel: t.shortLabel,
      fullLabel: t.fullLabel,
      confidential: t.confidential,
      sum: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      commentsCount: 0,
    }));

    // Overall tier distribution
    const overallComparison = {
      tier5: { label: 'Exceptional / Excellent', supervisor: 0, trainee: 0 },
      tier4: { label: 'Exceeds Expectations / Very Good', supervisor: 0, trainee: 0 },
      tier3: { label: 'Meets Expectations / Good', supervisor: 0, trainee: 0 },
      tier2: { label: 'Needs Development / Fair', supervisor: 0, trainee: 0 },
      tier1: { label: 'Unsatisfactory / Poor', supervisor: 0, trainee: 0 },
    };

    // Recommendation breakdown
    const recommendations: Record<string, { id: string; label: string; count: number; color: string }> = {
      confirm_promotion: {
        id: 'confirm_promotion',
        label: 'Confirm Appointment / Fast-Track Promotion',
        count: 0,
        color: '#16a34a',
      },
      retain_on_track: {
        id: 'retain_on_track',
        label: 'Continue Programme / On Track',
        count: 0,
        color: '#2563eb',
      },
      extend_probation: {
        id: 'extend_probation',
        label: 'Extend Probationary Period (90-Day PIP)',
        count: 0,
        color: '#d97706',
      },
      reassign_unit: {
        id: 'reassign_unit',
        label: 'Reassign to Alternative Business Unit',
        count: 0,
        color: '#9333ea',
      },
      discontinue: {
        id: 'discontinue',
        label: 'Discontinue from MTP Programme',
        count: 0,
        color: '#dc2626',
      },
    };

    // Department, Location, Supervisor aggregations
    const deptMap = new Map<
      string,
      {
        department: string;
        total: number;
        complete: number;
        supScoreSum: number;
        supScoreCount: number;
        traineeScoreSum: number;
        traineeScoreCount: number;
        fastTrackCount: number;
        pipOrAttentionCount: number;
      }
    >();

    const locationMap = new Map<
      string,
      {
        location: string;
        total: number;
        complete: number;
        supScoreSum: number;
        supScoreCount: number;
        traineeScoreSum: number;
        traineeScoreCount: number;
      }
    >();

    const supervisorPerfMap = new Map<
      string,
      {
        supervisorId: string;
        name: string;
        staffId: string;
        department: string;
        assigned: number;
        completed: number;
        pending: number;
        avgScoreGivenSum: number;
        avgScoreGivenCount: number;
        turnaroundDaysSum: number;
        turnaroundDaysCount: number;
      }
    >();

    let totalSupAvgSum = 0;
    let totalSupAvgCount = 0;
    let totalTraineeAvgSum = 0;
    let totalTraineeAvgCount = 0;
    let totalTurnaroundDaysSum = 0;
    let totalTurnaroundCount = 0;
    let calibrationPairSum = 0;
    let calibrationPairCount = 0;

    // Trainee individual analytical rows
    const traineeRows: any[] = [];

    for (const a of appraisals as any[]) {
      // Status counts
      if (a.status === 'trainee_draft') statusCounts.traineeDraft++;
      else if (a.status === 'awaiting_supervisor') statusCounts.awaitingSupervisor++;
      else if (a.status === 'supervisor_draft') statusCounts.supervisorDraft++;
      else if (a.status === 'needs_reassignment') statusCounts.needsReassignment++;
      else if (a.status === 'complete' || a.status === 'printed') statusCounts.complete++;

      if (Array.isArray(a.flags) && a.flags.length > 0) {
        statusCounts.flagged++;
      }

      const tAnswers: Record<string, any> = { ...((a.traineeSheetId as any)?.answers || {}) };
      const sAnswers: Record<string, any> = {};
      for (const s of supSheetsByAppraisal.get(a._id.toString()) || []) {
        if (s.answers && typeof s.answers === 'object') {
          for (const [k, v] of Object.entries(s.answers)) {
            if (v !== undefined && v !== null && v !== '') {
              sAnswers[k] = v;
            } else if (!(k in sAnswers)) {
              sAnswers[k] = v;
            }
          }
        }
      }
      if ((a.supervisorSheetId as any)?.answers) {
        for (const [k, v] of Object.entries((a.supervisorSheetId as any).answers)) {
          if (v !== undefined && v !== null && v !== '') {
            sAnswers[k] = v;
          }
        }
      }

      // Compute trainee self-rating average across t_r1..t_r5
      let tSum = 0;
      let tCount = 0;
      const traineeRatings: Record<string, number | null> = {};
      const traineeComments: Record<string, string> = {};

      for (const area of traineeAreaStats) {
        const num = Number(tAnswers[area.id]);
        const cText = String(tAnswers[area.cid] ?? tAnswers[`${area.id}_comment`] ?? '').trim();
        if (cText) {
          area.commentsCount++;
          traineeComments[area.id] = cText;
        }
        if (!isNaN(num) && num >= 1 && num <= 5) {
          tSum += num;
          tCount++;
          area.sum += num;
          area.count++;
          area.distribution[Math.round(num)] = (area.distribution[Math.round(num)] || 0) + 1;
          traineeRatings[area.id] = num;
        } else {
          traineeRatings[area.id] = null;
        }
      }
      const traineeAvg = tCount > 0 ? Number((tSum / tCount).toFixed(2)) : null;
      if (traineeAvg !== null) {
        totalTraineeAvgSum += traineeAvg;
        totalTraineeAvgCount++;
      }

      // Compute supervisor competency average across s_r1..s_r7
      let sSum = 0;
      let sCount = 0;
      const supervisorRatings: Record<string, number | null> = {};
      const supervisorComments: Record<string, string> = {};

      for (const comp of supCompStats) {
        const num = Number(sAnswers[comp.id]);
        const cText = String(sAnswers[comp.cid] ?? sAnswers[`${comp.id}_comment`] ?? '').trim();
        if (cText) {
          comp.commentsCount++;
          supervisorComments[comp.id] = cText;
        }
        if (!isNaN(num) && num >= 1 && num <= 5) {
          sSum += num;
          sCount++;
          comp.sum += num;
          comp.count++;
          comp.distribution[Math.round(num)] = (comp.distribution[Math.round(num)] || 0) + 1;
          supervisorRatings[comp.id] = num;
        } else {
          supervisorRatings[comp.id] = null;
        }
      }
      const supervisorAvg = sCount > 0 ? Number((sSum / sCount).toFixed(2)) : null;
      if (supervisorAvg !== null) {
        totalSupAvgSum += supervisorAvg;
        totalSupAvgCount++;
      }

      if (traineeAvg !== null && supervisorAvg !== null) {
        calibrationPairSum += traineeAvg - supervisorAvg;
        calibrationPairCount++;
      }

      // Overall tier counts
      const tTier = normalizeOverallTier(tAnswers.t_overall);
      if (tTier) overallComparison[tTier].trainee++;

      const sTier = normalizeOverallTier(sAnswers.s_overall);
      if (sTier) overallComparison[sTier].supervisor++;

      // Recommendation count
      const recKey = sAnswers.s_recommendation;
      if (recKey && recommendations[recKey]) {
        recommendations[recKey].count++;
      }

      // Turnaround time
      let turnaroundDays: number | null = null;
      if (a.traineeSubmittedAt && a.supervisorSubmittedAt) {
        const diffMs = new Date(a.supervisorSubmittedAt).getTime() - new Date(a.traineeSubmittedAt).getTime();
        turnaroundDays = Math.max(0, Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(1)));
        totalTurnaroundDaysSum += turnaroundDays;
        totalTurnaroundCount++;
      }

      // Department aggregation
      const deptName = (a.department || 'Unspecified Department').trim();
      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          department: deptName,
          total: 0,
          complete: 0,
          supScoreSum: 0,
          supScoreCount: 0,
          traineeScoreSum: 0,
          traineeScoreCount: 0,
          fastTrackCount: 0,
          pipOrAttentionCount: 0,
        });
      }
      const dEntry = deptMap.get(deptName)!;
      dEntry.total++;
      if (a.status === 'complete' || a.status === 'printed') dEntry.complete++;
      if (supervisorAvg !== null) {
        dEntry.supScoreSum += supervisorAvg;
        dEntry.supScoreCount++;
      }
      if (traineeAvg !== null) {
        dEntry.traineeScoreSum += traineeAvg;
        dEntry.traineeScoreCount++;
      }
      if (recKey === 'confirm_promotion') dEntry.fastTrackCount++;
      if (recKey === 'extend_probation' || recKey === 'reassign_unit' || recKey === 'discontinue') {
        dEntry.pipOrAttentionCount++;
      }

      // Location aggregation
      const locName = (a.location || 'Unspecified Location').trim();
      if (!locationMap.has(locName)) {
        locationMap.set(locName, {
          location: locName,
          total: 0,
          complete: 0,
          supScoreSum: 0,
          supScoreCount: 0,
          traineeScoreSum: 0,
          traineeScoreCount: 0,
        });
      }
      const lEntry = locationMap.get(locName)!;
      lEntry.total++;
      if (a.status === 'complete' || a.status === 'printed') lEntry.complete++;
      if (supervisorAvg !== null) {
        lEntry.supScoreSum += supervisorAvg;
        lEntry.supScoreCount++;
      }
      if (traineeAvg !== null) {
        lEntry.traineeScoreSum += traineeAvg;
        lEntry.traineeScoreCount++;
      }

      // Supervisor aggregation
      const sup = a.supervisorId as any;
      if (sup && sup._id) {
        const supId = sup._id.toString();
        if (!supervisorPerfMap.has(supId)) {
          supervisorPerfMap.set(supId, {
            supervisorId: supId,
            name: sup.name,
            staffId: sup.staffId,
            department: sup.department || '—',
            assigned: 0,
            completed: 0,
            pending: 0,
            avgScoreGivenSum: 0,
            avgScoreGivenCount: 0,
            turnaroundDaysSum: 0,
            turnaroundDaysCount: 0,
          });
        }
        const sPerf = supervisorPerfMap.get(supId)!;
        sPerf.assigned++;
        if (a.status === 'complete' || a.status === 'printed') {
          sPerf.completed++;
        } else {
          sPerf.pending++;
        }
        if (supervisorAvg !== null) {
          sPerf.avgScoreGivenSum += supervisorAvg;
          sPerf.avgScoreGivenCount++;
        }
        if (turnaroundDays !== null) {
          sPerf.turnaroundDaysSum += turnaroundDays;
          sPerf.turnaroundDaysCount++;
        }
      }

      traineeRows.push({
        _id: a._id.toString(),
        traineeName: a.traineeName,
        traineeStaffId: a.traineeStaffId,
        traineeEmail: a.traineeEmail,
        department: deptName,
        location: locName,
        cycleName: (a.cycleId as any)?.name || '',
        cohort: (a.cycleId as any)?.cohort || '',
        supervisorName: sup?.name || tAnswers.t_supervisor_other || 'Unassigned',
        supervisorStaffId: sup?.staffId || '—',
        status: a.status,
        flags: a.flags || [],
        traineeAvg,
        supervisorAvg,
        calibrationGap:
          traineeAvg !== null && supervisorAvg !== null
            ? Number((traineeAvg - supervisorAvg).toFixed(2))
            : null,
        traineeOverall: tAnswers.t_overall || null,
        supervisorOverall: sAnswers.s_overall || null,
        supervisorOverallNumeric: tierToNumeric(sTier),
        recommendation: recKey || null,
        recommendationLabel: recKey && recommendations[recKey] ? recommendations[recKey].label : null,
        traineeRatings,
        supervisorRatings,
        traineeComments,
        supervisorComments,
        keyStrengths: [sAnswers.s_q1a, sAnswers.s_q1b, sAnswers.s_q1c].filter(Boolean),
        improvementAreas: sAnswers.s_q_dev || '',
        recommendedTraining: sAnswers.s_q2 || '',
        traineeProjects: [tAnswers.t_q1a, tAnswers.t_q1b, tAnswers.t_q1c].filter(Boolean),
        traineeWorkflowImprovements: tAnswers.t_q2 || '',
        traineeConfidentialFeedback: tAnswers.t_q3 || '',
        traineeResourcesNeeded: tAnswers.t_q4 || '',
        traineeSubmittedAt: a.traineeSubmittedAt,
        supervisorSubmittedAt: a.supervisorSubmittedAt,
        turnaroundDays,
      });
    }

    const formattedSupCompetencies = supCompStats.map((c) => {
      const avg = c.count > 0 ? Number((c.sum / c.count).toFixed(2)) : 0;
      const highCount = (c.distribution[4] || 0) + (c.distribution[5] || 0);
      const lowCount = (c.distribution[1] || 0) + (c.distribution[2] || 0);
      return {
        id: c.id,
        shortLabel: c.shortLabel,
        fullLabel: c.fullLabel,
        average: avg,
        evaluatedCount: c.count,
        commentsCount: c.commentsCount,
        highPerformerPct: c.count > 0 ? Math.round((highCount / c.count) * 100) : 0,
        needsDevPct: c.count > 0 ? Math.round((lowCount / c.count) * 100) : 0,
        distribution: c.distribution,
      };
    });

    const formattedTraineeAreas = traineeAreaStats.map((t) => {
      const avg = t.count > 0 ? Number((t.sum / t.count).toFixed(2)) : 0;
      const positiveCount = (t.distribution[4] || 0) + (t.distribution[5] || 0);
      return {
        id: t.id,
        shortLabel: t.shortLabel,
        fullLabel: t.fullLabel,
        confidential: t.confidential,
        average: avg,
        respondentCount: t.count,
        commentsCount: t.commentsCount,
        positivePct: t.count > 0 ? Math.round((positiveCount / t.count) * 100) : 0,
        distribution: t.distribution,
      };
    });

    const departmentBreakdown = Array.from(deptMap.values())
      .map((d) => ({
        department: d.department,
        total: d.total,
        complete: d.complete,
        completionPct: d.total > 0 ? Math.round((d.complete / d.total) * 100) : 0,
        avgSupervisorScore: d.supScoreCount > 0 ? Number((d.supScoreSum / d.supScoreCount).toFixed(2)) : null,
        avgTraineeScore: d.traineeScoreCount > 0 ? Number((d.traineeScoreSum / d.traineeScoreCount).toFixed(2)) : null,
        fastTrackCount: d.fastTrackCount,
        pipOrAttentionCount: d.pipOrAttentionCount,
      }))
      .sort((a, b) => (b.avgSupervisorScore ?? 0) - (a.avgSupervisorScore ?? 0));

    const locationBreakdown = Array.from(locationMap.values())
      .map((l) => ({
        location: l.location,
        total: l.total,
        complete: l.complete,
        completionPct: l.total > 0 ? Math.round((l.complete / l.total) * 100) : 0,
        avgSupervisorScore: l.supScoreCount > 0 ? Number((l.supScoreSum / l.supScoreCount).toFixed(2)) : null,
        avgTraineeScore: l.traineeScoreCount > 0 ? Number((l.traineeScoreSum / l.traineeScoreCount).toFixed(2)) : null,
      }))
      .sort((a, b) => b.total - a.total);

    const supervisorBreakdown = Array.from(supervisorPerfMap.values())
      .map((s) => ({
        supervisorId: s.supervisorId,
        name: s.name,
        staffId: s.staffId,
        department: s.department,
        assigned: s.assigned,
        completed: s.completed,
        pending: s.pending,
        completionPct: s.assigned > 0 ? Math.round((s.completed / s.assigned) * 100) : 0,
        avgScoreGiven: s.avgScoreGivenCount > 0 ? Number((s.avgScoreGivenSum / s.avgScoreGivenCount).toFixed(2)) : null,
        avgTurnaroundDays:
          s.turnaroundDaysCount > 0 ? Number((s.turnaroundDaysSum / s.turnaroundDaysCount).toFixed(1)) : null,
      }))
      .sort((a, b) => b.assigned - a.assigned);

    // Find strongest & weakest supervisor competencies
    const evaluatedComps = formattedSupCompetencies.filter((c) => c.evaluatedCount > 0);
    const sortedComps = [...evaluatedComps].sort((a, b) => b.average - a.average);
    const strongestCompetency = sortedComps[0] || null;
    const weakestCompetency = sortedComps[sortedComps.length - 1] || null;

    return NextResponse.json({
      cycles: cycles.map((c: any) => ({
        _id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        cohort: c.cohort,
        status: c.status,
      })),
      selectedCycle: selectedCycle
        ? {
            _id: selectedCycle._id.toString(),
            name: selectedCycle.name,
            slug: selectedCycle.slug,
            cohort: selectedCycle.cohort,
            status: selectedCycle.status,
            traineeDeadline: selectedCycle.traineeDeadline,
            supervisorDeadline: selectedCycle.supervisorDeadline,
          }
        : null,
      kpis: {
        ...statusCounts,
        completionRatePct:
          statusCounts.totalAppraisals > 0
            ? Math.round((statusCounts.complete / statusCounts.totalAppraisals) * 100)
            : 0,
        avgSupervisorScore:
          totalSupAvgCount > 0 ? Number((totalSupAvgSum / totalSupAvgCount).toFixed(2)) : null,
        avgTraineeScore:
          totalTraineeAvgCount > 0 ? Number((totalTraineeAvgSum / totalTraineeAvgCount).toFixed(2)) : null,
        avgCalibrationGap:
          calibrationPairCount > 0 ? Number((calibrationPairSum / calibrationPairCount).toFixed(2)) : null,
        avgTurnaroundDays:
          totalTurnaroundCount > 0 ? Number((totalTurnaroundDaysSum / totalTurnaroundCount).toFixed(1)) : null,
        fastTrackPromotionCount: recommendations.confirm_promotion.count,
        onTrackCount: recommendations.retain_on_track.count,
        interventionNeededCount:
          recommendations.extend_probation.count +
          recommendations.reassign_unit.count +
          recommendations.discontinue.count,
        strongestCompetency,
        weakestCompetency,
      },
      supervisorCompetencies: formattedSupCompetencies,
      traineeAreas: formattedTraineeAreas,
      overallComparison,
      recommendations: Object.values(recommendations),
      departmentBreakdown,
      locationBreakdown,
      supervisorBreakdown,
      traineeRows,
    });
  } catch (error: any) {
    console.error('Error computing report analytics:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
