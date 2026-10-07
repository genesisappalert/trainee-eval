'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface CycleSummary {
  _id: string;
  name: string;
  slug: string;
  cohort: string;
  status: string;
  opensAt: string;
  traineeDeadline: string;
  supervisorDeadline: string;
  stats: {
    total: number;
    notStarted: number;
    traineeDraft: number;
    awaitingSupervisor: number;
    supervisorDraft: number;
    complete: number;
    flagged: number;
  };
}

interface DashboardData {
  cycles: CycleSummary[];
  totalSupervisors: number;
  totalAppraisals: number;
  recentActivity: {
    action: string;
    entity: string;
    at: string;
    actorId: string;
  }[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: 'gh-badge-draft', label: 'Draft' },
    open: { cls: 'gh-badge-open', label: 'Open' },
    closed: { cls: 'gh-badge-in_review', label: 'Closed' },
    archived: { cls: 'gh-badge-none', label: 'Archived' },
  };
  const s = map[status] || { cls: 'gh-badge-draft', label: status };
  return (
    <span className={`gh-badge ${s.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {s.label}
    </span>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error('Error fetching dashboard:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Placeholder data for when API isn't connected
  const activeCycles = data?.cycles.filter((c) => c.status === 'open') || [];
  const totalComplete = data?.cycles.reduce((acc, c) => acc + (c.stats?.complete || 0), 0) || 0;
  const totalFlagged = data?.cycles.reduce((acc, c) => acc + (c.stats?.flagged || 0), 0) || 0;

  return (
    <>
      <header className="top-header">
        <div>
          <h1 className="top-header-title">Dashboard</h1>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            MTP Overview & Live Pipeline
          </span>
        </div>
        <div className="top-header-actions">
          <ThemeToggle />
          <Link href="/admin/cycles/new" className="gh-btn gh-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Cycle
          </Link>
        </div>
      </header>

      <div className="page-container">
        {/* Stats inspired by Genesis Feedback */}
        <div className="stat-grid animate-in">
          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : activeCycles.length}</div>
              <div className="kpi-label">Active Cycles</div>
              <div className="kpi-sub">Ongoing assessments</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : (data?.totalSupervisors || 0)}</div>
              <div className="kpi-label">Supervisors</div>
              <div className="kpi-sub">Assigned assessors</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : totalComplete}</div>
              <div className="kpi-label">Completed</div>
              <div className="kpi-sub">Evaluations finalized</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <div className="kpi-value" style={{ color: totalFlagged > 0 ? 'var(--warning)' : undefined }}>
                {loading ? '—' : totalFlagged}
              </div>
              <div className="kpi-label">Flagged Issues</div>
              <div className="kpi-sub">Requires HR review</div>
            </div>
          </div>
        </div>

        {/* Active Cycles */}
        <div className="card animate-in animate-in-delay-1" style={{ marginTop: 'var(--space-6)' }}>
          <div className="card-header">
            <h3 className="card-title">Assessment Cycles</h3>
            <Link href="/admin/cycles" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cycle Name</th>
                  <th>Cohort</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : data?.cycles && data.cycles.length > 0 ? (
                  data.cycles.map((cycle) => {
                    const total = cycle.stats?.total || 0;
                    const complete = cycle.stats?.complete || 0;
                    const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

                    return (
                      <tr key={cycle._id}>
                        <td>
                          <div className="font-semibold">{cycle.name}</div>
                        </td>
                        <td className="text-muted">{cycle.cohort}</td>
                        <td><StatusBadge status={cycle.status} /></td>
                        <td className="text-sm text-muted">
                          {formatDate(cycle.traineeDeadline)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 120 }}>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted">{pct}%</span>
                          </div>
                        </td>
                        <td>
                          <Link
                            href={`/admin/cycles/${cycle._id}/tracker`}
                            className="btn btn-ghost btn-sm"
                          >
                            Tracker →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                        <div className="empty-state-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <div className="empty-state-title">No cycles yet</div>
                        <div className="empty-state-text">
                          Create your first assessment cycle to get started.
                        </div>
                        <Link href="/admin/cycles/new" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
                          Create Cycle
                        </Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-6)',
        }} className="animate-in animate-in-delay-2">
          <div className="card" style={{ cursor: 'pointer' }}>
            <Link href="/admin/supervisors" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--info-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--info)',
                  flexShrink: 0,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Manage Supervisors</div>
                  <div className="text-sm text-muted">Add, edit, or upload supervisors via CSV</div>
                </div>
              </div>
            </Link>
          </div>

          <div className="card" style={{ cursor: 'pointer' }}>
            <Link href="/admin/exports" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--success-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--success)',
                  flexShrink: 0,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Export & Print</div>
                  <div className="text-sm text-muted">Download PDFs, .docx, or Excel reports</div>
                </div>
              </div>
            </Link>
          </div>

          <div className="card" style={{ cursor: 'pointer' }}>
            <Link href="/admin/audit" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--warning-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--warning)',
                  flexShrink: 0,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Audit Log</div>
                  <div className="text-sm text-muted">View all actions and changes</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
