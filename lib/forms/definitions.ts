/* ============================================================
   Form Version Seed Data — TRAINEE v1 & SUPERVISOR v1
   PRD Sections 8.1, 8.2, Appendix B, Appendix C
   Corrections from 8.3 are applied
   ============================================================ */

import { IFormField } from '../models';

/* ── Trainee Form v1 ───────────────────────────────────────── */
export const TRAINEE_V1_TITLE = 'MANAGEMENT TRAINEE PROGRAMME (MTP) — PERIODIC PERFORMANCE ASSESSMENT — TRAINEE';

export const TRAINEE_V1_PURPOSE =
  'As part of our commitment to your growth and evaluating our overall onboarding experience, Genesis Academy invites you to complete this self-assessment. This form helps us understand your transition into your unit, measure the direct impact you have delivered, evaluate training effectiveness, and identify key areas where we can support your career trajectory.';

export const TRAINEE_RATING_SCALE = [
  { value: 5, label: 'Strongly Agree' },
  { value: 4, label: 'Agree' },
  { value: 3, label: 'Neutral' },
  { value: 2, label: 'Disagree' },
  { value: 1, label: 'Strongly Disagree' }, // corrected from source "Strongly Agree"
];

export const TRAINEE_OVERALL_OPTIONS = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'very_good', label: 'Very Good' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },      // rebalanced, pending HR approval
  { value: 'poor', label: 'Poor' },      // rebalanced, pending HR approval
];

export const TRAINEE_V1_FIELDS: IFormField[] = [
  /* ── Identity Fields ─────────────────────────────────────── */
  {
    id: 't_name',
    label: 'Trainee Name',
    type: 'text',
    required: true,
    maxLength: 60,
    confidential: false,
    placeholder: '{t_name}',
    helperText: 'Enter your full name as it appears on your ID card.',
  },
  {
    id: 't_staff_id',
    label: 'Staff ID',
    type: 'text',
    required: true,
    maxLength: 20,
    confidential: false,
    placeholder: '{t_staff_id}',
    helperText: 'Use your staff ID exactly as on your ID card.',
  },
  {
    id: 't_email',
    label: 'Work Email',
    type: 'email',
    required: true,
    maxLength: 120,
    confidential: false, // HR only (not printed)
    placeholder: 'not printed',
    helperText: 'We\'ll email you a private link to continue later.',
  },
  {
    id: 't_location',
    label: 'Location',
    type: 'text',
    required: true,
    maxLength: 40,
    confidential: false,
    placeholder: '{t_location}',
  },
  {
    id: 't_department',
    label: 'Department & Business Unit',
    type: 'text',
    required: true,
    maxLength: 60,
    confidential: false,
    placeholder: '{t_department}',
  },
  {
    id: 't_supervisor',
    label: 'Direct Supervisor',
    type: 'select',
    required: true,
    confidential: false,
    placeholder: '{t_supervisor_name}',
    helperText: 'Choose your direct line manager. Not listed? Pick "My supervisor isn\'t listed" and HR will sort it out.',
  },

  /* ── Rating Items ────────────────────────────────────────── */
  {
    id: 't_r1',
    label: 'My onboarding and transition into my current team were smooth, and I received sufficient support to understand my role\'s scope.',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{t_r1}',
  },
  {
    id: 't_c1',
    label: 'Comment on onboarding',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{t_c1}',
    linkedTo: 't_r1',
  },
  {
    id: 't_r2',
    label: 'I have a clear understanding of my daily KPIs, department deliverables, and how my work contributes to overall business goals.',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{t_r2}',
  },
  {
    id: 't_c2',
    label: 'Comment on KPIs',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{t_c2}',
    linkedTo: 't_r2',
  },
  {
    id: 't_r3',
    label: 'The foundational training received during the Management Trainee classroom/induction modules prepared me effectively for my post-deployment duties.',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{t_r3}',
  },
  {
    id: 't_c3',
    label: 'Comment on training',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{t_c3}',
    linkedTo: 't_r3',
  },
  {
    id: 't_r4',
    label: 'My overall experience working in my assigned unit and with my line manager over the past months on the job has been positive.',
    type: 'rating',
    required: true,
    confidential: false, // HR only
    placeholder: '{t_r4}',
  },
  {
    id: 't_c4',
    label: 'Comment on experience',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false, // HR only
    placeholder: '{t_c4}',
    linkedTo: 't_r4',
  },
  {
    id: 't_r5',
    label: 'I feel confident handling routine operational challenges and making day-to-day decisions independently without waiting for step-by-step supervision.',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{t_r5}',
  },
  {
    id: 't_c5',
    label: 'Comment on independence',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{t_c5}',
    linkedTo: 't_r5',
  },

  /* ── Open Questions ──────────────────────────────────────── */
  {
    id: 't_q1a',
    label: 'Task/Project 1',
    type: 'longtext',
    required: true,
    maxLength: 250,
    confidential: false,
    placeholder: '{t_q1a}',
    helperText: 'Highlight 2–3 specific tasks, projects, or operational duties you have led or completed in the past 90 days that delivered measurable value to your unit.',
  },
  {
    id: 't_q1b',
    label: 'Task/Project 2',
    type: 'longtext',
    required: true,
    maxLength: 250,
    confidential: false,
    placeholder: '{t_q1b}',
  },
  {
    id: 't_q1c',
    label: 'Task/Project 3 (optional)',
    type: 'longtext',
    required: false,
    maxLength: 250,
    confidential: false,
    placeholder: '{t_q1c}',
  },
  {
    id: 't_q2',
    label: 'Have you identified or implemented any workflow changes, cost-saving initiatives, or operational improvements since joining your department?',
    type: 'longtext',
    required: true,
    maxLength: 500,
    confidential: false,
    placeholder: '{t_q2}',
  },
  {
    id: 't_q3',
    label: 'What can your supervisor or business unit do differently to improve your learning experience?',
    type: 'longtext',
    required: true,
    maxLength: 500,
    confidential: false, // HR only
    placeholder: '{t_q3}',
    helperText: 'Seen only by HR, not your supervisor.',
  },
  {
    id: 't_q4',
    label: 'What additional resources, cross-functional exposure, or leadership opportunities would help accelerate your readiness for managerial roles in the next 6–12 months?',
    type: 'longtext',
    required: true,
    maxLength: 500,
    confidential: false,
    placeholder: '{t_q4}',
  },

  /* ── Overall Rating ──────────────────────────────────────── */
  {
    id: 't_overall',
    label: 'Overall, how would you rate your MTP experience so far?',
    type: 'overall',
    required: true,
    confidential: false,
    options: TRAINEE_OVERALL_OPTIONS,
    placeholder: '{t_overall}',
  },

  /* ── Signature ───────────────────────────────────────────── */
  {
    id: 't_signature',
    label: 'Management Trainee Signature',
    type: 'signature',
    required: true,
    confidential: false,
    placeholder: '{%t_sig}',
  },
];

/* ── Trainee form steps ────────────────────────────────────── */
export const TRAINEE_STEPS = [
  {
    id: 'identity',
    title: 'Your Details',
    subtitle: 'Tell us who you are',
    fields: ['t_name', 't_staff_id', 't_email', 't_location', 't_department', 't_supervisor'],
  },
  {
    id: 'ratings',
    title: 'Self-Assessment',
    subtitle: 'Rate your experience on a scale of 1–5',
    fields: ['t_r1', 't_c1', 't_r2', 't_c2', 't_r3', 't_c3', 't_r4', 't_c4', 't_r5', 't_c5'],
  },
  {
    id: 'questions',
    title: 'Open Questions',
    subtitle: 'Share your experiences and suggestions',
    fields: ['t_q1a', 't_q1b', 't_q1c', 't_q2', 't_q3', 't_q4'],
  },
  {
    id: 'overall',
    title: 'Overall Rating',
    subtitle: 'Rate your overall MTP experience',
    fields: ['t_overall'],
  },
  {
    id: 'review',
    title: 'Review',
    subtitle: 'Review all your answers before submitting',
    fields: [],
  },
  {
    id: 'signature',
    title: 'Sign & Submit',
    subtitle: 'Sign and submit your assessment',
    fields: ['t_signature'],
  },
];

/* ── Supervisor Form v1 ────────────────────────────────────── */
export const SUPERVISOR_V1_TITLE = 'MANAGEMENT TRAINEE PROGRAMME (MTP) — PERIODIC PERFORMANCE ASSESSMENT — SUPERVISOR';

export const SUPERVISOR_V1_PURPOSE =
  'To assess the trainee\'s performance, capability, application of knowledge, behavioural competencies, and leadership potential, while identifying development needs and readiness for increased responsibility.';

export const SUPERVISOR_RATING_SCALE = [
  { value: 5, label: 'Exceptional', description: 'Consistently surpasses role requirements; strong leadership trajectory.' },
  { value: 4, label: 'Exceeds Expectations', description: 'Frequently surpasses role requirements and delivers strong results.' },
  { value: 3, label: 'Meets Expectations', description: 'Solid, reliable performance; meets operational requirements.' },
  { value: 2, label: 'Needs Development', description: 'Inconsistent performance; requires targeted support and coaching in key areas.' },
  { value: 1, label: 'Unsatisfactory', description: 'Fails to meet core requirements; structured performance improvement plan required.' },
];

export const SUPERVISOR_OVERALL_OPTIONS = [
  { value: 'exceptional', label: 'Exceptional' },
  { value: 'exceeds_expectations', label: 'Exceeds Expectations' },
  { value: 'meets_expectations', label: 'Meets Expectations' },
  { value: 'needs_development', label: 'Needs Development' },
  { value: 'unsatisfactory', label: 'Unsatisfactory' },
];

export const SUPERVISOR_V1_FIELDS: IFormField[] = [
  /* ── Auto-populated Identity ─────────────────────────────── */
  {
    id: 's_name',
    label: 'Supervisor Name',
    type: 'auto',
    required: false,
    confidential: false,
    placeholder: '{s_name}',
  },
  {
    id: 's_trainee_name',
    label: 'Trainee Name',
    type: 'auto',
    required: false,
    confidential: false,
    placeholder: '{s_trainee_name}',
  },
  {
    id: 's_staff_id',
    label: 'Trainee Staff ID',
    type: 'auto',
    required: false,
    confidential: false,
    placeholder: '{s_staff_id}',
  },
  {
    id: 's_department',
    label: 'Department & Business Unit',
    type: 'text',
    required: true,
    maxLength: 60,
    confidential: false,
    placeholder: '{s_department}',
  },
  {
    id: 's_location',
    label: 'Location',
    type: 'text',
    required: true,
    maxLength: 40,
    confidential: false,
    placeholder: '{s_location}',
  },

  /* ── Rating Items ────────────────────────────────────────── */
  {
    id: 's_r1',
    label: 'To what extent does the trainee independently meet key performance indicators (KPIs), operational goals, and deadlines without requiring constant supervision?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r1}',
  },
  {
    id: 's_c1',
    label: 'Comment on KPI performance',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c1}',
    linkedTo: 's_r1',
  },
  {
    id: 's_r2',
    label: 'To what extent does the trainee demonstrate required functional knowledge, technical skill, and accuracy in daily operations?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r2}',
  },
  {
    id: 's_c2',
    label: 'Comment on functional knowledge',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c2}',
    linkedTo: 's_r2',
  },
  {
    id: 's_r3',
    label: 'To what extent does the trainee handle ambiguous situations proactively and resolve operational challenges without waiting for explicit instruction?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r3}',
  },
  {
    id: 's_c3',
    label: 'Comment on proactiveness',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c3}',
    linkedTo: 's_r3',
  },
  {
    id: 's_r4',
    label: 'To what extent does the trainee identify operational inefficiencies and suggest or implement workflow improvements within the department?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r4}',
  },
  {
    id: 's_c4',
    label: 'Comment on improvement initiatives',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c4}',
    linkedTo: 's_r4',
  },
  {
    id: 's_r5',
    label: 'To what extent does the trainee collaborate effectively with peers, cross-functional units, and subordinates while building productive working relationships?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r5}',
    options: [
      ...SUPERVISOR_RATING_SCALE.map(s => ({ value: String(s.value), label: s.label })),
      { value: 'na', label: 'N/A' },
    ],
  },
  {
    id: 's_c5',
    label: 'Comment on collaboration',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c5}',
    linkedTo: 's_r5',
  },
  {
    id: 's_r6',
    label: 'To what extent does the trainee accept constructive criticism, demonstrate agility, and successfully apply coaching to modify performance or behaviour?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r6}',
  },
  {
    id: 's_c6',
    label: 'Comment on coachability',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c6}',
    linkedTo: 's_r6',
  },
  {
    id: 's_r7',
    label: 'To what extent does the trainee exhibit ownership, accountability, and the leadership potential needed to step into higher-level supervisory or management responsibilities over the next 6–12 months?',
    type: 'rating',
    required: true,
    confidential: false,
    placeholder: '{s_r7}',
  },
  {
    id: 's_c7',
    label: 'Comment on leadership potential',
    type: 'comment',
    required: false,
    maxLength: 200,
    confidential: false,
    placeholder: '{s_c7}',
    linkedTo: 's_r7',
  },

  /* ── Open Questions ──────────────────────────────────────── */
  {
    id: 's_q1a',
    label: 'Key Strength 1',
    type: 'longtext',
    required: true,
    maxLength: 150,
    confidential: false,
    placeholder: '{s_q1a}',
    helperText: 'What are the trainee\'s three key strengths?',
  },
  {
    id: 's_q1b',
    label: 'Key Strength 2',
    type: 'longtext',
    required: true,
    maxLength: 150,
    confidential: false,
    placeholder: '{s_q1b}',
  },
  {
    id: 's_q1c',
    label: 'Key Strength 3',
    type: 'longtext',
    required: true,
    maxLength: 150,
    confidential: false,
    placeholder: '{s_q1c}',
  },
  {
    id: 's_q_dev',
    label: 'What are the trainee\'s key areas for improvement?',
    type: 'longtext',
    required: true,
    maxLength: 400,
    confidential: false,
    placeholder: '{s_q_dev}',
  },
  {
    id: 's_q2',
    label: 'What specific training, skill-building, or mentoring resources should the Learning & Development team provide over the next quarter to support this trainee?',
    type: 'longtext',
    required: true,
    maxLength: 500,
    confidential: false,
    placeholder: '{s_q2}',
  },

  /* ── Overall Rating ──────────────────────────────────────── */
  {
    id: 's_overall',
    label: 'Overall, how would you rate the performance of your trainee so far?',
    type: 'overall',
    required: true,
    confidential: false,
    options: SUPERVISOR_OVERALL_OPTIONS,
    placeholder: '{s_overall}',
  },

  /* ── Signature ───────────────────────────────────────────── */
  {
    id: 's_signature',
    label: 'Supervisor Signature',
    type: 'signature',
    required: true,
    confidential: false,
    placeholder: '{%s_sig}',
  },
];

/* ── Supervisor form steps ─────────────────────────────────── */
export const SUPERVISOR_STEPS = [
  {
    id: 'ratings',
    title: 'Performance Assessment',
    subtitle: 'Rate the trainee on a scale of 1–5',
    fields: ['s_r1', 's_c1', 's_r2', 's_c2', 's_r3', 's_c3', 's_r4', 's_c4', 's_r5', 's_c5', 's_r6', 's_c6', 's_r7', 's_c7'],
  },
  {
    id: 'strengths',
    title: 'Key Strengths',
    subtitle: 'Identify the trainee\'s three key strengths',
    fields: ['s_q1a', 's_q1b', 's_q1c'],
  },
  {
    id: 'development',
    title: 'Development Areas',
    subtitle: 'Identify improvement areas and L&D needs',
    fields: ['s_q_dev', 's_q2'],
  },
  {
    id: 'overall',
    title: 'Overall Rating',
    subtitle: 'Rate the trainee\'s overall performance',
    fields: ['s_overall'],
  },
  {
    id: 'review',
    title: 'Review',
    subtitle: 'Review your assessment before submitting',
    fields: [],
  },
  {
    id: 'signature',
    title: 'Sign & Submit',
    subtitle: 'Sign and submit your assessment',
    fields: ['s_signature'],
  },
];
