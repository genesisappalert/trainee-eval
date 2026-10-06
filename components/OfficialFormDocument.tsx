'use client';

import React from 'react';

/* ── Genesis Logo Component (Official Red Swirl G) ─────────── */
export function GenesisLogo({ size = 46 }: { size?: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <img
        src="/genesis-logo.png"
        alt="Genesis Group Logo"
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </div>
  );
}

/* ── Format Date Helper ────────────────────────────────────── */
function formatDocDate(dateVal?: string | Date | null): string {
  if (!dateVal) return new Date().toLocaleDateString('en-GB');
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateVal);
  }
}

/* ══════════════════════════════════════════════════════════════
   OFFICIAL SUPERVISOR FORM TEMPLATE (Pages 1 & 2)
   ══════════════════════════════════════════════════════════════ */
export interface OfficialSupervisorDocProps {
  data: {
    supervisorName?: string;
    traineeName?: string;
    staffId?: string;
    appraisalDate?: string;
    department?: string;
    location?: string;
    answers?: Record<string, any>;
    signatureDataUrl?: string | null;
  };
  isInteractive?: boolean;
  onAnswerChange?: (fieldId: string, value: any) => void;
  onSignatureClick?: () => void;
}

export function OfficialSupervisorDocument({
  data,
  isInteractive = false,
  onAnswerChange,
  onSignatureClick,
}: OfficialSupervisorDocProps) {
  const a = data.answers || {};
  const formattedDate = formatDocDate(data.appraisalDate || a.s_signature_date);

  const update = (id: string, val: any) => {
    if (onAnswerChange) onAnswerChange(id, val);
  };

  const supervisorRatingQuestions = [
    {
      id: 's_r1',
      cid: 's_c1',
      text: 'To what extent does the trainee independently meet key performance indicators (KPIs), operational goals, and deadlines without requiring constant supervision?',
    },
    {
      id: 's_r2',
      cid: 's_c2',
      text: 'To what extent does the trainee demonstrates required functional knowledge, technical skill, and accuracy in daily operations.',
    },
    {
      id: 's_r3',
      cid: 's_c3',
      text: 'To what extent does the trainee handle ambiguous situations proactively and resolves operational challenges without waiting for explicit instruction.',
    },
    {
      id: 's_r4',
      cid: 's_c4',
      text: 'To what extent does the trainee identify operational inefficiencies and suggests or implements workflow improvements within the department.',
    },
    {
      id: 's_r5',
      cid: 's_c5',
      text: 'To what extent does the trainee collaborate effectively with peers, cross-functional units, and subordinates while building productive working relationships.',
    },
    {
      id: 's_r6',
      cid: 's_c6',
      text: 'To what extent does the trainee accept constructive criticism, demonstrates agility, and successfully applies coaching to modify performance or behavior.',
    },
    {
      id: 's_r7',
      cid: 's_c7',
      text: 'To what extent does the trainee exhibit ownership, accountability, and the leadership potential needed to step into higher-level supervisory or management responsibilities over the next 6–12 months.',
    },
  ];

  const overallOptions = [
    { id: 'exceptional', label: 'Exceptional' },
    { id: 'exceeds_expectations', label: 'Exceeds Expectation' },
    { id: 'meets_expectations', label: 'Meets Expectation' },
    { id: 'needs_development', label: 'Needs Development' },
    { id: 'unsatisfactory', label: 'Unsatisfactory' },
  ];

  return (
    <div className="official-document-container">
      {/* ── PAGE 1 OF 3 ───────────────────────────────────────── */}
      <div className="official-doc-page page-1">
        {/* Header Table */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-logo-cell">
                <GenesisLogo size={42} />
              </td>
              <td className="doc-title-cell">
                <div className="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
                <div className="doc-header-subtitle">PERIODIC PERFORMANCE APPRAISAL-SUPERVISOR</div>
              </td>
              <td className="doc-meta-cell">
                <div className="doc-meta-top">
                  <div>Date</div>
                  <div>({formattedDate})</div>
                </div>
                <div className="doc-meta-bottom">Page: 1 / 3</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Identity Table */}
        <table className="doc-identity-table">
          <tbody>
            <tr>
              <td className="doc-label-cell" style={{ width: '22%' }}>Supervisor Name</td>
              <td className="doc-val-cell" style={{ width: '28%' }}>
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.s_signature_name || data.supervisorName || ''}
                    onChange={(e) => update('s_signature_name', e.target.value)}
                    placeholder="Enter Supervisor Name"
                  />
                ) : (
                  a.s_signature_name || data.supervisorName || '—'
                )}
              </td>
              <td className="doc-label-cell" style={{ width: '22%' }}>Trainee Name:</td>
              <td className="doc-val-cell" style={{ width: '28%' }}>
                {data.traineeName || '—'}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Staff ID:</td>
              <td className="doc-val-cell">{data.staffId || '—'}</td>
              <td className="doc-label-cell">Date of Appraisal:</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="date"
                    className="doc-input"
                    value={a.s_signature_date || ''}
                    onChange={(e) => update('s_signature_date', e.target.value)}
                  />
                ) : (
                  formattedDate
                )}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Department/Business Unit:</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.s_department || data.department || ''}
                    onChange={(e) => update('s_department', e.target.value)}
                    placeholder="e.g. Finance & Accounts"
                  />
                ) : (
                  a.s_department || data.department || '—'
                )}
              </td>
              <td className="doc-label-cell">Location:</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.s_location || data.location || ''}
                    onChange={(e) => update('s_location', e.target.value)}
                    placeholder="e.g. Port Harcourt HQ"
                  />
                ) : (
                  a.s_location || data.location || '—'
                )}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Purpose</td>
              <td className="doc-val-cell" colSpan={3} style={{ fontSize: 11.5, textAlign: 'justify', lineHeight: 1.45 }}>
                To assess the trainee&apos;s performance, capability, application of knowledge, behavioural competencies, and leadership potential, while identifying development needs and readiness for increased responsibility.
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rating Scale Section */}
        <div className="doc-section-heading">Rating Scale</div>
        <table className="doc-scale-table">
          <thead>
            <tr>
              <th style={{ width: '35%', textAlign: 'left' }}>Rating</th>
              <th style={{ width: '65%', textAlign: 'left' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="doc-bg-gray doc-bold">5 – Exceptional</td>
              <td className="doc-bold">Consistently surpasses role requirements; strong leadership trajectory.</td>
            </tr>
            <tr>
              <td className="doc-bold">4 – Exceeds Expectations</td>
              <td className="doc-bold">Frequently surpasses role requirements and delivers strong result.</td>
            </tr>
            <tr>
              <td className="doc-bg-gray doc-bold">3 – Meets Expectations</td>
              <td className="doc-bold">Solid, reliable performance; meets operational requirements.</td>
            </tr>
            <tr>
              <td className="doc-bold">2 – Needs Development</td>
              <td className="doc-bold">Inconsistent performance; requires targeted support and coaching in key areas.</td>
            </tr>
            <tr>
              <td className="doc-bg-gray doc-bold">1 – Unsatisfactory</td>
              <td className="doc-bold">Fails to meet core requirements; structured performance improvement plan required.</td>
            </tr>
          </tbody>
        </table>

        {/* Assessment Area Table */}
        <table className="doc-grid-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th style={{ width: '52%', textAlign: 'left' }}>Assessment Area</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Rating (1–4)</th>
              <th style={{ width: '33%', textAlign: 'left' }}>Supervisor Comments</th>
            </tr>
          </thead>
          <tbody>
            {supervisorRatingQuestions.map((q) => (
              <tr key={q.id}>
                <td style={{ fontSize: 11.5, lineHeight: 1.35 }}>{q.text}</td>
                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  {isInteractive ? (
                    <select
                      className="doc-select"
                      value={a[q.id] || ''}
                      onChange={(e) => update(q.id, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="5">5</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </select>
                  ) : (
                    <span className="doc-bold" style={{ fontSize: 13 }}>{a[q.id] || '—'}</span>
                  )}
                </td>
                <td style={{ verticalAlign: 'top', padding: 4 }}>
                  {isInteractive ? (
                    <textarea
                      className="doc-textarea"
                      rows={2}
                      value={a[q.cid] || ''}
                      onChange={(e) => update(q.cid, e.target.value)}
                      placeholder="Supervisor comments..."
                    />
                  ) : (
                    <span style={{ fontSize: 11 }}>{a[q.cid] || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="doc-page-footer-num">1</div>
      </div>

      {/* ── PAGE 2 OF 3 ───────────────────────────────────────── */}
      <div className="official-doc-page page-2">
        {/* Header Table */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-logo-cell">
                <GenesisLogo size={42} />
              </td>
              <td className="doc-title-cell">
                <div className="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
                <div className="doc-header-subtitle">PERIODIC PERFORMANCE APPRAISAL-SUPERVISOR</div>
              </td>
              <td className="doc-meta-cell">
                <div className="doc-meta-top">
                  <div>Date</div>
                  <div>({formattedDate})</div>
                </div>
                <div className="doc-meta-bottom">Page: 2 / 3</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Question 1: Key Strengths */}
        <div className="doc-question-block" style={{ marginTop: 24 }}>
          <div className="doc-question-title">1. What are the trainee&apos;s three key strengths?</div>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>a.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.s_q1a || ''}
                onChange={(e) => update('s_q1a', e.target.value)}
                placeholder="Strength 1..."
              />
            ) : (
              <div className="doc-line-text">{a.s_q1a || ''}</div>
            )}
          </div>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>b.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.s_q1b || ''}
                onChange={(e) => update('s_q1b', e.target.value)}
                placeholder="Strength 2..."
              />
            ) : (
              <div className="doc-line-text">{a.s_q1b || ''}</div>
            )}
          </div>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>c.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.s_q1c || ''}
                onChange={(e) => update('s_q1c', e.target.value)}
                placeholder="Strength 3..."
              />
            ) : (
              <div className="doc-line-text">{a.s_q1c || ''}</div>
            )}
          </div>
        </div>

        {/* Question 2: Learning & Development Resources */}
        <div className="doc-question-block" style={{ marginTop: 28 }}>
          <div className="doc-question-title">
            2. What specific training, skill-building, or mentoring resources should the Learning & Development team provide over the next quarter to support this trainee?
          </div>
          {isInteractive ? (
            <textarea
              className="doc-multi-line-textarea"
              rows={3}
              value={a.s_q2 || ''}
              onChange={(e) => update('s_q2', e.target.value)}
              placeholder="State training and development recommendations..."
            />
          ) : (
            <div className="doc-three-lines">
              <div className="doc-single-line">{a.s_q2 || ''}</div>
              <div className="doc-single-line"></div>
              <div className="doc-single-line"></div>
            </div>
          )}
        </div>

        {/* Question 3: Overall Performance Rating */}
        <div className="doc-question-block" style={{ marginTop: 28 }}>
          <div className="doc-question-title">
            3. Overall, how would you rate the performance of your trainee so far?
          </div>
          <div className="doc-checkbox-list">
            {overallOptions.map((opt) => {
              const checked = a.s_overall === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`doc-checkbox-row ${isInteractive ? 'clickable' : ''}`}
                  onClick={() => isInteractive && update('s_overall', opt.id)}
                >
                  <span className="doc-checkbox-box">{checked ? '☑' : '☐'}</span>
                  <span className="doc-checkbox-label">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supervisor Signature Row */}
        <div className="doc-signature-block">
          <div className="doc-signature-left">
            <span className="doc-bold">Supervisor Signature:</span>
            <div
              className={`doc-signature-line ${isInteractive ? 'clickable' : ''}`}
              onClick={onSignatureClick}
            >
              {data.signatureDataUrl || a.s_signature_svg ? (
                <img
                  src={data.signatureDataUrl || a.s_signature_svg}
                  alt="Supervisor Signature"
                  className="doc-signature-img"
                />
              ) : (
                isInteractive && <span className="doc-sig-placeholder">Click to draw signature</span>
              )}
            </div>
          </div>
          <div className="doc-signature-right">
            <span className="doc-bold">Date:</span>
            <div className="doc-date-line">
              {formattedDate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OFFICIAL TRAINEE FORM TEMPLATE (Pages 1 & 2)
   ══════════════════════════════════════════════════════════════ */
export interface OfficialTraineeDocProps {
  data: {
    traineeName?: string;
    supervisorName?: string;
    staffId?: string;
    appraisalDate?: string;
    department?: string;
    location?: string;
    answers?: Record<string, any>;
    signatureDataUrl?: string | null;
  };
  isInteractive?: boolean;
  onAnswerChange?: (fieldId: string, value: any) => void;
  onSignatureClick?: () => void;
}

export function OfficialTraineeDocument({
  data,
  isInteractive = false,
  onAnswerChange,
  onSignatureClick,
}: OfficialTraineeDocProps) {
  const a = data.answers || {};
  const formattedDate = formatDocDate(data.appraisalDate || a.t_signature_date);

  const update = (id: string, val: any) => {
    if (onAnswerChange) onAnswerChange(id, val);
  };

  const traineeRatingQuestions = [
    {
      id: 't_r1',
      cid: 't_c1',
      text: 'My onboarding and transition into my current team were smooth, and I received sufficient support to understand my role\'s scope.',
    },
    {
      id: 't_r2',
      cid: 't_c2',
      text: 'I have a clear understanding of my daily KPIs, department deliverables, and how my work contributes to overall business goals.',
    },
    {
      id: 't_r3',
      cid: 't_c3',
      text: 'The foundational training received during the Management Trainee classroom/induction modules prepared me effectively for my post-deployment duties.',
    },
    {
      id: 't_r4',
      cid: 't_c4',
      text: 'How would you rate your overall experience working in your assigned unit and with your line manager over the past months on the job?',
    },
    {
      id: 't_r5',
      cid: 't_c5',
      text: 'I feel confident handling routine operational challenges and making day-to-day decisions independently without waiting for step-by-step supervision.',
    },
  ];

  const overallOptions = [
    { id: 'excellent', label: 'Excellent' },
    { id: 'very_good', label: 'Very Good' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Satisfactory' },
    { id: 'poor', label: 'Needs Improvement' },
  ];

  return (
    <div className="official-document-container">
      {/* ── PAGE 1 OF 3 ───────────────────────────────────────── */}
      <div className="official-doc-page page-1">
        {/* Header Table */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-logo-cell">
                <GenesisLogo size={42} />
              </td>
              <td className="doc-title-cell">
                <div className="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
                <div className="doc-header-subtitle">PERIODIC PERFORMANCE APPRAISAL-TRAINEE</div>
              </td>
              <td className="doc-meta-cell">
                <div className="doc-meta-top">
                  <div>Date</div>
                  <div>({formattedDate})</div>
                </div>
                <div className="doc-meta-bottom">Page: 1 / 3</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Identity Table */}
        <table className="doc-identity-table">
          <tbody>
            <tr>
              <td className="doc-label-cell" style={{ width: '22%' }}>Trainee Name:</td>
              <td className="doc-val-cell" style={{ width: '28%' }}>
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.t_name || data.traineeName || ''}
                    onChange={(e) => update('t_name', e.target.value)}
                    placeholder="Enter Full Name"
                  />
                ) : (
                  a.t_name || data.traineeName || '—'
                )}
              </td>
              <td className="doc-label-cell" style={{ width: '22%' }}>Direct Supervisor:</td>
              <td className="doc-val-cell" style={{ width: '28%' }}>
                {data.supervisorName || a.t_supervisor_other || '—'}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Staff ID:</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.t_staff_id || data.staffId || ''}
                    onChange={(e) => update('t_staff_id', e.target.value)}
                    placeholder="GEN-MTP-..."
                  />
                ) : (
                  a.t_staff_id || data.staffId || '—'
                )}
              </td>
              <td className="doc-label-cell">Date of Appraisal:</td>
              <td className="doc-val-cell">
                {formattedDate}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Location:</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.t_location || data.location || ''}
                    onChange={(e) => update('t_location', e.target.value)}
                    placeholder="Location"
                  />
                ) : (
                  a.t_location || data.location || '—'
                )}
              </td>
              <td className="doc-label-cell">Department/Business Unit</td>
              <td className="doc-val-cell">
                {isInteractive ? (
                  <input
                    type="text"
                    className="doc-input"
                    value={a.t_department || data.department || ''}
                    onChange={(e) => update('t_department', e.target.value)}
                    placeholder="Department"
                  />
                ) : (
                  a.t_department || data.department || '—'
                )}
              </td>
            </tr>
            <tr>
              <td className="doc-label-cell">Purpose</td>
              <td className="doc-val-cell" colSpan={3} style={{ fontSize: 11.5, textAlign: 'justify', lineHeight: 1.45 }}>
                As part of our commitment to your growth and evaluating our overall onboarding experience, HR invites you to complete this self-assessment. This form helps us understand your transition into your unit, measure the direct impact you have delivered, evaluate training effectiveness, and identify key areas where we can support your career trajectory.
              </td>
            </tr>
          </tbody>
        </table>

        {/* Rating Scale Section */}
        <div className="doc-section-heading">Rating Scale</div>
        <table className="doc-scale-table" style={{ maxWidth: 240 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="doc-bg-gray doc-bold">5 – Strongly Agree</td></tr>
            <tr><td className="doc-bold">4 – Agree</td></tr>
            <tr><td className="doc-bg-gray doc-bold">3 – Neutral</td></tr>
            <tr><td className="doc-bold">2 – Disagree</td></tr>
            <tr><td className="doc-bg-gray doc-bold">1 – Strongly Agree</td></tr>
          </tbody>
        </table>

        {/* Assessment Area Table */}
        <table className="doc-grid-table" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th style={{ width: '52%', textAlign: 'left' }}>Assessment Area</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Rating (1–5)</th>
              <th style={{ width: '33%', textAlign: 'left' }}>Trainee Comment & Observation</th>
            </tr>
          </thead>
          <tbody>
            {traineeRatingQuestions.map((q) => (
              <tr key={q.id}>
                <td style={{ fontSize: 11.5, lineHeight: 1.35 }}>{q.text}</td>
                <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                  {isInteractive ? (
                    <select
                      className="doc-select"
                      value={a[q.id] || ''}
                      onChange={(e) => update(q.id, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="5">5</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </select>
                  ) : (
                    <span className="doc-bold" style={{ fontSize: 13 }}>{a[q.id] || '—'}</span>
                  )}
                </td>
                <td style={{ verticalAlign: 'top', padding: 4 }}>
                  {isInteractive ? (
                    <textarea
                      className="doc-textarea"
                      rows={2}
                      value={a[q.cid] || ''}
                      onChange={(e) => update(q.cid, e.target.value)}
                      placeholder="Comment & observation..."
                    />
                  ) : (
                    <span style={{ fontSize: 11 }}>{a[q.cid] || '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, fontSize: 11.5, fontStyle: 'italic' }}>
          1. Highlight 2–3 specific tasks, projects, or operational duties you have led or completed in the past 90 days that delivered measurable value to your unit.
        </div>

        <div className="doc-page-footer-num">1</div>
      </div>

      {/* ── PAGE 2 OF 3 ───────────────────────────────────────── */}
      <div className="official-doc-page page-2">
        {/* Header Table */}
        <table className="doc-header-table">
          <tbody>
            <tr>
              <td className="doc-logo-cell">
                <GenesisLogo size={42} />
              </td>
              <td className="doc-title-cell">
                <div className="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
                <div className="doc-header-subtitle">PERIODIC PERFORMANCE APPRAISAL-TRAINEE</div>
              </td>
              <td className="doc-meta-cell">
                <div className="doc-meta-top">
                  <div>Date</div>
                  <div>({formattedDate})</div>
                </div>
                <div className="doc-meta-bottom">Page: 2 / 3</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Question 1 subrows (a, b, c) */}
        <div className="doc-question-block" style={{ marginTop: 20 }}>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>a.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.t_q1a || ''}
                onChange={(e) => update('t_q1a', e.target.value)}
                placeholder="Task/Project 1..."
              />
            ) : (
              <div className="doc-line-text">{a.t_q1a || ''}</div>
            )}
          </div>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>b.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.t_q1b || ''}
                onChange={(e) => update('t_q1b', e.target.value)}
                placeholder="Task/Project 2..."
              />
            ) : (
              <div className="doc-line-text">{a.t_q1b || ''}</div>
            )}
          </div>
          <div className="doc-lined-subrow">
            <span className="doc-bold" style={{ minWidth: 20 }}>c.</span>
            {isInteractive ? (
              <input
                type="text"
                className="doc-line-input"
                value={a.t_q1c || ''}
                onChange={(e) => update('t_q1c', e.target.value)}
                placeholder="Task/Project 3 (optional)..."
              />
            ) : (
              <div className="doc-line-text">{a.t_q1c || ''}</div>
            )}
          </div>
        </div>

        {/* Question 2: Workflow changes */}
        <div className="doc-question-block" style={{ marginTop: 24 }}>
          <div className="doc-question-title">
            2. Have you identified or implemented any workflow changes, cost-saving initiatives, or operational improvements since joining your department?
          </div>
          {isInteractive ? (
            <textarea
              className="doc-multi-line-textarea"
              rows={2}
              value={a.t_q2 || ''}
              onChange={(e) => update('t_q2', e.target.value)}
              placeholder="Describe workflow improvements..."
            />
          ) : (
            <div className="doc-two-lines">
              <div className="doc-single-line">{a.t_q2 || ''}</div>
              <div className="doc-single-line"></div>
            </div>
          )}
        </div>

        {/* Question 3: Learning experience */}
        <div className="doc-question-block" style={{ marginTop: 24 }}>
          <div className="doc-question-title">
            3. What can your supervisor or business unit do differently to improve your learning experience?
          </div>
          {isInteractive ? (
            <textarea
              className="doc-multi-line-textarea"
              rows={2}
              value={a.t_q3 || ''}
              onChange={(e) => update('t_q3', e.target.value)}
              placeholder="Your feedback..."
            />
          ) : (
            <div className="doc-two-lines">
              <div className="doc-single-line">{a.t_q3 || ''}</div>
              <div className="doc-single-line"></div>
            </div>
          )}
        </div>

        {/* Question 4: Additional resources */}
        <div className="doc-question-block" style={{ marginTop: 24 }}>
          <div className="doc-question-title">
            4. What additional resources, cross-functional exposure, or leadership opportunities would help accelerate your readiness for managerial roles in the next 6–12 months?
          </div>
          {isInteractive ? (
            <textarea
              className="doc-multi-line-textarea"
              rows={2}
              value={a.t_q4 || ''}
              onChange={(e) => update('t_q4', e.target.value)}
              placeholder="Leadership and resources needed..."
            />
          ) : (
            <div className="doc-two-lines">
              <div className="doc-single-line">{a.t_q4 || ''}</div>
              <div className="doc-single-line"></div>
            </div>
          )}
        </div>

        {/* Question 5: Overall rating */}
        <div className="doc-question-block" style={{ marginTop: 24 }}>
          <div className="doc-question-title">
            5. Overall, how would you rate your MTP experience so far?
          </div>
          <div className="doc-checkbox-list">
            {overallOptions.map((opt) => {
              const checked = a.t_overall === opt.id;
              return (
                <div
                  key={opt.id}
                  className={`doc-checkbox-row ${isInteractive ? 'clickable' : ''}`}
                  onClick={() => isInteractive && update('t_overall', opt.id)}
                >
                  <span className="doc-checkbox-box">{checked ? '☑' : '☐'}</span>
                  <span className="doc-checkbox-label">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trainee Signature Row */}
        <div className="doc-signature-block">
          <div className="doc-signature-left">
            <span className="doc-bold">Management Trainee Signature:</span>
            <div
              className={`doc-signature-line ${isInteractive ? 'clickable' : ''}`}
              onClick={onSignatureClick}
            >
              {data.signatureDataUrl || a.t_signature_svg ? (
                <img
                  src={data.signatureDataUrl || a.t_signature_svg}
                  alt="Management Trainee Signature"
                  className="doc-signature-img"
                />
              ) : (
                isInteractive && <span className="doc-sig-placeholder">Click to draw signature</span>
              )}
            </div>
          </div>
          <div className="doc-signature-right">
            <span className="doc-bold">Date:</span>
            <div className="doc-date-line">
              {formattedDate}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
