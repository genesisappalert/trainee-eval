import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { Appraisal, Cycle, AuditLog, SupervisorSheet } from '@/lib/models';
import { renderAppraisalStandaloneHtml } from '@/lib/documents/standaloneHtml';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRoles = (session.user as any).roles || [];
    const isHr = userRoles.includes('hr_admin') || userRoles.includes('superadmin') || userRoles.includes('hr_viewer');
    if (!isHr) {
      return NextResponse.json({ error: 'Forbidden: HR Admin access required for ZIP export' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const cycleId = searchParams.get('cycleId');
    const idsParam = searchParams.get('ids');
    const statusParam = searchParams.get('status') || 'complete';
    const viewMode = (searchParams.get('viewMode') as any) || 'both';
    const isHrCopy = searchParams.get('isHrCopy') !== 'false';

    const filter: Record<string, any> = { voidedAt: null };

    if (idsParam) {
      const idList = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => mongoose.Types.ObjectId.isValid(s));

      if (idList.length === 0) {
        return NextResponse.json({ error: 'No valid appraisal IDs provided' }, { status: 400 });
      }
      filter._id = { $in: idList };
    } else if (cycleId) {
      if (!mongoose.Types.ObjectId.isValid(cycleId)) {
        return NextResponse.json({ error: 'Invalid cycleId provided' }, { status: 400 });
      }
      filter.cycleId = cycleId;

      if (statusParam === 'complete') {
        filter.status = { $in: ['complete', 'printed'] };
      } else if (statusParam !== 'all') {
        filter.status = statusParam;
      }
    } else {
      return NextResponse.json(
        { error: 'Please specify either ?cycleId or ?ids parameter' },
        { status: 400 }
      );
    }

    const appraisals = await Appraisal.find(filter)
      .populate('cycleId')
      .populate('traineeSheetId')
      .populate('supervisorSheetId')
      .populate('supervisorId', 'name staffId email department location savedSignatureKey')
      .sort({ traineeName: 1 });

    if (appraisals.length === 0) {
      return NextResponse.json(
        { error: 'No matching appraisal records found for export' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const summaryLines: string[] = [
      '=========================================================================',
      '  GENESIS GROUP - MANAGEMENT TRAINEE PROGRAMME (MTP) APPRAISAL ARCHIVE',
      '=========================================================================',
      `Generated At: ${new Date().toLocaleString('en-GB')}`,
      `Total Trainee Records: ${appraisals.length}`,
      `Export Mode: ${viewMode === 'both' ? 'Both Forms' : viewMode === 'supervisor' ? 'Supervisor Form Only' : 'Trainee Form Only'}`,
      `Confidential HR Copy: ${isHrCopy ? 'Yes' : 'No'}`,
      '-------------------------------------------------------------------------',
      'TRAINEE ROSTER INCLUDED IN THIS ARCHIVE:',
      '-------------------------------------------------------------------------',
    ];

    const CONFIDENTIAL_TRAINEE_KEYS = new Set(['t_r4', 't_c4', 't_r4_comment', 't_q3']);
    const appraisalIds = appraisals.map((a) => a._id);
    const allSupSheets = await SupervisorSheet.find({ appraisalId: { $in: appraisalIds } }).sort({ updatedAt: 1 });
    const supSheetsByAppraisal = new Map<string, any[]>();
    for (const s of allSupSheets) {
      const key = s.appraisalId.toString();
      if (!supSheetsByAppraisal.has(key)) supSheetsByAppraisal.set(key, []);
      supSheetsByAppraisal.get(key)!.push(s);
    }

    for (let i = 0; i < appraisals.length; i++) {
      const a: any = appraisals[i];
      const cycle = a.cycleId as any;
      const traineeSheet = a.traineeSheetId as any;
      const supSheet = a.supervisorSheetId as any;
      const supervisor = a.supervisorId as any;

      const rawTraineeAnswers: Record<string, any> = { ...(traineeSheet?.answers || {}) };
      for (let idx = 1; idx <= 5; idx++) {
        const cVal = rawTraineeAnswers[`t_c${idx}`] ?? rawTraineeAnswers[`t_r${idx}_comment`];
        if (cVal !== undefined) {
          rawTraineeAnswers[`t_c${idx}`] = cVal;
          rawTraineeAnswers[`t_r${idx}_comment`] = cVal;
        }
      }

      const sanitizedTraineeAnswers: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawTraineeAnswers)) {
        if (CONFIDENTIAL_TRAINEE_KEYS.has(key)) continue;
        sanitizedTraineeAnswers[key] = value;
      }

      const activeTraineeAnswers = isHrCopy && rawTraineeAnswers ? rawTraineeAnswers : sanitizedTraineeAnswers;
      const supervisorAnswers: Record<string, any> = {};
      const sheetsForApp = supSheetsByAppraisal.get(a._id.toString()) || [];
      for (const s of sheetsForApp) {
        if (s.answers && typeof s.answers === 'object') {
          for (const [k, v] of Object.entries(s.answers)) {
            if (v !== undefined && v !== null && v !== '') {
              supervisorAnswers[k] = v;
            } else if (!(k in supervisorAnswers)) {
              supervisorAnswers[k] = v;
            }
          }
        }
      }
      if (supSheet?.answers) {
        for (const [k, v] of Object.entries(supSheet.answers)) {
          if (v !== undefined && v !== null && v !== '') {
            supervisorAnswers[k] = v;
          }
        }
      }
      for (let idx = 1; idx <= 7; idx++) {
        const cVal = supervisorAnswers[`s_c${idx}`] ?? supervisorAnswers[`s_r${idx}_comment`];
        if (cVal !== undefined) {
          supervisorAnswers[`s_c${idx}`] = cVal;
          supervisorAnswers[`s_r${idx}_comment`] = cVal;
        }
      }

      const traineeSignatureSvg =
        traineeSheet?.signatureSvg ||
        traineeSheet?.signatureKey ||
        rawTraineeAnswers?.t_signature ||
        null;

      const supervisorSignatureSvg =
        supSheet?.signatureKey ||
        supSheet?.signatureSvg ||
        supervisorAnswers?.s_signature_svg ||
        supervisorAnswers?.s_signature ||
        supervisor?.savedSignatureKey ||
        null;

      const traineeDocData = {
        traineeName: a.traineeName,
        supervisorName: supervisorAnswers?.s_signature_name || activeTraineeAnswers?.t_supervisor_other || supervisor?.name || '—',
        staffId: a.traineeStaffId,
        appraisalDate: a.traineeSubmittedAt || a.createdAt,
        department: a.department,
        location: a.location,
        answers: activeTraineeAnswers || {},
        signatureDataUrl: traineeSignatureSvg || activeTraineeAnswers?.t_signature,
      };

      const supervisorDocData = {
        supervisorName: supervisorAnswers?.s_signature_name || supervisor?.name || '—',
        traineeName: a.traineeName,
        staffId: supervisorAnswers?.s_staff_id || a.traineeStaffId || supervisor?.staffId || '—',
        appraisalDate: a.supervisorSubmittedAt || supervisorAnswers?.s_signature_date,
        department: supervisorAnswers?.s_department || a.department,
        location: supervisorAnswers?.s_location || a.location,
        answers: supervisorAnswers || {},
        signatureDataUrl: supervisorSignatureSvg || supervisorAnswers?.s_signature_svg || supervisorAnswers?.s_signature,
      };

      const appraisalMeta = {
        _id: a._id.toString(),
        traineeName: a.traineeName,
        traineeStaffId: a.traineeStaffId,
        traineeEmail: a.traineeEmail,
        department: a.department,
        location: a.location,
        cycleName: cycle?.name,
        cohort: cycle?.cohort,
        createdAt: a.createdAt,
        traineeSubmittedAt: a.traineeSubmittedAt,
        supervisorSubmittedAt: a.supervisorSubmittedAt,
      };

      const html = renderAppraisalStandaloneHtml({
        appraisal: appraisalMeta,
        supervisorDocData,
        traineeDocData,
        viewMode,
      });

      // Format clean filename: e.g. "John Doe (STF-001) - Performance Appraisal.html"
      const cleanTraineeName = a.traineeName.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const cleanStaffId = a.traineeStaffId.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const docFilename = `${cleanTraineeName} (${cleanStaffId}) - Performance Appraisal.html`;

      zip.file(docFilename, html);

      summaryLines.push(
        `${String(i + 1).padStart(2, ' ')}. ${a.traineeName} | Staff ID: ${a.traineeStaffId} | Dept: ${a.department || '—'} | Supervisor: ${supervisor?.name || 'Unassigned'} | File: ${docFilename}`
      );
    }

    summaryLines.push('=========================================================================');
    zip.file('00_Cohort_Summary.txt', summaryLines.join('\n'));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Audit log
    try {
      await AuditLog.create({
        actorId: session.user.id,
        actorRole: userRoles.includes('superadmin') ? 'superadmin' : 'hr_admin',
        action: 'bulk_zip_exported',
        entity: 'appraisal_bundle_zip',
        entityId: cycleId || 'custom_selection',
        targetType: 'cycle',
        targetId: cycleId || '',
        cycleId: cycleId && mongoose.Types.ObjectId.isValid(cycleId) ? cycleId : null,
        metadata: {
          fileCount: appraisals.length,
          viewMode,
          isHrCopy,
        },
      });
    } catch (e) {
      console.warn('Audit logging error during zip export:', e);
    }

    const firstCycle = appraisals[0]?.cycleId as any;
    const cohortLabel = firstCycle?.cohort ? `_${firstCycle.cohort}` : '';
    const archiveFilename = `Genesis_Appraisals${cohortLabel}.zip`.replace(/\s+/g, '_');

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archiveFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error exporting appraisals zip:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
