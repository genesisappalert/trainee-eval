import bcrypt from 'bcryptjs';
import connectDB from './db';
import {
  User,
  Cycle,
  FormVersion,
  Appraisal,
  TraineeSheet,
  SupervisorSheet,
  AuditLog,
} from './models';
import {
  TRAINEE_V1_TITLE,
  TRAINEE_V1_PURPOSE,
  TRAINEE_RATING_SCALE,
  TRAINEE_V1_FIELDS,
  SUPERVISOR_V1_TITLE,
  SUPERVISOR_V1_PURPOSE,
  SUPERVISOR_RATING_SCALE,
  SUPERVISOR_V1_FIELDS,
} from './forms/definitions';

export async function runSeed(force = false) {
  await connectDB();

  // 1. Check or create Form Versions
  let traineeForm = await FormVersion.findOne({ kind: 'trainee', version: 'v1' });
  if (!traineeForm || force) {
    if (traineeForm && force) await FormVersion.deleteOne({ _id: traineeForm._id });
    traineeForm = await FormVersion.create({
      kind: 'trainee',
      version: 'v1',
      title: TRAINEE_V1_TITLE,
      purpose: TRAINEE_V1_PURPOSE,
      ratingScale: TRAINEE_RATING_SCALE,
      fields: TRAINEE_V1_FIELDS,
      active: true,
    });
  }

  let supervisorForm = await FormVersion.findOne({ kind: 'supervisor', version: 'v1' });
  if (!supervisorForm || force) {
    if (supervisorForm && force) await FormVersion.deleteOne({ _id: supervisorForm._id });
    supervisorForm = await FormVersion.create({
      kind: 'supervisor',
      version: 'v1',
      title: SUPERVISOR_V1_TITLE,
      purpose: SUPERVISOR_V1_PURPOSE,
      ratingScale: SUPERVISOR_RATING_SCALE,
      fields: SUPERVISOR_V1_FIELDS,
      active: true,
    });
  }

  // 2. Hash default password
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 3. Create HR Admin user
  let hrAdmin = await User.findOne({ staffId: 'GEN-HR-001' });
  if (!hrAdmin) {
    hrAdmin = await User.create({
      staffId: 'GEN-HR-001',
      name: 'Adewale Johnson',
      email: 'adewale.johnson@genesisgroup.com',
      passwordHash: defaultPasswordHash,
      accessCode: 'ADMIN-001',
      roles: ['hr_admin'],
      department: 'Human Resources',
      location: 'Port Harcourt HQ',
      mustChangePassword: false,
    });
  } else if (!hrAdmin.accessCode) {
    hrAdmin.accessCode = 'ADMIN-001';
    await hrAdmin.save();
  }

  // 4. Create Supervisors
  const supervisorData: Array<{
    staffId: string;
    name: string;
    email: string;
    department: string;
    location: string;
    accessCode: string;
    roles: ('supervisor' | 'hr_admin' | 'hr_viewer')[];
  }> = [
    {
      staffId: 'GEN-SUP-001',
      name: 'David Adeleke',
      email: 'david.adeleke@genesisgroup.com',
      department: 'Restaurant Operations',
      location: 'GRA Port Harcourt',
      accessCode: 'SUP-1010',
      roles: ['supervisor'],
    },
    {
      staffId: 'GEN-SUP-002',
      name: 'Amaka Okonkwo',
      email: 'amaka.okonkwo@genesisgroup.com',
      department: 'Finance & Accounts',
      location: 'Lagos Island',
      accessCode: 'SUP-2020',
      roles: ['supervisor'],
    },
    {
      staffId: 'GEN-SUP-003',
      name: 'Tunde Bakare',
      email: 'tunde.bakare@genesisgroup.com',
      department: 'Supply Chain & Logistics',
      location: 'Trans Amadi Hub',
      accessCode: 'SUP-3030',
      roles: ['supervisor'],
    },
    {
      staffId: 'GEN-SUP-004',
      name: 'Chioma Eze',
      email: 'chioma.eze@genesisgroup.com',
      department: 'Quality Assurance & HSE',
      location: 'Abuja Regional Center',
      accessCode: 'SUP-4040',
      roles: ['supervisor'],
    },
  ];

  const supervisors: any[] = [];
  for (const sup of supervisorData) {
    let user = await User.findOne({ staffId: sup.staffId });
    if (!user) {
      user = await User.create({
        ...sup,
        passwordHash: defaultPasswordHash,
        mustChangePassword: false,
      });
    } else if (!user.accessCode) {
      user.accessCode = sup.accessCode;
      await user.save();
    }
    supervisors.push(user);
  }

  // 5. Create Active Cycle
  let cycle = await Cycle.findOne({ slug: '2026-mid-year' });
  if (!cycle) {
    const now = new Date();
    const traineeDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const supervisorDeadline = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000);

    cycle = await Cycle.create({
      slug: '2026-mid-year',
      name: '2026 Cohort Mid-Year Appraisal',
      cohort: 'Cohort 2026-A',
      status: 'open',
      opensAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // opened 2 days ago
      traineeDeadline,
      supervisorDeadline,
      traineeFormVersionId: traineeForm._id,
      supervisorFormVersionId: supervisorForm._id,
      supervisorIds: supervisors.map((s) => s._id),
      resultsReleased: false,
      reminderPolicy: {
        enabled: true,
        daysBeforeDeadline: [7, 3, 1],
        daysWhileOverdue: 2,
      },
      printConfidentialOnHrCopy: true,
    });
  }

  // 6. Sample Appraisals
  const existingAppraisals = await Appraisal.countDocuments({ cycleId: cycle._id });
  if (existingAppraisals === 0) {
    // Sample Trainee 1: Awaiting Supervisor assessment
    const t1Answers = {
      t_name: 'Emeka Nwosu',
      t_staff_id: 'GEN-TR-042',
      t_email: 'emeka.nwosu@genesisgroup.com',
      t_department: 'Restaurant Operations',
      t_location: 'GRA Port Harcourt',
      t_supervisor: supervisors[0]._id.toString(),
      t_r1: 4,
      t_r1_comment: 'Integrated smoothly with the shift leads and fast-track kitchen routines.',
      t_r2: 5,
      t_r2_comment: 'Exceeded weekly speed-of-service targets by 12% across lunch peak hours.',
      t_r3: 4,
      t_r3_comment: 'Quickly picked up the POS software and inventory auditing sheets.',
      t_r4: 4, // confidential
      t_r4_comment: 'Supervisor David was very supportive and provided clear weekly coaching sessions.',
      t_r5: 4,
      t_r5_comment: 'I feel very aligned with Genesis Group corporate standards and guest hospitality values.',
      t_q1a: 'Achieved zero discrepancy on weekly raw material reconciliation in month 3.',
      t_q1b: 'Led floor crew to achieve 98% hygiene audit score during mystery shopper visit.',
      t_q1c: 'Trained 4 newly joined kitchen assistants on HACCP safety compliance.',
      t_q2: 'Initial transition during peak festival week was stressful due to staffing shortages.',
      t_q3: 'I would benefit from advanced cross-training in food cost budgeting and enterprise ERP.', // confidential
      t_q4: 'Aspiring to take up Assistant Store Manager responsibilities before end of year.',
      t_overall: 'very_good',
      t_signature_name: 'Emeka Nwosu',
      t_signature_date: new Date().toISOString().split('T')[0],
      t_signature_svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="10" y="40" font-family="cursive" font-size="24" fill="#002147">Emeka Nwosu</text></svg>',
    };

    const app1 = (await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: 'GEN-TR-042',
      traineeName: 'Emeka Nwosu',
      traineeEmail: 'emeka.nwosu@genesisgroup.com',
      department: 'Restaurant Operations',
      location: 'GRA Port Harcourt',
      supervisorId: supervisors[0]._id,
      status: 'awaiting_supervisor',
      flags: [],
      traineeSubmittedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
    })) as any;

    const sheet1 = await TraineeSheet.create({
      appraisalId: app1._id,
      formVersionId: traineeForm._id,
      answers: t1Answers,
      status: 'submitted',
      submittedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
      tokenHash: 'dummy-hash-1',
    });
    app1.traineeSheetId = sheet1._id;
    await app1.save();

    // Sample Trainee 2: Complete (both trainee & supervisor submitted)
    const t2Answers = {
      t_name: 'Fatima Aliyu',
      t_staff_id: 'GEN-TR-055',
      t_email: 'fatima.aliyu@genesisgroup.com',
      t_department: 'Finance & Accounts',
      t_location: 'Lagos Island',
      t_supervisor: supervisors[1]._id.toString(),
      t_r1: 5,
      t_r1_comment: 'Adapted swiftly to treasury accounting and bank reconciliation modules.',
      t_r2: 5,
      t_r2_comment: 'Streamlined vendor payment voucher validation turnaround from 4 days to 24 hours.',
      t_r3: 5,
      t_r3_comment: 'Learned internal audit and tax schedule preparation ahead of schedule.',
      t_r4: 5,
      t_r4_comment: 'Supervision was thorough, encouraging, and highly professional.',
      t_r5: 5,
      t_r5_comment: 'Proud to represent Genesis financial governance integrity.',
      t_q1a: 'Automated 12 bank statement imports reducing manual spreadsheet entries.',
      t_q1b: 'Recovered duplicate vendor billing discrepancies amounting to ₦1.8M.',
      t_q1c: 'Delivered month-end GL close 2 days faster than historical average.',
      t_q2: 'Initial hurdle was navigating legacy ledger archives with missing paper memos.',
      t_q3: 'Financial modeling and advanced IFRS certification support.',
      t_q4: 'Aiming to lead Treasury Operations for Western Region divisions.',
      t_overall: 'excellent',
      t_signature_name: 'Fatima Aliyu',
      t_signature_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      t_signature_svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="10" y="40" font-family="cursive" font-size="24" fill="#002147">Fatima Aliyu</text></svg>',
    };

    const s2Answers = {
      s_r1: 5,
      s_r1_comment: 'Outstanding technical diligence and zero errors in ledger reconciliations.',
      s_r2: 5,
      s_r2_comment: 'Takes immediate initiative on complex accounts and proactively resolves bottlenecks.',
      s_r3: 5,
      s_r3_comment: 'Excellent collaboration with store managers and divisional accountants.',
      s_r4: 5,
      s_r4_comment: 'Maintains punctuality, exemplary ethics, and confidentiality of company figures.',
      s_r5: 5,
      s_r5_comment: 'Shows natural leadership and mentors junior account clerks effectively.',
      s_r6: 5,
      s_r6_comment: 'Demonstrates deep analytical rigor and thorough commercial acumen.',
      s_r7: 5,
      s_r7_comment: 'Exceeds all assigned KPIs and consistently overdelivers on targets.',
      s_q1a: 'Exceptional attention to financial detail and reconciliation accuracy.',
      s_q1b: 'Proactive problem solving with vendor payment automation.',
      s_q1c: 'High integrity, dependability, and professional composure under pressure.',
      s_q_dev: 'Continue expanding exposure to group-level consolidation and fiscal risk analysis.',
      s_q2: 'Recommend sponsorship for ICAN/ACCA advanced taxation & group financial reporting.',
      s_overall: 'excellent',
      s_recommendation: 'confirm_promotion',
      s_signature_name: 'Amaka Okonkwo',
      s_signature_date: new Date().toISOString().split('T')[0],
      s_signature_svg: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="10" y="40" font-family="cursive" font-size="24" fill="#002147">Amaka Okonkwo</text></svg>',
    };

    const app2 = (await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: 'GEN-TR-055',
      traineeName: 'Fatima Aliyu',
      traineeEmail: 'fatima.aliyu@genesisgroup.com',
      department: 'Finance & Accounts',
      location: 'Lagos Island',
      supervisorId: supervisors[1]._id,
      status: 'complete',
      flags: [],
      traineeSubmittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      supervisorSubmittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    })) as any;

    const sheet2T = await TraineeSheet.create({
      appraisalId: app2._id,
      formVersionId: traineeForm._id,
      answers: t2Answers,
      status: 'submitted',
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      tokenHash: 'dummy-hash-2',
    });

    const sheet2S = await SupervisorSheet.create({
      appraisalId: app2._id,
      supervisorId: supervisors[1]._id,
      formVersionId: supervisorForm._id,
      answers: s2Answers,
      status: 'submitted',
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    });

    app2.traineeSheetId = sheet2T._id;
    app2.supervisorSheetId = sheet2S._id;
    await app2.save();

    // Sample Trainee 3: Needs reassignment flag
    const app3 = (await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: 'GEN-TR-071',
      traineeName: 'Babatunde Adele',
      traineeEmail: 'babatunde.adele@genesisgroup.com',
      department: 'Supply Chain & Logistics',
      location: 'Trans Amadi Hub',
      supervisorId: supervisors[2]._id,
      status: 'needs_reassignment',
      flags: ['needs_reassignment'],
      traineeSubmittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })) as any;

    const sheet3T = await TraineeSheet.create({
      appraisalId: app3._id,
      formVersionId: traineeForm._id,
      answers: {
        t_name: 'Babatunde Adele',
        t_staff_id: 'GEN-TR-071',
        t_email: 'babatunde.adele@genesisgroup.com',
        t_department: 'Supply Chain & Logistics',
        t_location: 'Trans Amadi Hub',
        t_supervisor: supervisors[2]._id.toString(),
        t_r1: 3,
        t_r2: 4,
        t_r3: 3,
        t_r4: 2,
        t_r5: 3,
        t_q1a: 'Managed central cold chain delivery schedules for 14 branches.',
        t_q1b: 'Maintained 99.2% on-time dispatch rate.',
        t_q1c: 'Negotiated improved diesel delivery terms with local vendors.',
        t_q2: 'Shifted from Trans Amadi warehouse to Onne terminal halfway through the rotation.',
        t_q3: 'Clarity on who my primary supervising unit manager is after rotation.',
        t_q4: 'Fleet dispatch and warehousing lead.',
        t_overall: 'good',
        t_signature_name: 'Babatunde Adele',
        t_signature_date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      status: 'submitted',
      submittedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      tokenHash: 'dummy-hash-3',
    });
    app3.traineeSheetId = sheet3T._id;
    await app3.save();

    // Sample Trainee 4: Unassigned supervisor flag
    const app4 = (await Appraisal.create({
      cycleId: cycle._id,
      traineeStaffId: 'GEN-TR-089',
      traineeName: 'Kemi Balogun',
      traineeEmail: 'kemi.balogun@genesisgroup.com',
      department: 'Quality Assurance & HSE',
      location: 'Abuja Regional Center',
      supervisorId: null,
      status: 'awaiting_supervisor',
      flags: ['unassigned'],
      traineeSubmittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    })) as any;

    const sheet4T = await TraineeSheet.create({
      appraisalId: app4._id,
      formVersionId: traineeForm._id,
      answers: {
        t_name: 'Kemi Balogun',
        t_staff_id: 'GEN-TR-089',
        t_email: 'kemi.balogun@genesisgroup.com',
        t_department: 'Quality Assurance & HSE',
        t_location: 'Abuja Regional Center',
        t_supervisor: 'unassigned',
        t_supervisor_other: 'Mr. Patrick Obi (Regional QA Manager - Not on list)',
        t_r1: 4,
        t_r2: 4,
        t_r3: 5,
        t_r4: 4,
        t_r5: 5,
        t_q1a: 'Conducted 32 comprehensive spot inspections across Abuja kitchens.',
        t_q1b: 'Formulated oil degradation testing SOP for fryers.',
        t_q1c: 'Trained restaurant store managers on pest control records.',
        t_q2: 'Regional travel delays due to road maintenance.',
        t_q3: 'ISO 22000 Lead Auditor certification pathway.',
        t_q4: 'Regional HSE Auditor for North Central division.',
        t_overall: 'very_good',
        t_signature_name: 'Kemi Balogun',
        t_signature_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      status: 'submitted',
      submittedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      tokenHash: 'dummy-hash-4',
    });
    app4.traineeSheetId = sheet4T._id;
    await app4.save();

    // Log seed in audit log
    await AuditLog.create({
      actorId: hrAdmin._id,
      actorRole: 'hr_admin',
      action: 'system_initialized',
      targetType: 'system',
      targetId: 'seed',
      cycleId: cycle._id,
      metadata: {
        seededAt: new Date(),
        cycleSlug: cycle.slug,
        traineeCount: 4,
      },
    });
  }

  return {
    success: true,
    message: 'System seeded successfully with Genesis Group MTP demo data',
    accounts: {
      hrAdmin: { staffId: 'GEN-HR-001', password: 'Password123!' },
      supervisors: [
        { staffId: 'GEN-SUP-001', name: 'David Adeleke', accessCode: 'SUP-1010' },
        { staffId: 'GEN-SUP-002', name: 'Amaka Okonkwo', accessCode: 'SUP-2020' },
        { staffId: 'GEN-SUP-003', name: 'Tunde Bakare', accessCode: 'SUP-3030' },
        { staffId: 'GEN-SUP-004', name: 'Chioma Eze', accessCode: 'SUP-4040' },
      ],
    },
    cycleSlug: cycle.slug,
  };
}
