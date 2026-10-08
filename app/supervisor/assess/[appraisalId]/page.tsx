'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import SignaturePad from 'signature_pad';
import { OfficialSupervisorDocument } from '@/components/OfficialFormDocument';

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
  supervisorDeadline: string;
}

export default function SupervisorAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const appraisalId = params?.appraisalId as string;
  const { data: session } = useSession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appraisal, setAppraisal] = useState<AppraisalData | null>(null);
  const [traineeAnswers, setTraineeAnswers] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'split' | 'trainee' | 'supervisor'>('split');
  const [currentStep, setCurrentStep] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'workspace' | 'paper'>('workspace');

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  // Set default supervisor name from session once loaded if not already set
  useEffect(() => {
    const userName = session?.user?.name;
    if (userName) {
      setAnswers((prev) => {
        if (!prev.s_signature_name) {
          return {
            ...prev,
            s_signature_name: userName,
          };
        }
        return prev;
      });
    }
  }, [session?.user?.name]);

  // Load appraisal data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/supervisor/assess/${appraisalId}`);
        if (!res.ok) {
          throw new Error('Failed to load assessment data');
        }
        const json = await res.json();
        setAppraisal(json.appraisal);
        setTraineeAnswers(json.traineeAnswers || {});

        const initialAnswers = json.supervisorAnswers || {};
        const defaultName = initialAnswers.s_signature_name || json.currentUserName || session?.user?.name || '';
        const defaultDate = initialAnswers.s_signature_date || new Date().toISOString().split('T')[0];

        setAnswers((prev) => ({
          ...initialAnswers,
          ...prev,
          s_signature_name: initialAnswers.s_signature_name || prev.s_signature_name || defaultName,
          s_signature_date: initialAnswers.s_signature_date || prev.s_signature_date || defaultDate,
        }));
      } catch (err: any) {
        setError(err.message || 'Error loading appraisal');
      } finally {
        setLoading(false);
      }
    }
    if (appraisalId) {
      loadData();
    }
  }, [appraisalId, session?.user?.name]);

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !sigPadRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        penColor: '#002147',
        backgroundColor: 'rgba(255,255,255,0)',
      });
      sigPadRef.current = pad;

      if (answers.s_signature_svg && canvasRef.current) {
        // Load existing signature data url if present
        try {
          pad.fromDataURL(answers.s_signature_svg);
        } catch (e) {
          // ignore invalid data url
        }
      }
    }
  }, [currentStep, answers.s_signature_svg]);

  // Autosave handler
  const saveDraft = useCallback(
    async (updatedAnswers: Record<string, any>) => {
      if (appraisal?.status === 'complete') return;
      try {
        setSavingStatus('saving');
        const res = await fetch(`/api/supervisor/assess/${appraisalId}`, {
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
      } catch (err) {
        setSavingStatus('error');
      }
    },
    [appraisalId, appraisal?.status]
  );

  const updateAnswer = (key: string, value: any) => {
    setAnswers((prev) => {
      const updated = { ...prev, [key]: value };
      saveDraft(updated);
      return updated;
    });
  };

  const handleClearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      updateAnswer('s_signature_svg', null);
    }
  };

  const handleSaveSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataUrl = sigPadRef.current.toDataURL();
      updateAnswer('s_signature_svg', dataUrl);
    }
  };

  const handleSubmit = async () => {
    // Capture signature if not already saved
    let sigUrl = answers.s_signature_svg;
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      sigUrl = sigPadRef.current.toDataURL();
    }

    const payload: Record<string, any> = {
      ...answers,
      s_signature_svg: sigUrl,
    };

    // Validation
    const requiredRatings = ['s_r1', 's_r2', 's_r3', 's_r4', 's_r5', 's_r6', 's_r7'];
    for (const r of requiredRatings) {
      if (!payload[r]) {
        alert('Please rate all 7 performance competencies before submitting.');
        setCurrentStep(1);
        return;
      }
    }

    if (!payload.s_overall) {
      alert('Please select an Overall Performance Rating.');
      setCurrentStep(4);
      return;
    }

    if (!payload.s_recommendation) {
      alert('Please provide your Official Trainee Recommendation.');
      setCurrentStep(4);
      return;
    }

    if (!payload.s_signature_name) {
      alert('Please enter your signature name.');
      setCurrentStep(5);
      return;
    }

    if (!confirm('Are you sure you want to submit this supervisor assessment? Once submitted, it will be marked complete.')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/supervisor/assess/${appraisalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit assessment');
      }

      alert('Assessment successfully submitted! Returning to queue.');
      router.push('/supervisor');
    } catch (err: any) {
      alert(err.message || 'Error submitting assessment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#002147', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading assessment workspace...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !appraisal) {
    return (
      <div style={{ maxWidth: 800, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Error loading assessment</h2>
        <p style={{ color: '#64748b', marginTop: 8 }}>{error || 'Assessment record not found'}</p>
        <Link
          href="/supervisor"
          style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: '#002147', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  const isReadOnly = appraisal.status === 'complete' || appraisal.status === 'printed';

  const ratingCompetencies = [
    { id: 's_r1', title: '1. Job Knowledge & Technical Competence', desc: 'Understanding of duties, systems, standard operating procedures, and job mastery.' },
    { id: 's_r2', title: '2. Quality & Accuracy of Work', desc: 'Thoroughness, precision, attention to detail, adherence to standards, and error-free execution.' },
    { id: 's_r3', title: '3. Work Output & Productivity', desc: 'Pace of delivery, volume of work accomplished, time management, and output volume.' },
    { id: 's_r4', title: '4. Dependability & Attendance', desc: 'Punctuality, reliability in fulfilling commitments, attendance, and adherence to company ethics.' },
    { id: 's_r5', title: '5. Initiative & Problem Solving', desc: 'Proactive attitude, resourcefulness, self-starting ability, and creative approach to challenges.' },
    { id: 's_r6', title: '6. Interpersonal Relations & Teamwork', desc: 'Collaboration with peers, cross-functional spirit, respect for colleagues, and constructive attitude.' },
    { id: 's_r7', title: '7. Communication Skills', desc: 'Clarity in verbal and written reports, listening skills, and professional conduct with stakeholders.' },
  ];

  return (
    <div style={{ minHeight: 'calc(100vh - 68px)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header Bar */}
      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        position: 'sticky',
        top: 68,
        zIndex: 40,
        boxShadow: 'var(--shadow-xs)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/supervisor"
            className="gh-btn gh-btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              gap: 6,
            }}
          >
            ← Back to Queue
          </Link>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>
                {appraisal.traineeName}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                {appraisal.traineeStaffId}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {appraisal.department} • {appraisal.location}
              </span>
            </div>
          </div>
        </div>

        {/* Status, Layout Mode & Autosave Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Mode Switcher */}
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
                boxShadow: layoutMode === 'workspace' ? '0 2px 6px rgba(255, 12, 52, 0.35)' : 'none',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-sans)',
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
                boxShadow: layoutMode === 'paper' ? '0 2px 6px rgba(255, 12, 52, 0.35)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span>📄</span> Official Paper Form
            </button>
          </div>

          {!isReadOnly && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)' }}>
              {savingStatus === 'saving' && <span style={{ color: 'var(--warning)' }}>● Saving draft...</span>}
              {savingStatus === 'saved' && (
                <span style={{ color: 'var(--success)' }}>
                  ✓ Saved {lastSaved ? lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              )}
              {savingStatus === 'error' && <span style={{ color: 'var(--danger)' }}>⚠️ Error saving</span>}
            </div>
          )}

          {isReadOnly && (
            <span className="gh-badge gh-badge-complete">
              ✓ Completed & Locked
            </span>
          )}
        </div>
      </div>

      {/* Render Official Paper Layout OR Split Workspace */}
      {layoutMode === 'paper' ? (
        <div style={{ flex: 1, padding: '32px 16px', background: '#525659', overflowY: 'auto' }}>
          <div style={{
            maxWidth: 820,
            margin: '0 auto 16px auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#002147' }}>
              Official Paper Template (Pixel-Perfect) — Live editing & preview
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => window.print()}
              >
                🖨️ Print Form
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : '✓ Submit Assessment'}
                </button>
              )}
            </div>
          </div>

          <OfficialSupervisorDocument
            data={{
              supervisorName: answers.s_signature_name || session?.user?.name || '',
              traineeName: appraisal.traineeName,
              staffId: appraisal.traineeStaffId,
              appraisalDate: answers.s_signature_date,
              department: answers.s_department || appraisal.department,
              location: answers.s_location || appraisal.location,
              answers: answers,
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
        /* Supervisor Assessment Form */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 130px)',
          padding: '32px 24px',
          background: '#f8fafc',
        }}>
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            {/* Step Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 28,
              background: '#fff',
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
            }}>
              {[
                { num: 1, title: 'Ratings' },
                { num: 2, title: 'Strengths' },
                { num: 3, title: 'Improvements' },
                { num: 4, title: 'Overall & Rec.' },
                { num: 5, title: 'Signature' },
              ].map((step) => (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: currentStep === step.num ? '#f1f5f9' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: currentStep === step.num ? '#002147' : currentStep > step.num ? '#16a34a' : '#cbd5e1',
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
                    color: currentStep === step.num ? '#002147' : '#64748b',
                  }}>
                    {step.title}
                  </span>
                </button>
              ))}
            </div>

            {/* Form Content Steps */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              {/* STEP 1: Core Performance Ratings */}
              {currentStep === 1 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
                    Part I: Core Performance Competencies
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 24 }}>
                    Rate the management trainee on the 7 key competencies below. Scale: 1 = Unsatisfactory, 2 = Needs Improvement, 3 = Meets Requirements, 4 = Exceeds Requirements, 5 = Exceptional.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {ratingCompetencies.map((comp) => (
                      <div key={comp.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 20 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{comp.title}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, marginBottom: 12 }}>{comp.desc}</div>

                        {/* 1-5 Radio Buttons */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {[
                            { val: 5, label: '5 - Exceptional' },
                            { val: 4, label: '4 - Exceeds Req.' },
                            { val: 3, label: '3 - Meets Req.' },
                            { val: 2, label: '2 - Needs Impr.' },
                            { val: 1, label: '1 - Unsatisfactory' },
                          ].map((scale) => {
                            const isSelected = answers[comp.id] === scale.val;
                            return (
                              <button
                                key={scale.val}
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => updateAnswer(comp.id, scale.val)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 8,
                                  border: isSelected ? '2px solid #002147' : '1px solid #cbd5e1',
                                  background: isSelected ? '#002147' : '#fff',
                                  color: isSelected ? '#fff' : '#334155',
                                  fontWeight: isSelected ? 700 : 500,
                                  fontSize: 12,
                                  cursor: isReadOnly ? 'default' : 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {scale.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Optional/Required Justification Comment */}
                        <div style={{ marginTop: 10 }}>
                          <input
                            type="text"
                            placeholder="Evidence / remarks for this rating..."
                            disabled={isReadOnly}
                            value={answers[`${comp.id}_comment`] || answers[`s_c${comp.id.replace('s_r', '')}`] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateAnswer(`${comp.id}_comment`, val);
                              updateAnswer(`s_c${comp.id.replace('s_r', '')}`, val);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              fontSize: 12,
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{
                        padding: '10px 24px',
                        background: '#002147',
                        color: '#fff',
                        borderRadius: 8,
                        border: 'none',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                      }}
                    >
                      Next: Key Strengths →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Key Strengths */}
              {currentStep === 2 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
                    Part II: Trainee's Key Strengths
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 24 }}>
                    Detail three distinct areas where the trainee has demonstrated clear strength, aptitude, or positive impact during this period.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {[
                      { id: 's_q1a', label: 'Key Strength 1' },
                      { id: 's_q1b', label: 'Key Strength 2' },
                      { id: 's_q1c', label: 'Key Strength 3' },
                    ].map((field) => (
                      <div key={field.id}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          {field.label}
                        </label>
                        <textarea
                          rows={3}
                          disabled={isReadOnly}
                          placeholder="Provide concrete examples or observations..."
                          value={answers[field.id] || ''}
                          onChange={(e) => updateAnswer(field.id, e.target.value)}
                          style={{
                            width: '100%',
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                    <button
                      onClick={() => setCurrentStep(1)}
                      style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      ← Back to Ratings
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{ padding: '10px 24px', background: '#002147', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      Next: Improvements →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Areas for Improvement & L&D Plan */}
              {currentStep === 3 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
                    Part III: Development & Training Plan
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 24 }}>
                    Identify critical growth opportunities and recommended learning paths for this management trainee.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Specific Areas Requiring Improvement or Behavioural Development:
                      </label>
                      <textarea
                        rows={4}
                        disabled={isReadOnly}
                        placeholder="Outline skills, mindset, or performance habits the trainee needs to enhance..."
                        value={answers.s_q_dev || ''}
                        onChange={(e) => updateAnswer('s_q_dev', e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Recommended Training Programmes / Learning Interventions (L&D):
                      </label>
                      <textarea
                        rows={3}
                        disabled={isReadOnly}
                        placeholder="Specify relevant workshops, mentorship pairings, or technical modules..."
                        value={answers.s_q2 || ''}
                        onChange={(e) => updateAnswer('s_q2', e.target.value)}
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
                    <button
                      onClick={() => setCurrentStep(2)}
                      style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      style={{ padding: '10px 24px', background: '#002147', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      Next: Overall Evaluation →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Overall Rating & Recommendation */}
              {currentStep === 4 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
                    Part IV: Overall Rating & Official Recommendation
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 24 }}>
                    Provide your holistic evaluation and career status recommendation for HR consideration.
                  </p>

                  {/* Overall Rating */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                      Supervisor Overall Performance Rating:
                    </label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        { val: 'excellent', label: 'Excellent' },
                        { val: 'very_good', label: 'Very Good' },
                        { val: 'good', label: 'Good' },
                        { val: 'fair', label: 'Fair' },
                        { val: 'poor', label: 'Poor' },
                      ].map((opt) => (
                        <label
                          key={opt.val}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            borderRadius: 8,
                            border: answers.s_overall === opt.val ? '2px solid #002147' : '1px solid #cbd5e1',
                            background: answers.s_overall === opt.val ? '#f0fdf4' : '#fff',
                            cursor: isReadOnly ? 'default' : 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          <input
                            type="radio"
                            name="s_overall"
                            disabled={isReadOnly}
                            checked={answers.s_overall === opt.val}
                            onChange={() => updateAnswer('s_overall', opt.val)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Trainee Progression Recommendation */}
                  <div style={{ marginBottom: 28 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
                      Recommendation on Trainee Status:
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
                            border: answers.s_recommendation === rec.val ? '2px solid #002147' : '1px solid #e2e8f0',
                            background: answers.s_recommendation === rec.val ? '#f8fafc' : '#fff',
                            cursor: isReadOnly ? 'default' : 'pointer',
                            fontSize: 13,
                            color: '#334155',
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
                    <button
                      onClick={() => setCurrentStep(3)}
                      style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(5)}
                      style={{ padding: '10px 24px', background: '#002147', color: '#fff', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                    >
                      Next: Sign & Submit →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Signature & Final Submit */}
              {currentStep === 5 && (
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
                    Part V: Supervisor Declaration & Digital Signature
                  </h2>
                  <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, marginBottom: 24 }}>
                    I confirm that I have evaluated this management trainee objectively according to Genesis Group performance standards and discussed performance feedback with them.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Supervisor Name (Full Official Name):
                      </label>
                      <input
                        type="text"
                        disabled={isReadOnly}
                        placeholder={session?.user?.name || 'e.g. David Adeleke'}
                        value={answers.s_signature_name || ''}
                        onChange={(e) => updateAnswer('s_signature_name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                        Defaults to your account name. You can edit this if your official signatory name differs.
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        Date of Assessment:
                      </label>
                      <input
                        type="date"
                        disabled={isReadOnly}
                        value={answers.s_signature_date || ''}
                        onChange={(e) => updateAnswer('s_signature_date', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  {/* Canvas Signature Pad */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                        Draw Digital Signature (Mouse or Touchscreen):
                      </label>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={handleClearSignature}
                          style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Clear Canvas
                        </button>
                      )}
                    </div>

                    <div style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: 8,
                      background: '#f8fafc',
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
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Your digital signature is recorded in compliance with official Genesis Group HR policy.
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
                    <button
                      onClick={() => setCurrentStep(4)}
                      style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      ← Back to Evaluation
                    </button>

                    {!isReadOnly ? (
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                          padding: '12px 32px',
                          background: '#16a34a',
                          color: '#fff',
                          borderRadius: 8,
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 14,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                        }}
                      >
                        {submitting ? 'Submitting Final Assessment...' : '✓ Submit Completed Assessment'}
                      </button>
                    ) : (
                      <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 14 }}>
                        ✓ Assessment already submitted
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
