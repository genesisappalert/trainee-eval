'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SignaturePad from 'signature_pad';
import { OfficialSupervisorDocument } from '@/components/OfficialFormDocument';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppraisalData {
  _id: string;
  traineeStaffId: string;
  traineeName: string;
  traineeEmail: string;
  department: string;
  location: string;
  status: string;
  flags: string[];
  traineeSubmittedAt: string | null;
  supervisorSubmittedAt: string | null;
  cycleName: string;
  cohort: string;
  supervisorDeadline: string | null;
}

function isSupervisorOverallSelected(currentVal: string | undefined, optionVal: string): boolean {
  if (!currentVal) return false;
  const v = currentVal.toLowerCase().trim();
  if (optionVal === 'exceptional' || optionVal === 'excellent') {
    return v === 'exceptional' || v === 'excellent';
  }
  if (optionVal === 'exceeds_expectations' || optionVal === 'very_good') {
    return v === 'exceeds_expectations' || v === 'exceeds expectation' || v === 'very_good' || v === 'very good';
  }
  if (optionVal === 'meets_expectations' || optionVal === 'good') {
    return v === 'meets_expectations' || v === 'meets expectation' || v === 'good';
  }
  if (optionVal === 'needs_development' || optionVal === 'fair') {
    return v === 'needs_development' || v === 'fair' || v === 'satisfactory';
  }
  if (optionVal === 'unsatisfactory' || optionVal === 'poor') {
    return v === 'unsatisfactory' || v === 'poor' || v === 'needs improvement';
  }
  return v === optionVal;
}

export default function SupervisorTokenEvaluationPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appraisal, setAppraisal] = useState<AppraisalData | null>(null);
  const [traineeAnswers, setTraineeAnswers] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [showTraineePanel, setShowTraineePanel] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'workspace' | 'paper'>('workspace');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAnswersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    latestAnswersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/supervisor/token/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Invalid or expired supervisor evaluation link');
        }
        const json = await res.json();
        setAppraisal(json.appraisal);
        setTraineeAnswers(json.traineeAnswers || {});

        const initialAnswers: Record<string, any> = { ...(json.supervisorAnswers || {}) };
        for (let i = 1; i <= 7; i++) {
          const cVal = initialAnswers[`s_c${i}`] ?? initialAnswers[`s_r${i}_comment`];
          if (cVal !== undefined) {
            initialAnswers[`s_c${i}`] = cVal;
            initialAnswers[`s_r${i}_comment`] = cVal;
          }
        }
        const defaultName = initialAnswers.s_signature_name || json.defaultSupervisorName || '';
        const defaultDate = initialAnswers.s_signature_date || new Date().toISOString().split('T')[0];

        const merged = {
          ...initialAnswers,
          s_signature_name: defaultName,
          s_signature_date: defaultDate,
          s_signature_svg: initialAnswers.s_signature_svg || json.supervisorSignatureSvg || null,
        };
        latestAnswersRef.current = merged;
        setAnswers(merged);
      } catch (err: any) {
        setError(err.message || 'Error loading supervisor evaluation link');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      loadData();
    }
  }, [token]);

  const saveDraft = useCallback(
    async (updatedAnswers: Record<string, any>) => {
      if (appraisal?.status === 'complete' || appraisal?.status === 'printed' || submittedSuccess) return;
      try {
        setSavingStatus('saving');
        const res = await fetch(`/api/supervisor/token/${encodeURIComponent(token)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: updatedAnswers }),
        });
        if (res.ok) {
          setSavingStatus('saved');
          setLastSaved(new Date());
        } else {
          setSavingStatus('error');
        }
      } catch {
        setSavingStatus('error');
      }
    },
    [token, appraisal?.status, submittedSuccess]
  );

  const scheduleAutosave = useCallback(
    (updatedAnswers: Record<string, any>) => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        saveDraft(updatedAnswers);
      }, 600);
    },
    [saveDraft]
  );

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  const updateAnswer = useCallback(
    (key: string, value: any) => {
      setAnswers((prev) => {
        const updated: Record<string, any> = { ...prev, [key]: value };
        const cMatch = key.match(/^s_c([1-7])$/);
        if (cMatch) {
          updated[`s_r${cMatch[1]}_comment`] = value;
        }
        const rCommentMatch = key.match(/^s_r([1-7])_comment$/);
        if (rCommentMatch) {
          updated[`s_c${rCommentMatch[1]}`] = value;
        }
        latestAnswersRef.current = updated;
        scheduleAutosave(updated);
        return updated;
      });
    },
    [scheduleAutosave]
  );

  useEffect(() => {
    if (currentStep !== 5 || layoutMode !== 'workspace' || !canvasRef.current) {
      sigPadRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, {
      penColor: '#002147',
      backgroundColor: 'rgba(255,255,255,0)',
    });
    sigPadRef.current = pad;

    const existingSig = latestAnswersRef.current.s_signature_svg;
    if (existingSig) {
      try {
        pad.fromDataURL(existingSig);
      } catch {
        // ignore invalid data url
      }
    }

    const handleEndStroke = () => {
      if (!pad.isEmpty()) {
        updateAnswer('s_signature_svg', pad.toDataURL());
      }
    };
    pad.addEventListener('endStroke', handleEndStroke);

    return () => {
      pad.removeEventListener('endStroke', handleEndStroke);
      pad.off();
      sigPadRef.current = null;
    };
  }, [currentStep, layoutMode, updateAnswer]);

  const handleClearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
    }
    updateAnswer('s_signature_svg', null);
  };

  const handleSubmit = async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const currentAnswers = { ...latestAnswersRef.current };

    let sigUrl = currentAnswers.s_signature_svg;
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      sigUrl = sigPadRef.current.toDataURL();
    }

    const payload: Record<string, any> = {
      ...currentAnswers,
      s_signature_svg: sigUrl,
    };
    for (let i = 1; i <= 7; i++) {
      const cVal = payload[`s_c${i}`] ?? payload[`s_r${i}_comment`];
      if (cVal !== undefined) {
        payload[`s_c${i}`] = cVal;
        payload[`s_r${i}_comment`] = cVal;
      }
    }

    const requiredRatings = ['s_r1', 's_r2', 's_r3', 's_r4', 's_r5', 's_r6', 's_r7'];
    for (const r of requiredRatings) {
      if (!payload[r]) {
        alert('Please rate all 7 performance competencies before submitting.');
        setLayoutMode('workspace');
        setCurrentStep(1);
        return;
      }
    }

    if (!payload.s_overall) {
      alert('Please select an Overall Performance Rating.');
      setLayoutMode('workspace');
      setCurrentStep(4);
      return;
    }

    if (!payload.s_recommendation) {
      alert('Please provide your Official Trainee Recommendation.');
      setLayoutMode('workspace');
      setCurrentStep(4);
      return;
    }

    if (!payload.s_signature_name || !String(payload.s_signature_name).trim()) {
      alert('Please enter your full name in the signature declaration.');
      setLayoutMode('workspace');
      setCurrentStep(5);
      return;
    }

    if (!confirm('Submit this supervisor evaluation? Once submitted, the trainee appraisal will be marked complete.')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/supervisor/token/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit evaluation');
      }

      setAnswers(payload);
      setAppraisal((prev) => (prev ? { ...prev, status: 'complete', supervisorSubmittedAt: data.submittedAt } : prev));
      setSubmittedSuccess(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      alert(err.message || 'Error submitting evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', padding: 60, textAlign: 'center' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 16px auto' }} />
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Loading supervisor evaluation form...</p>
      </div>
    );
  }

  if (error || !appraisal) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', background: 'var(--bg-card)', padding: 36, borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>Unable to Open Evaluation Link</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: 14 }}>
            {error || 'This supervisor evaluation link is invalid or has expired.'}
          </p>
        </div>
      </div>
    );
  }

  const isReadOnly = appraisal.status === 'complete' || appraisal.status === 'printed' || submittedSuccess;

  const ratingCompetencies = [
    {
      id: 's_r1',
      cid: 's_c1',
      title: '1. KPIs, Operational Goals & Deadlines',
      desc: 'To what extent does the trainee independently meet key performance indicators (KPIs), operational goals, and deadlines without requiring constant supervision?',
    },
    {
      id: 's_r2',
      cid: 's_c2',
      title: '2. Functional Knowledge, Technical Skill & Accuracy',
      desc: 'To what extent does the trainee demonstrate required functional knowledge, technical skill, and accuracy in daily operations?',
    },
    {
      id: 's_r3',
      cid: 's_c3',
      title: '3. Proactiveness & Operational Problem Solving',
      desc: 'To what extent does the trainee handle ambiguous situations proactively and resolve operational challenges without waiting for explicit instruction?',
    },
    {
      id: 's_r4',
      cid: 's_c4',
      title: '4. Workflow Improvement & Efficiency Initiatives',
      desc: 'To what extent does the trainee identify operational inefficiencies and suggest or implement workflow improvements within the department?',
    },
    {
      id: 's_r5',
      cid: 's_c5',
      title: '5. Collaboration & Working Relationships',
      desc: 'To what extent does the trainee collaborate effectively with peers, cross-functional units, and subordinates while building productive working relationships?',
    },
    {
      id: 's_r6',
      cid: 's_c6',
      title: '6. Coachability, Agility & Applying Feedback',
      desc: 'To what extent does the trainee accept constructive criticism, demonstrate agility, and successfully apply coaching to modify performance or behaviour?',
    },
    {
      id: 's_r7',
      cid: 's_c7',
      title: '7. Ownership, Accountability & Leadership Potential',
      desc: 'To what extent does the trainee exhibit ownership, accountability, and the leadership potential needed to step into higher-level supervisory or management responsibilities over the next 6–12 months?',
    },
  ];

  const traineeQuestionsList = [
    { id: 't_r1', cid: 't_c1', label: '1. Smooth onboarding & sufficient role support' },
    { id: 't_r2', cid: 't_c2', label: '2. Clear understanding of daily KPIs & deliverables' },
    { id: 't_r3', cid: 't_c3', label: '3. Classroom/induction modules prepared me for duties' },
    { id: 't_r5', cid: 't_c5', label: '4. Confidence handling routine operational challenges independently' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {/* Branded Top Bar */}
      <nav
        className="no-print"
        style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/genesis-logo.png" alt="Genesis Group" width={38} height={38} style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', lineHeight: 1.2 }}>
                GENESIS GROUP — DIRECT SUPERVISOR EVALUATION
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Trainee: <strong style={{ color: 'var(--text)' }}>{appraisal.traineeName}</strong> ({appraisal.traineeStaffId}) • {appraisal.department || 'Unit'} ({appraisal.location || 'HQ'})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowTraineePanel((prev) => !prev)}
              className="gh-btn gh-btn-ghost"
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: showTraineePanel ? 'var(--accent-dim)' : undefined,
                color: showTraineePanel ? 'var(--accent)' : undefined,
                borderColor: showTraineePanel ? 'var(--accent-border)' : undefined,
              }}
            >
              {showTraineePanel ? 'Hide Trainee Self-Assessment' : '📋 View Trainee Self-Assessment'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', padding: 3, borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setLayoutMode('workspace')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: layoutMode === 'workspace' ? 'var(--accent)' : 'transparent',
                  color: layoutMode === 'workspace' ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                Evaluation Form
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('paper')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  background: layoutMode === 'paper' ? 'var(--accent)' : 'transparent',
                  color: layoutMode === 'paper' ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                📄 Official Paper Form
              </button>
            </div>

            {!isReadOnly && (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {savingStatus === 'saving' && <span style={{ color: 'var(--warning)' }}>● Saving...</span>}
                {savingStatus === 'saved' && (
                  <span style={{ color: 'var(--success)' }}>
                    ✓ Saved {lastSaved ? lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                )}
              </div>
            )}

            {isReadOnly && (
              <span className="gh-badge gh-badge-complete">✓ Submitted &amp; Complete</span>
            )}

            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Submitted Confirmation Banner */}
      {isReadOnly && (
        <div
          className="no-print"
          style={{
            background: 'var(--success-dim)',
            borderBottom: '1px solid rgba(22, 163, 74, 0.3)',
            padding: '14px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>
              ✓ Thank you! Your supervisor evaluation for {appraisal.traineeName} ({appraisal.traineeStaffId}) has been recorded and sent to HR Talent Management.
            </div>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('paper');
                setTimeout(() => window.print(), 150);
              }}
              className="gh-btn gh-btn-ghost"
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              🖨️ Print / Save Official Copy (PDF)
            </button>
          </div>
        </div>
      )}

      {layoutMode === 'paper' ? (
        <div style={{ flex: 1, padding: '32px 16px', background: '#525659', overflowY: 'auto' }}>
          <div
            className="no-print"
            style={{
              maxWidth: 820,
              margin: '0 auto 16px auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fff',
              padding: '12px 20px',
              borderRadius: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#002147' }}>
              Official Paper Template — {isReadOnly ? 'Completed Read-Only Record' : 'Live Interactive Editing'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>
                🖨️ Print / Save PDF
              </button>
              {!isReadOnly && (
                <button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : '✓ Submit Assessment'}
                </button>
              )}
            </div>
          </div>

          <OfficialSupervisorDocument
            data={{
              supervisorName: answers.s_signature_name || '',
              traineeName: appraisal.traineeName,
              staffId: appraisal.traineeStaffId,
              appraisalDate: answers.s_signature_date,
              department: answers.s_department || appraisal.department,
              location: answers.s_location || appraisal.location,
              answers,
              signatureDataUrl: answers.s_signature_svg,
            }}
            isInteractive={!isReadOnly}
            onAnswerChange={updateAnswer}
            onSignatureClick={() => {
              setLayoutMode('workspace');
              setCurrentStep(5);
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, padding: '32px 24px' }}>
          <div style={{
            maxWidth: showTraineePanel ? 1360 : 880,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: showTraineePanel ? 'minmax(340px, 460px) 1fr' : '1fr',
            gap: 24,
            alignItems: 'start',
          }}>
            {/* Trainee Self-Assessment Side Panel */}
            {showTraineePanel && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: 16,
                border: '1px solid var(--border)',
                padding: 24,
                boxShadow: 'var(--shadow)',
                position: 'sticky',
                top: 90,
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Trainee Submission
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '2px 0 0 0' }}>
                      {appraisal.traineeName}&apos;s Self-Assessment
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTraineePanel(false)}
                    className="gh-btn gh-btn-ghost"
                    style={{ padding: '4px 8px', fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>

                {Object.keys(traineeAnswers).length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>No trainee self-assessment answers found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Self-Ratings (1–5 Scale)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {traineeQuestionsList.map((tq) => {
                          const rVal = traineeAnswers[tq.id];
                          const cVal = traineeAnswers[tq.cid] ?? traineeAnswers[`${tq.id}_comment`];
                          return (
                            <div key={tq.id} style={{ padding: 10, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12 }}>{tq.label}</span>
                                <span className="gh-badge gh-badge-open" style={{ flexShrink: 0 }}>
                                  Score: {rVal || '—'} / 5
                                </span>
                              </div>
                              {cVal && (
                                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  &ldquo;{cVal}&rdquo;
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                        Key Tasks / Projects Completed (Past 90 Days)
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {traineeAnswers.t_q1a && <li>{traineeAnswers.t_q1a}</li>}
                        {traineeAnswers.t_q1b && <li>{traineeAnswers.t_q1b}</li>}
                        {traineeAnswers.t_q1c && <li>{traineeAnswers.t_q1c}</li>}
                      </ul>
                    </div>

                    {traineeAnswers.t_q2 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                          Workflow Changes / Operational Improvements
                        </div>
                        <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                          {traineeAnswers.t_q2}
                        </div>
                      </div>
                    )}

                    {traineeAnswers.t_q4 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                          Resources &amp; Leadership Opportunities Needed (Next 6–12 Months)
                        </div>
                        <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                          {traineeAnswers.t_q4}
                        </div>
                      </div>
                    )}

                    {traineeAnswers.t_overall && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: 12 }}>Trainee Overall Self-Rating:</span>
                        <span className="gh-badge gh-badge-complete" style={{ textTransform: 'uppercase' }}>
                          {String(traineeAnswers.t_overall).replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Right: 5-Step Supervisor Evaluation Form */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
                background: 'var(--bg-card)',
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {[
                  { num: 1, title: 'Ratings & Comments' },
                  { num: 2, title: 'Strengths' },
                  { num: 3, title: 'Improvements' },
                  { num: 4, title: 'Overall & Rec.' },
                  { num: 5, title: 'Sign & Submit' },
                ].map((step) => (
                  <button
                    key={step.num}
                    onClick={() => setCurrentStep(step.num)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: currentStep === step.num ? 'var(--bg-3)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: currentStep === step.num ? 'var(--accent)' : currentStep > step.num ? 'var(--success)' : 'var(--border)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                    }}>
                      {currentStep > step.num ? '✓' : step.num}
                    </div>
                    <span style={{
                      fontSize: 13,
                      fontWeight: currentStep === step.num ? 700 : 500,
                      color: currentStep === step.num ? 'var(--text)' : 'var(--text-dim)',
                    }}>
                      {step.title}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 32, boxShadow: 'var(--shadow)' }}>
                {/* STEP 1 */}
                {currentStep === 1 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Part I: Core Performance Competencies &amp; Supervisor Comments
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 24 }}>
                      Rate {appraisal.traineeName} on the 7 key assessment areas below and provide your observations for each rating.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      {ratingCompetencies.map((comp) => {
                        const commentVal = answers[comp.cid] ?? answers[`${comp.id}_comment`] ?? '';
                        return (
                          <div key={comp.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{comp.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, marginBottom: 12 }}>{comp.desc}</div>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              {[
                                { val: 5, label: '5 - Exceptional' },
                                { val: 4, label: '4 - Exceeds Expectations' },
                                { val: 3, label: '3 - Meets Expectations' },
                                { val: 2, label: '2 - Needs Development' },
                                { val: 1, label: '1 - Unsatisfactory' },
                              ].map((scale) => {
                                const isSelected = String(answers[comp.id]) === String(scale.val);
                                return (
                                  <button
                                    key={scale.val}
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() => updateAnswer(comp.id, scale.val)}
                                    style={{
                                      padding: '8px 14px',
                                      borderRadius: 8,
                                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                      background: isSelected ? 'var(--accent)' : 'var(--bg)',
                                      color: isSelected ? '#fff' : 'var(--text)',
                                      fontWeight: isSelected ? 700 : 500,
                                      fontSize: 12,
                                      cursor: isReadOnly ? 'default' : 'pointer',
                                    }}
                                  >
                                    {scale.label}
                                  </button>
                                );
                              })}
                            </div>

                            <div style={{ marginTop: 12 }}>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                                Supervisor Comment / Observation:
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Enter supervisor comments or evidence for this rating..."
                                disabled={isReadOnly}
                                value={commentVal}
                                onChange={(e) => updateAnswer(comp.cid, e.target.value)}
                                className="gh-input"
                                style={{ width: '100%', padding: '8px 12px', fontSize: 12, resize: 'vertical' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                      <button onClick={() => setCurrentStep(2)} className="gh-btn gh-btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
                        Next: Key Strengths →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2 */}
                {currentStep === 2 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Part II: Trainee&apos;s Key Strengths
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 24 }}>
                      Identify three distinct strengths demonstrated by {appraisal.traineeName} during this period.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {[
                        { id: 's_q1a', label: 'Key Strength 1 (a)' },
                        { id: 's_q1b', label: 'Key Strength 2 (b)' },
                        { id: 's_q1c', label: 'Key Strength 3 (c)' },
                      ].map((field) => (
                        <div key={field.id}>
                          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {field.label}
                          </label>
                          <textarea
                            rows={3}
                            disabled={isReadOnly}
                            placeholder="Provide concrete examples or observations..."
                            value={answers[field.id] ?? ''}
                            onChange={(e) => updateAnswer(field.id, e.target.value)}
                            className="gh-input"
                            style={{ width: '100%', padding: 12, fontSize: 13 }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                      <button onClick={() => setCurrentStep(1)} className="gh-btn gh-btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}>
                        ← Back to Ratings
                      </button>
                      <button onClick={() => setCurrentStep(3)} className="gh-btn gh-btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
                        Next: Improvements →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3 */}
                {currentStep === 3 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Part III: Development &amp; Training Plan
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 24 }}>
                      Identify growth areas and recommended L&amp;D support over the next quarter.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Specific Areas Requiring Improvement or Behavioural Development:
                        </label>
                        <textarea
                          rows={4}
                          disabled={isReadOnly}
                          placeholder="Outline skills, mindset, or performance habits the trainee needs to enhance..."
                          value={answers.s_q_dev ?? ''}
                          onChange={(e) => updateAnswer('s_q_dev', e.target.value)}
                          className="gh-input"
                          style={{ width: '100%', padding: 12, fontSize: 13 }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Recommended Training Programmes / Learning Interventions (L&amp;D):
                        </label>
                        <textarea
                          rows={3}
                          disabled={isReadOnly}
                          placeholder="Specify relevant workshops, mentorship pairings, or technical modules..."
                          value={answers.s_q2 ?? ''}
                          onChange={(e) => updateAnswer('s_q2', e.target.value)}
                          className="gh-input"
                          style={{ width: '100%', padding: 12, fontSize: 13 }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                      <button onClick={() => setCurrentStep(2)} className="gh-btn gh-btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}>
                        ← Back
                      </button>
                      <button onClick={() => setCurrentStep(4)} className="gh-btn gh-btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
                        Next: Overall Evaluation →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4 */}
                {currentStep === 4 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Part IV: Overall Rating &amp; Official Recommendation
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 24 }}>
                      Provide your holistic evaluation and career status recommendation for HR consideration.
                    </p>

                    <div style={{ marginBottom: 28 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Supervisor Overall Performance Rating: *
                      </label>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {[
                          { val: 'exceptional', label: 'Exceptional' },
                          { val: 'exceeds_expectations', label: 'Exceeds Expectations' },
                          { val: 'meets_expectations', label: 'Meets Expectations' },
                          { val: 'needs_development', label: 'Needs Development' },
                          { val: 'unsatisfactory', label: 'Unsatisfactory' },
                        ].map((opt) => {
                          const checked = isSupervisorOverallSelected(answers.s_overall, opt.val);
                          return (
                            <label
                              key={opt.val}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 8,
                                border: checked ? '2px solid var(--accent)' : '1px solid var(--border)',
                                background: checked ? 'var(--accent-dim)' : 'var(--bg)',
                                color: 'var(--text)',
                                cursor: isReadOnly ? 'default' : 'pointer',
                                fontWeight: 600,
                                fontSize: 13,
                              }}
                            >
                              <input
                                type="radio"
                                name="s_overall"
                                disabled={isReadOnly}
                                checked={checked}
                                onChange={() => updateAnswer('s_overall', opt.val)}
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginBottom: 28 }}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
                        Recommendation on Trainee Status: *
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { val: 'confirm_promotion', label: 'Confirm Appointment / Fast-Track Promotion to Unit Lead' },
                          { val: 'retain_on_track', label: 'Continue Programme / On Track for Standard Confirmation' },
                          { val: 'extend_probation', label: 'Extend Probationary Period (requires 90-day PIP)' },
                          { val: 'reassign_unit', label: 'Reassign to Alternative Business Unit or Function' },
                          { val: 'discontinue', label: 'Discontinue from Management Trainee Programme' },
                        ].map((rec) => (
                          <label
                            key={rec.val}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 14px',
                              borderRadius: 8,
                              border: answers.s_recommendation === rec.val ? '2px solid var(--accent)' : '1px solid var(--border)',
                              background: answers.s_recommendation === rec.val ? 'var(--accent-dim)' : 'var(--bg)',
                              cursor: isReadOnly ? 'default' : 'pointer',
                              fontSize: 13,
                              color: 'var(--text)',
                            }}
                          >
                            <input
                              type="radio"
                              name="s_recommendation"
                              disabled={isReadOnly}
                              checked={answers.s_recommendation === rec.val}
                              onChange={() => updateAnswer('s_recommendation', rec.val)}
                            />
                            {rec.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                      <button onClick={() => setCurrentStep(3)} className="gh-btn gh-btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}>
                        ← Back
                      </button>
                      <button onClick={() => setCurrentStep(5)} className="gh-btn gh-btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
                        Next: Sign &amp; Submit →
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 5 */}
                {currentStep === 5 && (
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                      Part V: Supervisor Declaration &amp; Digital Signature
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 24 }}>
                      I confirm that I have evaluated this management trainee objectively according to Genesis Group performance standards.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Supervisor Full Name: *
                        </label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          placeholder="Enter your full official name"
                          value={answers.s_signature_name ?? ''}
                          onChange={(e) => updateAnswer('s_signature_name', e.target.value)}
                          className="gh-input"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                          Date of Assessment:
                        </label>
                        <input
                          type="date"
                          disabled={isReadOnly}
                          value={answers.s_signature_date ?? ''}
                          onChange={(e) => updateAnswer('s_signature_date', e.target.value)}
                          className="gh-input"
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                          Draw Digital Signature (Mouse or Touchscreen):
                        </label>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={handleClearSignature}
                            style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Clear Canvas
                          </button>
                        )}
                      </div>

                      <div style={{
                        border: '2px dashed #cbd5e1',
                        borderRadius: 8,
                        background: '#ffffff',
                        height: 120,
                        position: 'relative',
                      }}>
                        <canvas
                          ref={canvasRef}
                          width={600}
                          height={120}
                          style={{ width: '100%', height: '100%', cursor: isReadOnly ? 'default' : 'crosshair' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                      <button onClick={() => setCurrentStep(4)} className="gh-btn gh-btn-ghost" style={{ padding: '10px 20px', fontSize: 13 }}>
                        ← Back to Evaluation
                      </button>

                      {!isReadOnly ? (
                        <button
                          onClick={handleSubmit}
                          disabled={submitting}
                          style={{
                            padding: '12px 32px',
                            background: 'var(--success)',
                            color: '#fff',
                            borderRadius: 8,
                            border: 'none',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                          }}
                        >
                          {submitting ? 'Submitting Evaluation...' : '✓ Submit Completed Evaluation'}
                        </button>
                      ) : (
                        <div style={{ color: 'var(--success)', fontWeight: 700, fontSize: 14 }}>
                          ✓ Evaluation Completed &amp; Submitted
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
