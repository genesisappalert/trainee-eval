'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TraineeItem {
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
  daysOutstanding: number;
}

interface QueueData {
  currentCycle: {
    _id: string;
    name: string;
    slug: string;
    cohort: string;
    supervisorDeadline: string;
    status: string;
  } | null;
  allCycles: Array<{ _id: string; name: string; slug: string; status: string }>;
  stats: {
    total: number;
    pending: number;
    drafts: number;
    complete: number;
  };
  trainees: TraineeItem[];
  user: {
    name: string;
    staffId: string;
    department: string;
  };
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'drafts' | 'complete'>('all');
  const [search, setSearch] = useState('');

  // Reassignment Modal State
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedTrainee, setSelectedTrainee] = useState<TraineeItem | null>(null);
  const [reassignReason, setReassignReason] = useState('wrong_dept');
  const [reassignComments, setReassignComments] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  const fetchQueue = async (cycleSlug?: string) => {
    try {
      setLoading(true);
      const url = cycleSlug ? `/api/supervisor/queue?cycle=${cycleSlug}` : '/api/supervisor/queue';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load queue data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleOpenReassign = (trainee: TraineeItem) => {
    setSelectedTrainee(trainee);
    setReassignReason('wrong_dept');
    setReassignComments('');
    setReassignModalOpen(true);
  };

  const handleSubmitReassign = async () => {
    if (!selectedTrainee) return;
    try {
      setReassignSubmitting(true);
      const res = await fetch('/api/supervisor/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appraisalId: selectedTrainee._id,
          reason: reassignReason,
          comments: reassignComments,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit reassignment request');
      }

      setReassignModalOpen(false);
      fetchQueue();
    } catch (err: any) {
      alert(err.message || 'Error submitting reassignment');
    } finally {
      setReassignSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#002147', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading assessment queue...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 800, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Unable to load dashboard</h2>
        <p style={{ color: '#64748b', marginTop: 8 }}>{error || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => fetchQueue()}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            background: '#002147',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  const { currentCycle, stats, trainees } = data;

  // Filter trainees
  const filteredTrainees = trainees.filter((t) => {
    // Status filter
    if (filter === 'pending' && t.status !== 'awaiting_supervisor') return false;
    if (filter === 'drafts' && t.status !== 'supervisor_draft') return false;
    if (filter === 'complete' && t.status !== 'complete' && t.status !== 'printed') return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = t.traineeName.toLowerCase().includes(q);
      const matchStaff = t.traineeStaffId.toLowerCase().includes(q);
      const matchDept = t.department.toLowerCase().includes(q);
      if (!matchName && !matchStaff && !matchDept) return false;
    }

    return true;
  });

  const getStatusBadge = (status: string, flags: string[]) => {
    if (flags.includes('needs_reassignment')) {
      return (
        <span className="gh-badge gh-badge-high">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          Reassign Req.
        </span>
      );
    }
    switch (status) {
      case 'awaiting_supervisor':
        return (
          <span className="gh-badge gh-badge-in_review">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            Action Required
          </span>
        );
      case 'supervisor_draft':
        return (
          <span className="gh-badge gh-badge-open">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            Draft
          </span>
        );
      case 'complete':
      case 'printed':
        return (
          <span className="gh-badge gh-badge-complete">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            Completed
          </span>
        );
      case 'trainee_draft':
        return (
          <span className="gh-badge gh-badge-draft">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            Trainee Draft
          </span>
        );
      default:
        return (
          <span className="gh-badge gh-badge-none">
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
      {/* Top Banner with Cycle Context */}
      <div style={{
        background: 'linear-gradient(135deg, #14080B 0%, #0A0204 100%)',
        border: '1px solid rgba(255, 12, 52, 0.25)',
        borderRadius: 16,
        padding: '24px 28px',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        marginBottom: 28,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, marginBottom: 8, border: '1px solid var(--accent-border)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            ACTIVE ASSESSMENT CYCLE
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#fff' }}>
            {currentCycle?.name || 'Management Trainee Assessment Cycle'}
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            Cohort: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{currentCycle?.cohort || '2026'}</strong> • Supervisor Deadline:{' '}
            <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
              {currentCycle?.supervisorDeadline ? new Date(currentCycle.supervisorDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending'}
            </strong>
          </p>
        </div>

        {/* Cycle Switcher if multiple */}
        {data.allCycles.length > 1 && (
          <div>
            <select
              value={currentCycle?.slug || ''}
              onChange={(e) => fetchQueue(e.target.value)}
              className="gh-input"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {data.allCycles.map((c) => (
                <option key={c._id} value={c.slug} style={{ color: '#000' }}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="stat-grid animate-in" style={{ marginBottom: 28 }}>
        <div className="kpi-card" onClick={() => setFilter('all')}>
          <div className="kpi-icon-chip" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="kpi-value">{stats.total}</div>
            <div className="kpi-label">Total Assigned</div>
            <div className="kpi-sub">Trainees in queue</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setFilter('pending')} style={{ borderLeft: stats.pending > 0 ? '3px solid var(--warning)' : undefined }}>
          <div className="kpi-icon-chip" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <div className="kpi-value" style={{ color: stats.pending > 0 ? 'var(--warning)' : undefined }}>
              {stats.pending}
            </div>
            <div className="kpi-label">Action Required</div>
            <div className="kpi-sub">Awaiting your evaluation</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setFilter('drafts')}>
          <div className="kpi-icon-chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div>
            <div className="kpi-value">{stats.drafts}</div>
            <div className="kpi-label">Drafts Saved</div>
            <div className="kpi-sub">Partially completed</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => setFilter('complete')}>
          <div className="kpi-icon-chip" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div className="kpi-value">{stats.complete}</div>
            <div className="kpi-label">Completed</div>
            <div className="kpi-sub">Finalized submissions</div>
          </div>
        </div>
      </div>

      {/* Trainee Queue Header & Filters */}
      <div className="gh-card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              Assigned Management Trainees
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
              Select a trainee to review their self-assessment and submit your supervisor assessment.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search name, ID, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="gh-input"
              style={{
                minWidth: 240,
                width: 'auto',
                padding: '7px 12px',
                fontSize: 13,
              }}
            />

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, gap: 2 }}>
              <button
                onClick={() => setFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: filter === 'all' ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: filter === 'all' ? 'var(--shadow-sm)' : 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                }}
              >
                All ({trainees.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === 'pending' ? 'var(--bg-card)' : 'transparent',
                  color: filter === 'pending' ? 'var(--warning)' : 'var(--text-muted)',
                  boxShadow: filter === 'pending' ? 'var(--shadow-sm)' : 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                }}
              >
                Action Required ({stats.pending})
              </button>
              <button
                onClick={() => setFilter('drafts')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === 'drafts' ? 'var(--bg-card)' : 'transparent',
                  color: filter === 'drafts' ? 'var(--info)' : 'var(--text-muted)',
                  boxShadow: filter === 'drafts' ? 'var(--shadow-sm)' : 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                }}
              >
                Drafts ({stats.drafts})
              </button>
              <button
                onClick={() => setFilter('complete')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: filter === 'complete' ? 'var(--bg-card)' : 'transparent',
                  color: filter === 'complete' ? 'var(--success)' : 'var(--text-muted)',
                  boxShadow: filter === 'complete' ? 'var(--shadow-sm)' : 'none',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s ease',
                }}
              >
                Completed ({stats.complete})
              </button>
            </div>
          </div>
        </div>

        {/* Trainee Queue Table */}
        {filteredTrainees.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>No trainees found</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {search ? 'Try clearing your search filters.' : 'No trainees match this category.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <th style={{ padding: '14px 24px' }}>Trainee Name</th>
                  <th style={{ padding: '14px 20px', fontFamily: 'var(--font-mono)' }}>Staff ID</th>
                  <th style={{ padding: '14px 20px' }}>Department & Location</th>
                  <th style={{ padding: '14px 20px' }}>Submitted Date</th>
                  <th style={{ padding: '14px 20px' }}>Status</th>
                  <th style={{ padding: '14px 20px' }}>Days Outstanding</th>
                  <th style={{ padding: '14px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrainees.map((trainee) => (
                  <tr
                    key={trainee._id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text)' }}>
                      {trainee.traineeName}
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>{trainee.traineeEmail}</div>
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {trainee.traineeStaffId}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: 500 }}>{trainee.department || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{trainee.location || '—'}</div>
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {trainee.traineeSubmittedAt
                        ? new Date(trainee.traineeSubmittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {getStatusBadge(trainee.status, trainee.flags)}
                    </td>
                    <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)' }}>
                      {trainee.status === 'awaiting_supervisor' || trainee.status === 'supervisor_draft' ? (
                        <span style={{
                          fontWeight: 700,
                          color: trainee.daysOutstanding >= 7 ? 'var(--danger)' : trainee.daysOutstanding >= 3 ? 'var(--warning)' : 'var(--success)'
                        }}>
                          {trainee.daysOutstanding} {trainee.daysOutstanding === 1 ? 'day' : 'days'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        {trainee.status === 'awaiting_supervisor' && (
                          <Link
                            href={`/supervisor/assess/${trainee._id}`}
                            className="gh-btn gh-btn-primary"
                            style={{ padding: '6px 14px', fontSize: 12 }}
                          >
                            Assess Trainee →
                          </Link>
                        )}

                        {trainee.status === 'supervisor_draft' && (
                          <Link
                            href={`/supervisor/assess/${trainee._id}`}
                            className="gh-btn gh-btn-soft"
                            style={{ padding: '6px 14px', fontSize: 12 }}
                          >
                            Continue Draft →
                          </Link>
                        )}

                        {(trainee.status === 'complete' || trainee.status === 'printed') && (
                          <Link
                            href={`/supervisor/assess/${trainee._id}`}
                            className="gh-btn gh-btn-ghost"
                            style={{ padding: '6px 14px', fontSize: 12 }}
                          >
                            View Record
                          </Link>
                        )}

                        {/* Not my trainee action */}
                        {trainee.status !== 'complete' && !trainee.flags.includes('needs_reassignment') && (
                          <button
                            onClick={() => handleOpenReassign(trainee)}
                            title="Flag if this is not your trainee"
                            className="gh-btn gh-btn-ghost"
                            style={{
                              color: 'var(--text-dim)',
                              fontSize: 11,
                              padding: '5px 8px',
                            }}
                          >
                            Not Mine
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* "Not My Trainee" Reassignment Modal Dialog */}
      {reassignModalOpen && selectedTrainee && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            maxWidth: 500,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Reassign Assessment Request
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
              You are flagging that <strong>{selectedTrainee.traineeName}</strong> ({selectedTrainee.traineeStaffId}) should not be assessed by you. HR will review and reallocate this record.
            </p>

            <div style={{ marginTop: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                Reason for Reassignment:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { value: 'wrong_dept', label: 'Trainee belongs to another department or unit' },
                  { value: 'rotated_out', label: 'Trainee was rotated out before this assessment cycle' },
                  { value: 'not_direct_supervisor', label: 'I was not their primary supervising manager' },
                  { value: 'other', label: 'Other circumstance' },
                ].map((opt) => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="reassign_reason"
                      value={opt.value}
                      checked={reassignReason === opt.value}
                      onChange={(e) => setReassignReason(e.target.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                Additional Notes for HR (Optional):
              </label>
              <textarea
                rows={3}
                placeholder="Mention correct supervisor if known (e.g. 'Should be assigned to Mr. Tunde in Supply Chain')..."
                value={reassignComments}
                onChange={(e) => setReassignComments(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setReassignModalOpen(false)}
                disabled={reassignSubmitting}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReassign}
                disabled={reassignSubmitting}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {reassignSubmitting ? 'Submitting...' : 'Flag for Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
