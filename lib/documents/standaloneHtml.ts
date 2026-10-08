import fs from 'fs';
import path from 'path';

// Cache logo base64 string
let cachedLogoBase64: string | null = null;
function getLogoDataUrl(): string {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'genesis-logo.png');
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      cachedLogoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
      return cachedLogoBase64;
    }
  } catch (e) {
    console.warn('Could not read genesis-logo.png for base64 inlining:', e);
  }
  return '/genesis-logo.png';
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function isOverallMatch(val: string | undefined, optId: string): boolean {
  if (!val) return false;
  const v = val.toLowerCase().trim();
  if (optId === 'exceptional') return v === 'exceptional' || v === 'excellent';
  if (optId === 'exceeds_expectations') return v === 'exceeds_expectations' || v === 'exceeds expectation' || v === 'very_good' || v === 'very good';
  if (optId === 'meets_expectations') return v === 'meets_expectations' || v === 'meets expectation' || v === 'good';
  if (optId === 'needs_development') return v === 'needs_development' || v === 'fair';
  if (optId === 'unsatisfactory') return v === 'unsatisfactory' || v === 'poor';
  return v === optId;
}

export const STANDALONE_OFFICIAL_CSS = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: #525659;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000;
    line-height: 1.4;
    padding: 24px 0 60px 0;
  }

  .standalone-toolbar {
    max-width: 820px;
    margin: 0 auto 24px auto;
    background: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  .standalone-toolbar-info {
    display: flex;
    flex-direction: column;
  }

  .standalone-toolbar-title {
    font-size: 14px;
    font-weight: 800;
    color: #002147;
  }

  .standalone-toolbar-sub {
    font-size: 12px;
    color: #64748b;
    margin-top: 2px;
  }

  .standalone-print-btn {
    background: #c8102e;
    color: #ffffff;
    border: none;
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 2px 8px rgba(200, 16, 46, 0.35);
  }

  .standalone-print-btn:hover {
    background: #a50d24;
  }

  /* Document layout */
  .official-document-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .official-doc-page {
    width: 100%;
    max-width: 820px;
    min-height: 1080px;
    background: #ffffff;
    padding: 36px 44px;
    margin: 0 auto 36px auto;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    border: 1px solid #cbd5e1;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000;
    position: relative;
    line-height: 1.4;
  }

  .doc-header-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    margin-bottom: 12px;
    table-layout: fixed;
  }

  .doc-logo-cell {
    width: 110px;
    border: 1px solid #000;
    text-align: center;
    vertical-align: middle;
    padding: 6px;
  }

  .doc-title-cell {
    border: 1px solid #000;
    text-align: center;
    vertical-align: middle;
    padding: 8px 10px;
  }

  .doc-header-title {
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #000;
    text-transform: uppercase;
    line-height: 1.25;
  }

  .doc-header-subtitle {
    font-size: 13.5px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #000;
    text-transform: uppercase;
    line-height: 1.25;
    margin-top: 2px;
  }

  .doc-meta-cell {
    width: 140px;
    border: 1px solid #000;
    padding: 0;
    vertical-align: top;
  }

  .doc-meta-top {
    border-bottom: 1px solid #000;
    padding: 4px;
    text-align: center;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.25;
  }

  .doc-meta-bottom {
    padding: 4px;
    text-align: center;
    font-size: 11.5px;
    font-weight: 600;
    line-height: 1.25;
  }

  .doc-identity-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    margin-bottom: 12px;
    font-size: 12px;
    table-layout: fixed;
  }

  .doc-label-cell {
    background-color: #d9d9d9 !important;
    font-weight: 700;
    border: 1px solid #000;
    padding: 5px 8px;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc-val-cell {
    background-color: #ffffff;
    border: 1px solid #000;
    padding: 5px 8px;
    color: #000;
  }

  .doc-section-heading {
    font-weight: 800;
    font-size: 14px;
    margin-top: 10px;
    margin-bottom: 6px;
    color: #000;
  }

  .doc-scale-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .doc-scale-table th {
    border: 1px solid #000;
    padding: 5px 8px;
    font-weight: 700;
    background: #fff;
    color: #000;
  }

  .doc-scale-table td {
    border: 1px solid #000;
    padding: 5px 8px;
    color: #000;
  }

  .doc-bg-gray {
    background-color: #d9d9d9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .doc-bold {
    font-weight: 700;
  }

  .doc-grid-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #000;
    font-size: 12px;
  }

  .doc-grid-table th {
    border: 1px solid #000;
    padding: 5px 8px;
    font-weight: 800;
    background: #fff;
    color: #000;
    font-size: 12.5px;
  }

  .doc-grid-table td {
    border: 1px solid #000;
    padding: 5px 8px;
    color: #000;
  }

  .doc-question-block {
    margin-top: 18px;
  }

  .doc-question-title {
    font-weight: 700;
    font-size: 12.5px;
    margin-bottom: 6px;
    line-height: 1.35;
  }

  .doc-lined-subrow {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    margin-top: 6px;
  }

  .doc-line-text {
    border-bottom: 1px solid #000;
    min-height: 22px;
    width: 100%;
    font-size: 12px;
    padding: 2px 4px;
    line-height: 1.4;
  }

  .doc-checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
  }

  .doc-checkbox-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .doc-checkbox-box {
    font-size: 16px;
    font-weight: 700;
    line-height: 1;
    user-select: none;
  }

  .doc-checkbox-label {
    font-weight: 500;
    color: #000;
  }

  .doc-signature-block {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 32px;
    padding-top: 12px;
    font-size: 12.5px;
  }

  .doc-signature-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    flex: 1;
  }

  .doc-signature-line {
    border-bottom: 1px solid #000;
    min-width: 240px;
    max-width: 340px;
    height: 38px;
    display: flex;
    align-items: flex-end;
    padding-bottom: 2px;
    position: relative;
  }

  .doc-signature-img {
    max-height: 36px;
    max-width: 220px;
    object-fit: contain;
  }

  .doc-date-line {
    border-bottom: 1px solid #000;
    min-width: 130px;
    height: 26px;
    line-height: 26px;
    text-align: center;
    font-size: 12px;
    padding: 0 8px;
  }

  .doc-page-footer-num {
    text-align: right;
    font-size: 12px;
    font-weight: 600;
    margin-top: 16px;
    padding-right: 6px;
  }

  .doc-page-divider {
    page-break-after: always !important;
    break-after: page !important;
    height: 0;
  }

  /* Native Browser Print Optimization */
  @media print {
    .no-print,
    .standalone-toolbar {
      display: none !important;
    }

    body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .official-document-container {
      background: transparent !important;
      padding: 0 !important;
    }

    .official-doc-page {
      border: none !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 10mm 12mm !important;
      max-width: 100% !important;
      page-break-after: always !important;
      break-after: page !important;
    }

    .official-doc-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    .doc-label-cell,
    .doc-bg-gray {
      background-color: #d9d9d9 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

function renderSupervisorDocumentHtml(data: any, logoDataUrl: string): string {
  const a = data.answers || {};
  const formattedDate = formatDocDate(data.appraisalDate || a.s_signature_date);

  const supervisorRatingQuestions = [
    { id: 's_r1', cid: 's_c1', text: 'To what extent does the trainee independently meet key performance indicators (KPIs), operational goals, and deadlines without requiring constant supervision?' },
    { id: 's_r2', cid: 's_c2', text: 'To what extent does the trainee demonstrates required functional knowledge, technical skill, and accuracy in daily operations.' },
    { id: 's_r3', cid: 's_c3', text: 'To what extent does the trainee handle ambiguous situations proactively and resolves operational challenges without waiting for explicit instruction.' },
    { id: 's_r4', cid: 's_c4', text: 'To what extent does the trainee identify operational inefficiencies and suggests or implements workflow improvements within the department.' },
    { id: 's_r5', cid: 's_c5', text: 'To what extent does the trainee collaborate effectively with peers, cross-functional units, and subordinates while building productive working relationships.' },
    { id: 's_r6', cid: 's_c6', text: 'To what extent does the trainee accept constructive criticism, demonstrates agility, and successfully applies coaching to modify performance or behavior.' },
    { id: 's_r7', cid: 's_c7', text: 'To what extent does the trainee exhibit ownership, accountability, and the leadership potential needed to step into higher-level supervisory or management responsibilities over the next 6–12 months.' },
  ];

  const overallOptions = [
    { id: 'exceptional', label: 'Exceptional' },
    { id: 'exceeds_expectations', label: 'Exceeds Expectation' },
    { id: 'meets_expectations', label: 'Meets Expectation' },
    { id: 'needs_development', label: 'Needs Development' },
    { id: 'unsatisfactory', label: 'Unsatisfactory' },
  ];

  const supervisorRecommendationOptions = [
    { id: 'confirm_promotion', label: 'Confirm Appointment / Fast-Track Promotion to Unit Lead' },
    { id: 'retain_on_track', label: 'Continue Programme / On Track for Standard Confirmation' },
    { id: 'extend_probation', label: 'Extend Probationary Period (requires 90-day PIP)' },
    { id: 'reassign_unit', label: 'Reassign to Alternative Business Unit or Function' },
    { id: 'discontinue', label: 'Discontinue from Management Trainee Programme' },
  ];

  const ratingRows = supervisorRatingQuestions
    .map(
      (q) => `<tr>
        <td style="font-size: 11.5px; line-height: 1.35;">${escapeHtml(q.text)}</td>
        <td style="text-align: center; vertical-align: middle;">
          <span class="doc-bold" style="font-size: 13px;">${escapeHtml(a[q.id] || '—')}</span>
        </td>
        <td style="vertical-align: top; padding: 4px;">
          <span style="font-size: 11px; line-height: 1.35; display: block; word-break: break-word;">
            ${escapeHtml(a[q.cid] || a[`${q.id}_comment`] || '—')}
          </span>
        </td>
      </tr>`
    )
    .join('');

  const overallCheckboxes = overallOptions
    .map((opt) => {
      const checked = isOverallMatch(a.s_overall, opt.id);
      return `<div class="doc-checkbox-row">
        <span class="doc-checkbox-box">${checked ? '☑' : '☐'}</span>
        <span class="doc-checkbox-label">${opt.label}</span>
      </div>`;
    })
    .join('');

  const recCheckboxes = supervisorRecommendationOptions
    .map((opt) => {
      const checked = a.s_recommendation === opt.id;
      return `<div class="doc-checkbox-row">
        <span class="doc-checkbox-box">${checked ? '☑' : '☐'}</span>
        <span class="doc-checkbox-label" style="font-size: 11.5px;">${opt.label}</span>
      </div>`;
    })
    .join('');

  const sigSrc = data.signatureDataUrl || a.s_signature_svg || '';

  return `<div class="official-document-container">
    <!-- PAGE 1 OF 2 -->
    <div class="official-doc-page page-1">
      <table class="doc-header-table">
        <tbody>
          <tr>
            <td class="doc-logo-cell">
              <img src="${logoDataUrl}" alt="Genesis Logo" width="42" height="42" style="display:block;margin:0 auto;object-fit:contain;" />
            </td>
            <td class="doc-title-cell">
              <div class="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
              <div class="doc-header-subtitle">PERIODIC PERFORMANCE ASSESMENT-SUPERVISOR</div>
            </td>
            <td class="doc-meta-cell">
              <div class="doc-meta-top">
                <div>Date</div>
                <div>(${formattedDate})</div>
              </div>
              <div class="doc-meta-bottom">Page: 1 / 2</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table class="doc-identity-table">
        <tbody>
          <tr>
            <td class="doc-label-cell" style="width: 22%;">Supervisor Name</td>
            <td class="doc-val-cell" style="width: 28%;">${escapeHtml(a.s_signature_name || data.supervisorName || '—')}</td>
            <td class="doc-label-cell" style="width: 22%;">Trainee Name:</td>
            <td class="doc-val-cell" style="width: 28%;">${escapeHtml(data.traineeName || '—')}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Staff ID:</td>
            <td class="doc-val-cell">${escapeHtml(data.staffId || '—')}</td>
            <td class="doc-label-cell">Date of Assessment:</td>
            <td class="doc-val-cell">${formattedDate}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Department/Business Unit:</td>
            <td class="doc-val-cell">${escapeHtml(a.s_department || data.department || '—')}</td>
            <td class="doc-label-cell">Location:</td>
            <td class="doc-val-cell">${escapeHtml(a.s_location || data.location || '—')}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Purpose</td>
            <td class="doc-val-cell" colspan="3" style="font-size: 11.5px; text-align: justify; line-height: 1.45;">
              To assess the trainee's performance, capability, application of knowledge, behavioural competencies, and leadership potential, while identifying development needs and readiness for increased responsibility.
            </td>
          </tr>
        </tbody>
      </table>

      <div class="doc-section-heading">Rating Scale</div>
      <table class="doc-scale-table">
        <thead>
          <tr>
            <th style="width: 35%; text-align: left;">Rating</th>
            <th style="width: 65%; text-align: left;">Description</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="doc-bg-gray doc-bold">5 – Exceptional</td><td class="doc-bold">Consistently surpasses role requirements; strong leadership trajectory.</td></tr>
          <tr><td class="doc-bold">4 – Exceeds Expectations</td><td class="doc-bold">Frequently surpasses role requirements and delivers strong result.</td></tr>
          <tr><td class="doc-bg-gray doc-bold">3 – Meets Expectations</td><td class="doc-bold">Solid, reliable performance; meets operational requirements.</td></tr>
          <tr><td class="doc-bold">2 – Needs Development</td><td class="doc-bold">Inconsistent performance; requires targeted support and coaching in key areas.</td></tr>
          <tr><td class="doc-bg-gray doc-bold">1 – Unsatisfactory</td><td class="doc-bold">Fails to meet core requirements; structured performance improvement plan required.</td></tr>
        </tbody>
      </table>

      <table class="doc-grid-table" style="margin-top: 14px;">
        <thead>
          <tr>
            <th style="width: 52%; text-align: left;">Assessment Area</th>
            <th style="width: 15%; text-align: center;">Rating (1–5)</th>
            <th style="width: 33%; text-align: left;">Supervisor Comments</th>
          </tr>
        </thead>
        <tbody>
          ${ratingRows}
        </tbody>
      </table>

      <div class="doc-page-footer-num">1</div>
    </div>

    <!-- PAGE 2 OF 2 -->
    <div class="official-doc-page page-2">
      <table class="doc-header-table">
        <tbody>
          <tr>
            <td class="doc-logo-cell">
              <img src="${logoDataUrl}" alt="Genesis Logo" width="42" height="42" style="display:block;margin:0 auto;object-fit:contain;" />
            </td>
            <td class="doc-title-cell">
              <div class="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
              <div class="doc-header-subtitle">PERIODIC PERFORMANCE ASSESMENT-SUPERVISOR</div>
            </td>
            <td class="doc-meta-cell">
              <div class="doc-meta-top">
                <div>Date</div>
                <div>(${formattedDate})</div>
              </div>
              <div class="doc-meta-bottom">Page: 2 / 2</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">1. What are the trainee's three key strengths?</div>
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">a.</span><div class="doc-line-text">${escapeHtml(a.s_q1a || '—')}</div></div>
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">b.</span><div class="doc-line-text">${escapeHtml(a.s_q1b || '—')}</div></div>
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">c.</span><div class="doc-line-text">${escapeHtml(a.s_q1c || '—')}</div></div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">2. Specific areas requiring improvement or behavioural development:</div>
        <div class="doc-line-text" style="min-height: 28px; height: auto; padding: 4px 6px; white-space: pre-wrap; line-height: 1.45;">
          ${escapeHtml(a.s_q_dev || '—')}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">3. What specific training, skill-building, or mentoring resources should the Learning & Development team provide over the next quarter to support this trainee?</div>
        <div class="doc-line-text" style="min-height: 28px; height: auto; padding: 4px 6px; white-space: pre-wrap; line-height: 1.45;">
          ${escapeHtml(a.s_q2 || '—')}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">4. Overall, how would you rate the performance of your trainee so far?</div>
        <div class="doc-checkbox-list" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px 16px; margin-top: 6px;">
          ${overallCheckboxes}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 18px;">
        <div class="doc-question-title">5. Recommendation on Trainee Status:</div>
        <div class="doc-checkbox-list" style="gap: 4px; margin-top: 6px;">
          ${recCheckboxes}
        </div>
      </div>

      <div class="doc-signature-block" style="margin-top: 22px;">
        <div class="doc-signature-left">
          <span class="doc-bold">Supervisor Signature:</span>
          <div class="doc-signature-line">
            ${sigSrc ? `<img src="${sigSrc}" alt="Supervisor Signature" class="doc-signature-img" />` : ''}
          </div>
          ${a.s_signature_name ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">Signatory: <strong>${escapeHtml(a.s_signature_name)}</strong></div>` : ''}
        </div>
        <div class="doc-signature-right">
          <span class="doc-bold">Date:</span>
          <div class="doc-date-line">${formattedDate}</div>
        </div>
      </div>

      <div class="doc-page-footer-num">2</div>
    </div>
  </div>`;
}

function renderTraineeDocumentHtml(data: any, logoDataUrl: string): string {
  const a = data.answers || {};
  const formattedDate = formatDocDate(data.appraisalDate || a.t_signature_date);

  const traineeRatingQuestions = [
    { id: 't_r1', cid: 't_c1', text: "My onboarding and transition into my current team were smooth, and I received sufficient support to understand my role's scope." },
    { id: 't_r2', cid: 't_c2', text: 'I have a clear understanding of my daily KPIs, department deliverables, and how my work contributes to overall business goals.' },
    { id: 't_r3', cid: 't_c3', text: 'The foundational training received during the Management Trainee classroom/induction modules prepared me effectively for my post-deployment duties.' },
    { id: 't_r4', cid: 't_c4', text: 'How would you rate your overall experience working in your assigned unit and with your line manager over the past months on the job?' },
    { id: 't_r5', cid: 't_c5', text: 'I feel confident handling routine operational challenges and making day-to-day decisions independently without waiting for step-by-step supervision.' },
  ];

  const overallOptions = [
    { id: 'excellent', label: 'Excellent' },
    { id: 'very_good', label: 'Very Good' },
    { id: 'good', label: 'Good' },
    { id: 'fair', label: 'Satisfactory' },
    { id: 'poor', label: 'Needs Improvement' },
  ];

  const ratingRows = traineeRatingQuestions
    .map(
      (q) => `<tr>
        <td style="font-size: 11.5px; line-height: 1.35;">${escapeHtml(q.text)}</td>
        <td style="text-align: center; vertical-align: middle;">
          <span class="doc-bold" style="font-size: 13px;">${escapeHtml(a[q.id] || '—')}</span>
        </td>
        <td style="vertical-align: top; padding: 4px;">
          <span style="font-size: 11px; line-height: 1.35; display: block; word-break: break-word;">
            ${escapeHtml(a[q.cid] || a[`${q.id}_comment`] || '—')}
          </span>
        </td>
      </tr>`
    )
    .join('');

  const overallCheckboxes = overallOptions
    .map((opt) => {
      const checked = isOverallMatch(a.t_overall, opt.id);
      return `<div class="doc-checkbox-row">
        <span class="doc-checkbox-box">${checked ? '☑' : '☐'}</span>
        <span class="doc-checkbox-label">${opt.label}</span>
      </div>`;
    })
    .join('');

  const sigSrc = data.signatureDataUrl || a.t_signature_svg || '';

  return `<div class="official-document-container">
    <!-- PAGE 1 OF 2 -->
    <div class="official-doc-page page-1">
      <table class="doc-header-table">
        <tbody>
          <tr>
            <td class="doc-logo-cell">
              <img src="${logoDataUrl}" alt="Genesis Logo" width="42" height="42" style="display:block;margin:0 auto;object-fit:contain;" />
            </td>
            <td class="doc-title-cell">
              <div class="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
              <div class="doc-header-subtitle">PERIODIC PERFORMANCE ASSESMENT-TRAINEE</div>
            </td>
            <td class="doc-meta-cell">
              <div class="doc-meta-top">
                <div>Date</div>
                <div>(${formattedDate})</div>
              </div>
              <div class="doc-meta-bottom">Page: 1 / 2</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table class="doc-identity-table">
        <tbody>
          <tr>
            <td class="doc-label-cell" style="width: 22%;">Trainee Name:</td>
            <td class="doc-val-cell" style="width: 28%;">${escapeHtml(a.t_name || data.traineeName || '—')}</td>
            <td class="doc-label-cell" style="width: 22%;">Direct Supervisor:</td>
            <td class="doc-val-cell" style="width: 28%;">${escapeHtml(data.supervisorName || a.t_supervisor_other || '—')}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Staff ID:</td>
            <td class="doc-val-cell">${escapeHtml(a.t_staff_id || data.staffId || '—')}</td>
            <td class="doc-label-cell">Date of Assessment:</td>
            <td class="doc-val-cell">${formattedDate}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Location:</td>
            <td class="doc-val-cell">${escapeHtml(a.t_location || data.location || '—')}</td>
            <td class="doc-label-cell">Department/Business Unit</td>
            <td class="doc-val-cell">${escapeHtml(a.t_department || data.department || '—')}</td>
          </tr>
          <tr>
            <td class="doc-label-cell">Purpose</td>
            <td class="doc-val-cell" colspan="3" style="font-size: 11.5px; text-align: justify; line-height: 1.45;">
              As part of our commitment to your growth and evaluating our overall onboarding experience, Genesis Academy invites you to complete this self-assessment. This form helps us understand your transition into your unit, measure the direct impact you have delivered, evaluate training effectiveness, and identify key areas where we can support your career trajectory.
            </td>
          </tr>
        </tbody>
      </table>

      <div class="doc-section-heading">Rating Scale</div>
      <table class="doc-scale-table" style="max-width: 240px;">
        <thead><tr><th style="text-align: left;">Rating</th></tr></thead>
        <tbody>
          <tr><td class="doc-bg-gray doc-bold">5 – Strongly Agree</td></tr>
          <tr><td class="doc-bold">4 – Agree</td></tr>
          <tr><td class="doc-bg-gray doc-bold">3 – Neutral</td></tr>
          <tr><td class="doc-bold">2 – Disagree</td></tr>
          <tr><td class="doc-bg-gray doc-bold">1 – Strongly Disagree</td></tr>
        </tbody>
      </table>

      <table class="doc-grid-table" style="margin-top: 14px;">
        <thead>
          <tr>
            <th style="width: 52%; text-align: left;">Assessment Area</th>
            <th style="width: 15%; text-align: center;">Rating (1–5)</th>
            <th style="width: 33%; text-align: left;">Trainee Comment & Observation</th>
          </tr>
        </thead>
        <tbody>
          ${ratingRows}
        </tbody>
      </table>

      <div style="margin-top: 12px; font-size: 11.5px; font-style: italic;">
        1. Highlight 2–3 specific tasks, projects, or operational duties you have led or completed in the past 90 days that delivered measurable value to your unit.
      </div>

      <div class="doc-page-footer-num">1</div>
    </div>

    <!-- PAGE 2 OF 2 -->
    <div class="official-doc-page page-2">
      <table class="doc-header-table">
        <tbody>
          <tr>
            <td class="doc-logo-cell">
              <img src="${logoDataUrl}" alt="Genesis Logo" width="42" height="42" style="display:block;margin:0 auto;object-fit:contain;" />
            </td>
            <td class="doc-title-cell">
              <div class="doc-header-title">MANAGEMENT TRAINEE PROGRAMME(MTP)</div>
              <div class="doc-header-subtitle">PERIODIC PERFORMANCE ASSESMENT-TRAINEE</div>
            </td>
            <td class="doc-meta-cell">
              <div class="doc-meta-top">
                <div>Date</div>
                <div>(${formattedDate})</div>
              </div>
              <div class="doc-meta-bottom">Page: 2 / 2</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">a.</span><div class="doc-line-text">${escapeHtml(a.t_q1a || '')}</div></div>
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">b.</span><div class="doc-line-text">${escapeHtml(a.t_q1b || '')}</div></div>
        <div class="doc-lined-subrow"><span class="doc-bold" style="min-width: 20px;">c.</span><div class="doc-line-text">${escapeHtml(a.t_q1c || '')}</div></div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">2. Have you identified or implemented any workflow changes, cost-saving initiatives, or operational improvements since joining your department?</div>
        <div class="doc-line-text" style="min-height: 28px; height: auto; padding: 4px 6px; white-space: pre-wrap; line-height: 1.45;">
          ${escapeHtml(a.t_q2 || '—')}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">3. What can your supervisor or business unit do differently to improve your learning experience?</div>
        <div class="doc-line-text" style="min-height: 28px; height: auto; padding: 4px 6px; white-space: pre-wrap; line-height: 1.45;">
          ${escapeHtml(a.t_q3 || '—')}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">4. What additional resources, cross-functional exposure, or leadership opportunities would help accelerate your readiness for managerial roles in the next 6–12 months?</div>
        <div class="doc-line-text" style="min-height: 28px; height: auto; padding: 4px 6px; white-space: pre-wrap; line-height: 1.45;">
          ${escapeHtml(a.t_q4 || '—')}
        </div>
      </div>

      <div class="doc-question-block" style="margin-top: 20px;">
        <div class="doc-question-title">5. Overall, how would you rate your MTP experience so far?</div>
        <div class="doc-checkbox-list" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px 16px; margin-top: 6px;">
          ${overallCheckboxes}
        </div>
      </div>

      <div class="doc-signature-block">
        <div class="doc-signature-left">
          <span class="doc-bold">Management Trainee Signature:</span>
          <div class="doc-signature-line">
            ${sigSrc ? `<img src="${sigSrc}" alt="Management Trainee Signature" class="doc-signature-img" />` : ''}
          </div>
        </div>
        <div class="doc-signature-right">
          <span class="doc-bold">Date:</span>
          <div class="doc-date-line">${formattedDate}</div>
        </div>
      </div>

      <div class="doc-page-footer-num">2</div>
    </div>
  </div>`;
}

export interface StandaloneRenderOptions {
  appraisal: {
    _id: string;
    traineeName: string;
    traineeStaffId: string;
    traineeEmail?: string;
    department?: string;
    location?: string;
    cycleName?: string;
    cohort?: string;
    createdAt?: any;
    traineeSubmittedAt?: any;
    supervisorSubmittedAt?: any;
  };
  supervisorDocData: any;
  traineeDocData: any;
  viewMode?: 'both' | 'supervisor' | 'trainee';
}

export function renderAppraisalStandaloneHtml({
  appraisal,
  supervisorDocData,
  traineeDocData,
  viewMode = 'both',
}: StandaloneRenderOptions): string {
  const logoDataUrl = getLogoDataUrl();

  const supervisorHtml =
    viewMode === 'both' || viewMode === 'supervisor'
      ? renderSupervisorDocumentHtml(supervisorDocData, logoDataUrl)
      : '';

  const traineeHtml =
    viewMode === 'both' || viewMode === 'trainee'
      ? renderTraineeDocumentHtml(traineeDocData, logoDataUrl)
      : '';

  const docTitle = `${appraisal.traineeName} (${appraisal.traineeStaffId}) - Performance Appraisal`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <style>
${STANDALONE_OFFICIAL_CSS}
  </style>
</head>
<body>
  <!-- Floating Standalone Toolbar (hidden when printing) -->
  <div class="standalone-toolbar no-print">
    <div class="standalone-toolbar-info">
      <div class="standalone-toolbar-title">${escapeHtml(appraisal.traineeName)} (${escapeHtml(appraisal.traineeStaffId)})</div>
      <div class="standalone-toolbar-sub">${escapeHtml(appraisal.cycleName || 'Management Trainee Appraisal')} • ${escapeHtml(appraisal.department || 'All Units')}</div>
    </div>
    <div>
      <button class="standalone-print-btn" onclick="window.print()">
        <span>🖨️</span>
        <span>Print / Save as PDF</span>
      </button>
    </div>
  </div>

  <div class="standalone-content">
    ${supervisorHtml}
    ${viewMode === 'both' && supervisorHtml && traineeHtml ? '<div class="doc-page-divider"></div>' : ''}
    ${traineeHtml}
  </div>
</body>
</html>`;
}
