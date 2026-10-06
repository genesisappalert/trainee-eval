'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  TRAINEE_STEPS,
  TRAINEE_V1_FIELDS,
  TRAINEE_RATING_SCALE,
  TRAINEE_OVERALL_OPTIONS,
  TRAINEE_V1_TITLE,
  TRAINEE_V1_PURPOSE,
} from '@/lib/forms/definitions';
import { OfficialTraineeDocument } from '@/components/OfficialFormDocument';
import { ThemeToggle } from '@/components/ThemeToggle';

/* ── Types ─────────────────────────────────────────────────── */
interface Supervisor {
  id: string;
  name: string;
  staffId: string;
  department: string;
}

interface CycleInfo {
  id: string;
  slug: string;
  name: string;
  cohort: string;
  traineeDeadline: string;
}

/* ── Helper: format date ───────────────────────────────────── */
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ── Signature Pad Component ───────────────────────────────── */
function SignaturePad({
  onSign,
  signatureData,
}: {
  onSign: (dataUrl: string) => void;
  signatureData: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!signatureData);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load existing signature
    if (signatureData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = signatureData;
    }
  }, [signatureData]);

  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    lastPoint.current = getPoint(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !lastPoint.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const point = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint.current = point;
  };

  const endDraw = () => {
    setIsDrawing(false);
    lastPoint.current = null;
    if (canvasRef.current && hasDrawn) {
      onSign(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSign('');
  };

  return (
    <div className={`signature-pad-container ${isDrawing ? 'signing' : ''}`}>
      <canvas
        ref={canvasRef}
        className="signature-pad-canvas"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!hasDrawn && (
        <div className="signature-pad-label">Draw your signature here</div>
      )}
      <div className="signature-pad-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={clearSignature}>
          Clear
        </button>
      </div>
    </div>
  );
}

/* ── Main Trainee Form Page ────────────────────────────────── */
export default function TraineeFormPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cycle, setCycle] = useState<CycleInfo | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [formMode, setFormMode] = useState<'steps' | 'paper'>('steps');

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const steps = TRAINEE_STEPS;
  const fields = TRAINEE_V1_FIELDS;

  /* ── Load cycle data ───────────────────────────────────── */
  useEffect(() => {
    const fetchCycle = async () => {
      try {
        const res = await fetch(`/api/trainee/cycle/${slug}`);
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'cycle_not_open') {
            setError(
              `This appraisal cycle "${data.name}" is currently ${data.status}. ` +
              (data.opensAt ? `It opens on ${formatDate(data.opensAt)}.` : '') +
              ' Please contact HR for assistance.'
            );
          } else {
            setError(data.error || 'Cycle not found');
          }
          setLoading(false);
          return;
        }
        setCycle(data.cycle);
        setSupervisors(data.supervisors);
        setLoading(false);
      } catch {
        setError('Failed to load the appraisal form. Please try again.');
        setLoading(false);
      }
    };
    fetchCycle();
  }, [slug]);

  /* ── Check for resume token in URL hash ──────────────── */
  useEffect(() => {
    const urlToken = window.location.hash.replace('#', '');
    if (urlToken) {
      setToken(urlToken);
      // Load existing draft
      loadDraft(urlToken);
    }
  }, []);

  const loadDraft = async (t: string) => {
    try {
      const res = await fetch(`/api/trainee/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnswers(data.answers || {});
        if (data.signatureKey) setSignatureData(data.signatureKey);
        if (data.status === 'submitted') {
          setSubmitted(true);
        }
      }
    } catch {
      // Token invalid, start fresh
    }
  };

  /* ── Autosave ──────────────────────────────────────────── */
  const saveAnswers = useCallback(async () => {
    if (!cycle || Object.keys(answers).length === 0) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/trainee/cycle/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          answers,
          step: currentStep,
        }),
      });
      const data = await res.json();
      if (data.token && !token) {
        setToken(data.token);
        // Update URL with token for resume
        window.history.replaceState(null, '', `#${data.token}`);
      }
      setLastSaved(new Date());
    } catch (e) {
      console.error('Autosave failed:', e);
    } finally {
      setSaving(false);
    }
  }, [answers, cycle, slug, token, currentStep]);

  // Autosave on answer change (debounced 10s per T-10)
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (Object.keys(answers).length > 0 && !submitted) {
        saveAnswers();
      }
    }, 10000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [answers, saveAnswers, submitted]);

  /* ── Field change handler ──────────────────────────────── */
  const handleChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    // Clear validation error
    if (validationErrors[fieldId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  /* ── Field blur (autosave per T-10) ────────────────────── */
  const handleBlur = () => {
    if (!submitted) saveAnswers();
  };

  /* ── Validation ────────────────────────────────────────── */
  const validateStep = (stepIndex: number): boolean => {
    const step = steps[stepIndex];
    const errors: Record<string, string> = {};

    step.fields.forEach((fieldId) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field || !field.required) return;
      const val = answers[fieldId];
      if (!val || val.trim() === '') {
        errors[fieldId] = 'This field is required';
      }
      if (field.type === 'email' && val) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          errors[fieldId] = 'Please enter a valid email address';
        }
      }
      if (field.maxLength && val && val.length > field.maxLength) {
        errors[fieldId] = `Maximum ${field.maxLength} characters`;
      }
    });

    if (answers['t_supervisor'] === 'unassigned') {
      if (!answers['t_supervisor_other'] || answers['t_supervisor_other'].trim() === '') {
        errors['t_supervisor_other'] = 'Please specify your supervisor name and department';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /* ── Step navigation ───────────────────────────────────── */
  const nextStep = () => {
    if (!validateStep(currentStep)) return;
    saveAnswers(); // Save on step change
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo(0, 0);
  };

  const goToStep = (index: number) => {
    if (index < currentStep) {
      setCurrentStep(index);
      window.scrollTo(0, 0);
    }
  };

  /* ── Submit ────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!signatureData) {
      setValidationErrors({ t_signature: 'Please draw your signature' });
      return;
    }

    setSubmitting(true);
    try {
      // Save final answers first
      await saveAnswers();

      const res = await fetch('/api/trainee/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureDataUrl: signatureData,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Submission failed');
      }
    } catch {
      setError('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Copy token link ───────────────────────────────────── */
  const copyTokenLink = () => {
    if (!token) return;
    const link = `${window.location.origin}/a/${slug}#${token}`;
    navigator.clipboard.writeText(link);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  /* ── Get field by ID ───────────────────────────────────── */
  const getField = (id: string) => fields.find((f) => f.id === id);

  /* ── Render field ──────────────────────────────────────── */
  const renderField = (fieldId: string) => {
    const field = getField(fieldId);
    if (!field) return null;

    const value = answers[fieldId] || '';
    const err = validationErrors[fieldId];

    // Confidential notice
    const confidentialNotice = field.confidential ? (
      <div className="confidential-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Seen only by HR, not your supervisor.
      </div>
    ) : null;

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <div className="form-group" key={fieldId}>
            <label htmlFor={fieldId} className="form-label">
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            {field.helperText && <p className="form-hint">{field.helperText}</p>}
            {confidentialNotice}
            <input
              id={fieldId}
              type={field.type}
              className={`form-input ${err ? 'error' : ''}`}
              value={value}
              onChange={(e) => handleChange(fieldId, e.target.value)}
              onBlur={handleBlur}
              maxLength={field.maxLength}
              required={field.required}
            />
            {field.maxLength && (
              <div className={`form-char-count ${value.length > field.maxLength * 0.9 ? 'warning' : ''} ${value.length > field.maxLength ? 'exceeded' : ''}`}>
                {value.length} / {field.maxLength}
              </div>
            )}
            {err && <div className="form-error">{err}</div>}
          </div>
        );

      case 'select':
        // Supervisor searchable dropdown
        const filteredSupervisors = supervisors.filter(
          (s) =>
            s.name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
            s.department.toLowerCase().includes(supervisorSearch.toLowerCase())
        );
        const selectedSupervisor = supervisors.find((s) => s.id === value);
        const displayValue = showSupervisorDropdown
          ? supervisorSearch
          : value === 'unassigned'
          ? "⚠️ My supervisor isn't listed"
          : (selectedSupervisor?.name || '');

        return (
          <div className="form-group" key={fieldId}>
            <label htmlFor={fieldId} className="form-label">
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            {field.helperText && <p className="form-hint">{field.helperText}</p>}
            <div className="searchable-select" style={{ position: 'relative', zIndex: 60 }}>
              <input
                id={fieldId}
                type="text"
                className={`form-input ${err ? 'error' : ''}`}
                placeholder="Search for your supervisor..."
                value={displayValue}
                onChange={(e) => {
                  setSupervisorSearch(e.target.value);
                  setShowSupervisorDropdown(true);
                }}
                onFocus={() => {
                  setShowSupervisorDropdown(true);
                  setSupervisorSearch('');
                }}
                onClick={() => {
                  setShowSupervisorDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSupervisorDropdown(false), 250);
                }}
              />
              {showSupervisorDropdown && (
                <div
                  className="searchable-select-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.22), 0 4px 10px rgba(0, 0, 0, 0.08)',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    zIndex: 99999,
                  }}
                >
                  {filteredSupervisors.length === 0 ? (
                    <div style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.875rem', textAlign: 'center' }}>
                      No supervisors found matching &quot;{supervisorSearch}&quot;
                    </div>
                  ) : (
                    filteredSupervisors.map((s) => (
                      <div
                        key={s.id}
                        className={`searchable-select-option ${value === s.id ? 'selected' : ''}`}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                        onMouseDown={() => {
                          handleChange(fieldId, s.id);
                          setShowSupervisorDropdown(false);
                          setSupervisorSearch('');
                        }}
                      >
                        <div>
                          <strong style={{ color: '#0f172a', fontSize: '0.875rem' }}>{s.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 8 }}>{s.department}</span>
                        </div>
                        {value === s.id && (
                          <span style={{ color: '#c8102e', fontWeight: 600, fontSize: '0.75rem' }}>✓ Selected</span>
                        )}
                      </div>
                    ))
                  )}
                  <div
                    className="searchable-select-option"
                    style={{
                      padding: '12px 14px',
                      cursor: 'pointer',
                      borderTop: '1px solid #fde68a',
                      color: '#b45309',
                      background: '#fffbeb',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                    }}
                    onMouseDown={() => {
                      handleChange(fieldId, 'unassigned');
                      setShowSupervisorDropdown(false);
                      setSupervisorSearch('');
                    }}
                  >
                    ⚠️ My supervisor isn&apos;t listed
                  </div>
                </div>
              )}
            </div>
            {err && <div className="form-error">{err}</div>}

            {/* If supervisor isn't listed, show input for supervisor name & department */}
            {value === 'unassigned' && (
              <div style={{ marginTop: 12, padding: 14, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                <label className="form-label text-sm" style={{ color: '#92400e', marginBottom: 4, display: 'block' }}>
                  Specify your supervisor&apos;s name and department <span className="required">*</span>
                </label>
                <p className="text-xs text-muted" style={{ marginBottom: 8, color: '#78350f' }}>
                  HR will route this appraisal to your supervisor once submitted.
                </p>
                <input
                  type="text"
                  className={`form-input ${validationErrors['t_supervisor_other'] ? 'error' : ''}`}
                  placeholder="e.g. John Doe — Internal Audit / Lekki branch"
                  value={answers['t_supervisor_other'] || ''}
                  onChange={(e) => handleChange('t_supervisor_other', e.target.value)}
                  maxLength={120}
                />
                {validationErrors['t_supervisor_other'] && (
                  <div className="form-error" style={{ marginTop: 4 }}>{validationErrors['t_supervisor_other']}</div>
                )}
              </div>
            )}
          </div>
        );

      case 'rating':
        return (
          <div className="form-group" key={fieldId}>
            <label className="form-label" style={{ fontSize: '0.9375rem', lineHeight: 1.5 }}>
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            {confidentialNotice}
            <div className="rating-group">
              {TRAINEE_RATING_SCALE.map((opt) => (
                <div className="rating-option" key={opt.value}>
                  <input
                    type="radio"
                    id={`${fieldId}_${opt.value}`}
                    name={fieldId}
                    value={String(opt.value)}
                    checked={value === String(opt.value)}
                    onChange={(e) => handleChange(fieldId, e.target.value)}
                  />
                  <label htmlFor={`${fieldId}_${opt.value}`}>
                    <span className="rating-number">{opt.value}</span>
                    <span className="rating-label">{opt.label}</span>
                  </label>
                </div>
              ))}
            </div>
            {err && <div className="form-error">{err}</div>}
          </div>
        );

      case 'comment':
        return (
          <div className="form-group" key={fieldId} style={{ marginTop: '-0.5rem', marginBottom: '2rem' }}>
            {confidentialNotice}
            <textarea
              id={fieldId}
              className="form-textarea"
              placeholder="Add a comment (optional)..."
              value={value}
              onChange={(e) => handleChange(fieldId, e.target.value)}
              onBlur={handleBlur}
              maxLength={field.maxLength}
              rows={2}
              style={{ minHeight: 60 }}
            />
            {field.maxLength && (
              <div className={`form-char-count ${value.length > field.maxLength * 0.9 ? 'warning' : ''}`}>
                {value.length} / {field.maxLength}
              </div>
            )}
          </div>
        );

      case 'longtext':
        return (
          <div className="form-group" key={fieldId}>
            <label htmlFor={fieldId} className="form-label">
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            {field.helperText && <p className="form-hint">{field.helperText}</p>}
            {confidentialNotice}
            <textarea
              id={fieldId}
              className={`form-textarea ${err ? 'error' : ''}`}
              value={value}
              onChange={(e) => handleChange(fieldId, e.target.value)}
              onBlur={handleBlur}
              maxLength={field.maxLength}
              required={field.required}
              rows={4}
            />
            {field.maxLength && (
              <div className={`form-char-count ${value.length > field.maxLength * 0.9 ? 'warning' : ''} ${value.length > field.maxLength ? 'exceeded' : ''}`}>
                {value.length} / {field.maxLength}
              </div>
            )}
            {err && <div className="form-error">{err}</div>}
          </div>
        );

      case 'overall':
        return (
          <div className="form-group" key={fieldId}>
            <label className="form-label" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
              {field.label} {field.required && <span className="required">*</span>}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {TRAINEE_OVERALL_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`radio-option ${value === opt.value ? 'selected' : ''}`}
                  onClick={() => handleChange(fieldId, opt.value)}
                >
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${value === opt.value ? 'var(--accent)' : 'var(--border-primary)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {value === opt.value && (
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                      }} />
                    )}
                  </div>
                  <span style={{ fontWeight: value === opt.value ? 600 : 400 }}>{opt.label}</span>
                </div>
              ))}
            </div>
            {err && <div className="form-error">{err}</div>}
          </div>
        );

      default:
        return null;
    }
  };

  /* ── Render Review Step ────────────────────────────────── */
  const renderReview = () => {
    return (
      <div>
        <h3 style={{ marginBottom: 'var(--space-6)' }}>Review Your Answers</h3>
        {steps.slice(0, -2).map((step, idx) => (
          <div key={step.id} className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="card-header">
              <h4 className="card-title">{step.title}</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => goToStep(idx)}>
                Edit
              </button>
            </div>
            <div className="card-body">
              {step.fields.map((fieldId) => {
                const field = getField(fieldId);
                if (!field) return null;
                const val = answers[fieldId];
                if (field.type === 'comment' && !val) return null;

                let displayValue = val || '—';
                if (field.type === 'rating') {
                  const scale = TRAINEE_RATING_SCALE.find((s) => String(s.value) === val);
                  displayValue = scale ? `${scale.value} — ${scale.label}` : val || '—';
                }
                if (field.type === 'overall') {
                  const opt = TRAINEE_OVERALL_OPTIONS.find((o) => o.value === val);
                  displayValue = opt?.label || val || '—';
                }
                if (field.type === 'select') {
                  const sup = supervisors.find((s) => s.id === val);
                  displayValue = sup?.name || (val === 'unassigned' ? 'Not listed' : val || '—');
                }

                return (
                  <div key={fieldId} style={{ marginBottom: 'var(--space-3)' }}>
                    <div className="text-xs text-muted font-semibold" style={{ marginBottom: 2 }}>
                      {field.type === 'comment' ? 'Comment' : field.label}
                      {field.confidential && (
                        <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: '0.625rem' }}>HR ONLY</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9375rem' }}>{displayValue}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Render Signature Step ─────────────────────────────── */
  const renderSignature = () => (
    <div>
      <h3 style={{ marginBottom: 'var(--space-2)' }}>Sign Your Appraisal</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-6)' }}>
        By signing below, you confirm that the information provided is accurate and complete. 
        Your signature will appear on the printed appraisal form.
      </p>

      <div className="form-group">
        <label className="form-label">
          Management Trainee Signature <span className="required">*</span>
        </label>
        <SignaturePad onSign={setSignatureData} signatureData={signatureData} />
        {validationErrors.t_signature && (
          <div className="form-error">{validationErrors.t_signature}</div>
        )}
      </div>

      <div style={{
        padding: 'var(--space-4)',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        marginTop: 'var(--space-4)',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
      }}>
        <strong>Date:</strong> {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
        <br />
        <span className="text-xs">This date will be recorded as your submission date.</span>
      </div>
    </div>
  );

  /* ── Submitted confirmation ────────────────────────────── */
  if (submitted) {
    return (
      <div className="form-page">
        <div className="form-page-header">
          <div className="form-page-header-inner">
            <div>
              <h1>MTP Appraisal</h1>
              <p>{cycle?.name}</p>
            </div>
          </div>
        </div>
        <div className="form-page-body">
          <div className="form-page-card">
            <div className="card animate-in" style={{ textAlign: 'center', padding: 'var(--space-16) var(--space-8)' }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--success-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-6)',
              }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ marginBottom: 'var(--space-2)' }}>Submitted Successfully!</h2>
              <p className="text-muted" style={{ maxWidth: 480, margin: '0 auto var(--space-6)' }}>
                Your self-assessment has been submitted and sent to your supervisor for review. 
                You&apos;ll receive an email confirmation shortly.
              </p>

              {token && (
                <div style={{
                  padding: 'var(--space-4)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                }}>
                  <p className="text-xs text-muted" style={{ marginBottom: 'var(--space-2)' }}>
                    <strong>Your private link</strong> — bookmark this to view your submitted appraisal:
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <code className="text-xs" style={{
                      flex: 1,
                      padding: 'var(--space-2)',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {window.location.origin}/a/{slug}#{token}
                    </code>
                    <button className="btn btn-secondary btn-sm" onClick={copyTokenLink}>
                      {tokenCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted">
                When your supervisor completes their assessment and HR releases the results, 
                you&apos;ll receive an email with a link to view their feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading State ─────────────────────────────────────── */
  if (loading) {
    return (
      <div className="form-page">
        <div className="form-page-header">
          <div className="form-page-header-inner">
            <div>
              <h1>MTP Appraisal</h1>
              <p>Loading...</p>
            </div>
          </div>
        </div>
        <div className="form-page-body">
          <div className="form-page-card">
            <div className="card" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
              <div className="spinner spinner-lg" style={{ margin: '0 auto var(--space-4)' }} />
              <p className="text-muted">Loading appraisal form...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error State ───────────────────────────────────────── */
  if (error) {
    return (
      <div className="form-page">
        <div className="form-page-header">
          <div className="form-page-header-inner">
            <div>
              <h1>MTP Appraisal</h1>
            </div>
          </div>
        </div>
        <div className="form-page-body">
          <div className="form-page-card">
            <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--warning-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-4)',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Unable to Load Form</h3>
              <p className="text-muted" style={{ maxWidth: 400, margin: '0 auto' }}>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Form ─────────────────────────────────────────── */
  const step = steps[currentStep];
  const isReview = step.id === 'review';
  const isSignature = step.id === 'signature';
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="form-page">
      {/* Header */}
      <div className="form-page-header">
        <div className="form-page-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 44,
            height: 44,
            background: '#ffffff',
            borderRadius: 10,
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}>
            <img
              src="/genesis-logo.png"
              alt="Genesis Group"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <h1>{TRAINEE_V1_TITLE.replace('MANAGEMENT TRAINEE PROGRAMME (MTP) — ', '')}</h1>
            <p>{cycle?.name} • Deadline: {cycle?.traineeDeadline ? formatDate(cycle.traineeDeadline) : ''}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.12)', padding: 3, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setFormMode('steps')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: formMode === 'steps' ? 'var(--accent)' : 'transparent',
                  color: '#ffffff',
                  boxShadow: formMode === 'steps' ? '0 2px 6px rgba(255, 12, 52, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Guided Steps
              </button>
              <button
                type="button"
                onClick={() => setFormMode('paper')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  background: formMode === 'paper' ? 'var(--accent)' : 'transparent',
                  color: '#ffffff',
                  boxShadow: formMode === 'paper' ? '0 2px 6px rgba(255, 12, 52, 0.35)' : 'none',
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

            <ThemeToggle />

            {saving && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <span className="spinner spinner-sm" style={{ borderTopColor: '#fff', marginRight: 4, verticalAlign: 'middle' }} />
                Saving...
              </span>
            )}
            {!saving && lastSaved && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
                ✓ Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Render Official Paper Layout OR Guided Stepper */}
      {formMode === 'paper' ? (
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
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : '✓ Submit Appraisal'}
              </button>
            </div>
          </div>

          <OfficialTraineeDocument
            data={{
              traineeName: answers.t_name || '',
              supervisorName: supervisors.find((s) => s.id === answers.t_supervisor)?.name || answers.t_supervisor_other || '',
              staffId: answers.t_staff_id || '',
              appraisalDate: answers.t_signature_date,
              department: answers.t_department || '',
              location: answers.t_location || '',
              answers: answers,
              signatureDataUrl: signatureData,
            }}
            isInteractive={true}
            onAnswerChange={handleChange}
            onSignatureClick={() => {
              setFormMode('steps');
              goToStep(5); // Go to signature step
            }}
          />

          <div style={{ maxWidth: 820, margin: '24px auto', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ boxShadow: '0 4px 14px rgba(200, 16, 46, 0.4)' }}
            >
              {submitting ? 'Submitting Appraisal...' : 'Submit Appraisal'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="progress-bar" style={{ borderRadius: 0 }}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Stepper */}
          <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-secondary)', padding: '0 var(--space-4)' }}>
            <div className="stepper" style={{ maxWidth: 'var(--max-form)', margin: '0 auto' }}>
              {steps.map((s, idx) => (
                <div className="stepper-step" key={s.id}>
                  <div
                    className={`stepper-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
                    onClick={() => goToStep(idx)}
                    style={{ cursor: idx < currentStep ? 'pointer' : 'default' }}
                    title={s.title}
                  >
                    {idx < currentStep ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`stepper-line ${idx < currentStep ? 'completed' : ''}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Private link banner (after identity step) */}
          {token && currentStep === 1 && (
            <div style={{
              background: 'var(--info-light)',
              padding: 'var(--space-3) var(--space-4)',
              textAlign: 'center',
            }}>
              <p className="text-sm" style={{ color: 'var(--info-dark)' }}>
                📎 Your <strong>private link</strong> has been created.{' '}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--info-dark)', textDecoration: 'underline', padding: '0 4px' }}
                  onClick={copyTokenLink}
                >
                  {tokenCopied ? '✓ Copied!' : 'Copy link'}
                </button>{' '}
                to save your progress and come back later.
              </p>
            </div>
          )}

          {/* Form Body */}
          <div className="form-page-body">
            <div className="form-page-card">
              <div className="card animate-in" style={{ overflow: 'visible', position: 'relative', zIndex: 20 }}>
                <div className="card-header" style={{ background: 'var(--bg-secondary)' }}>
                  <div>
                    <h3 className="card-title">{step.title}</h3>
                    <p className="text-sm text-muted" style={{ marginTop: 2 }}>{step.subtitle}</p>
                  </div>
                  <span className="badge badge-accent">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                </div>
                <div className="card-body" style={{ padding: 'var(--space-8)', overflow: 'visible' }}>
                  {/* Purpose text on first step */}
                  {currentStep === 0 && (
                    <div className="inline-alert info" style={{ marginBottom: 'var(--space-6)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                      <div>
                        <strong style={{ display: 'block', marginBottom: 4 }}>About this appraisal</strong>
                        {TRAINEE_V1_PURPOSE}
                      </div>
                    </div>
                  )}

                  {/* Render fields for this step */}
                  {isReview ? renderReview() : isSignature ? renderSignature() : step.fields.map(renderField)}
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="form-page-footer" style={{ position: 'relative', zIndex: 1 }}>
                <button
                  className="btn btn-secondary"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                >
                  ← Back
                </button>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  {isSignature ? (
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner spinner-sm" style={{ borderTopColor: '#fff' }} />
                          Submitting...
                        </>
                      ) : (
                        'Submit Appraisal'
                      )}
                    </button>
                  ) : (
                    <button className="btn btn-primary" onClick={nextStep}>
                      Next →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
