'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

interface CompetencyStat {
  id: string;
  shortLabel: string;
  fullLabel: string;
  average: number;
  evaluatedCount: number;
  commentsCount: number;
  highPerformerPct: number;
  needsDevPct: number;
  distribution: Record<number, number>;
}

interface TraineeAreaStat {
  id: string;
  shortLabel: string;
  fullLabel: string;
  confidential: boolean;
  average: number;
  respondentCount: number;
  commentsCount: number;
  positivePct: number;
  distribution: Record<number, number>;
}

interface RecommendationStat {
  id: string;
  label: string;
  count: number;
  color: string;
}

interface DepartmentStat {
  department: string;
  total: number;
  complete: number;
  completionPct: number;
  avgSupervisorScore: number | null;
  avgTraineeScore: number | null;
  fastTrackCount: number;
  pipOrAttentionCount: number;
}

interface SupervisorPerfStat {
  supervisorId: string;
  name: string;
  staffId: string;
  department: string;
  assigned: number;
  completed: number;
  pending: number;
  completionPct: number;
  avgScoreGiven: number | null;
  avgTurnaroundDays: number | null;
}

interface TraineeAnalyticalRow {
  _id: string;
  traineeName: string;
  traineeStaffId: string;
  traineeEmail: string;
  department: string;
  location: string;
  cycleName: string;
  cohort: string;
  supervisorName: string;
  supervisorStaffId: string;
  status: string;
  flags: string[];
  traineeAvg: number | null;
  supervisorAvg: number | null;
  calibrationGap: number | null;
  traineeOverall: string | null;
  supervisorOverall: string | null;
  recommendation: string | null;
  recommendationLabel: string | null;
  traineeRatings: Record<string, number | null>;
  supervisorRatings: Record<string, number | null>;
  traineeComments: Record<string, string>;
  supervisorComments: Record<string, string>;
  keyStrengths: string[];
  improvementAreas: string;
  recommendedTraining: string;
  traineeProjects: string[];
  traineeWorkflowImprovements: string;
  traineeConfidentialFeedback: string;
  traineeResourcesNeeded: string;
  turnaroundDays: number | null;
}

export default function AdminReportAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [recFilter, setRecFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(null);

  const fetchAnalytics = async (cycleId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
      const res = await fetch(`/api/admin/analytics${query}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to load analytics report');
      }
      const json = await res.json();
      setData(json);
      if (!cycleId && json.selectedCycle?._id) {
        setSelectedCycleId(json.selectedCycle._id);
      }
    } catch (e: any) {
      setError(e.message || 'Error loading report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleCycleChange = (val: string) => {
    setSelectedCycleId(val);
    fetchAnalytics(val);
  };

  const traineeRows: TraineeAnalyticalRow[] = data?.traineeRows || [];

  const departments = useMemo(() => {
    const set = new Set<string>();
    traineeRows.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).sort();
  }, [traineeRows]);

  const filteredTrainees = useMemo(() => {
    return traineeRows.filter((r) => {
      if (deptFilter !== 'all' && r.department !== deptFilter) return false;
      if (recFilter !== 'all') {
        if (recFilter === 'pending' && r.recommendation) return false;
        if (recFilter !== 'pending' && r.recommendation !== recFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          r.traineeName.toLowerCase().includes(q) ||
          r.traineeStaffId.toLowerCase().includes(q) ||
          r.supervisorName.toLowerCase().includes(q) ||
          r.department.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [traineeRows, deptFilter, recFilter, search]);

  const kpis = data?.kpis || {};
  const supervisorCompetencies: CompetencyStat[] = data?.supervisorCompetencies || [];
  const traineeAreas: TraineeAreaStat[] = data?.traineeAreas || [];
  const recommendations: RecommendationStat[] = data?.recommendations || [];
  const overallComparison = data?.overallComparison || {};
  const departmentBreakdown: DepartmentStat[] = data?.departmentBreakdown || [];
  const supervisorBreakdown: SupervisorPerfStat[] = data?.supervisorBreakdown || [];

  const totalRecommendations = recommendations.reduce((acc, r) => acc + r.count, 0);

  const getScoreColor = (score: number | null) => {
    if (score === null || score === 0) return 'var(--text-dim)';
    if (score >= 4.2) return 'var(--success)';
    if (score >= 3.2) return 'var(--info)';
    if (score >= 2.5) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getRecBadge = (rec: string | null, label: string | null) => {
    if (!rec) {
      return <span className="gh-badge gh-badge-draft">Awaiting Supervisor</span>;
    }
    if (rec === 'confirm_promotion') {
      return <span className="gh-badge gh-badge-complete">★ Fast-Track / Confirm</span>;
    }
    if (rec === 'retain_on_track') {
      return <span className="gh-badge gh-badge-open">✓ On Track</span>;
    }
    if (rec === 'extend_probation') {
      return <span className="gh-badge gh-badge-in_review">⚠ Extend Probation (PIP)</span>;
    }
    if (rec === 'reassign_unit') {
      return <span className="gh-badge gh-badge-medium">⇄ Reassign Unit</span>;
    }
    if (rec === 'discontinue') {
      return <span className="gh-badge gh-badge-high">✕ Discontinue</span>;
    }
    return <span className="gh-badge gh-badge-none">{label || rec}</span>;
  };

  return (
    <>
      <header className="top-header no-print">
        <div>
          <h1 className="top-header-title">Report Analytics & Executive Insights</h1>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Cohort Competency Benchmarks, Self vs. Supervisor Calibration & Talent Progression
          </span>
        </div>

        <div className="top-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="gh-input"
            style={{ width: 'auto', padding: '7px 12px', fontSize: 13, fontWeight: 600 }}
          >
            <option value="all">All Assessment Cycles (Combined)</option>
            {(data?.cycles || []).map((c: any) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.cohort})
              </option>
            ))}
          </select>

          {selectedCycleId && selectedCycleId !== 'all' && (
            <a
              href={`/api/exports/excel?cycleId=${selectedCycleId}`}
              className="gh-btn gh-btn-ghost"
              style={{ fontSize: 12, padding: '8px 14px', textDecoration: 'none' }}
            >
              📊 Export Excel
            </a>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="gh-btn gh-btn-primary"
            style={{ fontSize: 12, padding: '8px 16px' }}
          >
            🖨️ Print / Save Analytics Report (PDF)
          </button>

          <ThemeToggle />
        </div>
      </header>

      <div className="page-container">
        {/* Print-only Executive Report Banner */}
        <div style={{ display: 'none' }} className="print-only-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: 12, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/genesis-logo.png" alt="Genesis Group" width={44} height={44} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>GENESIS GROUP — MTP EXECUTIVE ASSESSMENT ANALYTICS REPORT</div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  Cycle: {data?.selectedCycle ? `${data.selectedCycle.name} (${data.selectedCycle.cohort})` : 'All Cycles'} • Generated {new Date().toLocaleDateString('en-GB')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <div className="spinner spinner-lg" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Aggregating cohort ratings, supervisor evaluations, and calibration metrics...</p>
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>
            <p style={{ fontWeight: 700 }}>{error}</p>
            <button onClick={() => fetchAnalytics(selectedCycleId)} className="gh-btn gh-btn-primary" style={{ marginTop: 12 }}>
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* 1. Executive KPI Summary Grid */}
            <div className="stat-grid animate-in" style={{ marginBottom: 24 }}>
              <div className="kpi-card">
                <div className="kpi-icon-chip" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <div className="kpi-value">
                    {kpis.complete || 0} / {kpis.totalAppraisals || 0}{' '}
                    <span style={{ fontSize: 14, color: 'var(--success)' }}>({kpis.completionRatePct || 0}%)</span>
                  </div>
                  <div className="kpi-label">Evaluations Finalized</div>
                  <div className="kpi-sub">
                    {kpis.awaitingSupervisor || 0} awaiting supervisor • Avg turnaround:{' '}
                    {kpis.avgTurnaroundDays !== null ? `${kpis.avgTurnaroundDays}d` : '—'}
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-chip" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </div>
                <div>
                  <div className="kpi-value" style={{ color: getScoreColor(kpis.avgSupervisorScore) }}>
                    {kpis.avgSupervisorScore !== null ? `${kpis.avgSupervisorScore} / 5.0` : '—'}
                  </div>
                  <div className="kpi-label">Avg Supervisor Score</div>
                  <div className="kpi-sub">
                    {kpis.strongestCompetency
                      ? `Top: ${kpis.strongestCompetency.shortLabel} (${kpis.strongestCompetency.average})`
                      : 'Across 7 core competencies'}
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-chip" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <polyline points="16 11 18 13 22 9" />
                  </svg>
                </div>
                <div>
                  <div className="kpi-value" style={{ color: getScoreColor(kpis.avgTraineeScore) }}>
                    {kpis.avgTraineeScore !== null ? `${kpis.avgTraineeScore} / 5.0` : '—'}
                  </div>
                  <div className="kpi-label">Avg Trainee Self-Score</div>
                  <div className="kpi-sub">
                    Calibration gap (Self − Sup):{' '}
                    <strong>
                      {kpis.avgCalibrationGap !== null
                        ? `${kpis.avgCalibrationGap > 0 ? '+' : ''}${kpis.avgCalibrationGap}`
                        : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon-chip" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div>
                  <div className="kpi-value">
                    {kpis.fastTrackPromotionCount || 0}{' '}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>Fast-Track</span>
                  </div>
                  <div className="kpi-label">Talent Progression</div>
                  <div className="kpi-sub">
                    {kpis.onTrackCount || 0} on track • {kpis.interventionNeededCount || 0} need PIP/intervention
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Two-Column Section: 7 Supervisor Competencies & 5 Trainee Self-Assessment Areas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24, marginBottom: 24 }}>
              {/* Supervisor 7 Competencies */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Supervisor 7-Competency Performance Analysis</h3>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Mean score (1–5 scale), % scoring 4+ (Exceeds/Exceptional), and rating distribution
                    </p>
                  </div>
                  <span className="gh-badge gh-badge-open">1–5 Scale</span>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {supervisorCompetencies.map((comp) => {
                    const pctWidth = Math.min(100, Math.round((comp.average / 5) * 100));
                    return (
                      <div key={comp.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                              {comp.shortLabel}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{comp.fullLabel}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: getScoreColor(comp.average) }}>
                              {comp.evaluatedCount > 0 ? comp.average.toFixed(2) : '—'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
                              ({comp.highPerformerPct}% ≥ 4★ • {comp.commentsCount} comments)
                            </span>
                          </div>
                        </div>

                        {/* Score bar */}
                        <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div
                            style={{
                              width: `${pctWidth}%`,
                              height: '100%',
                              background: getScoreColor(comp.average),
                              borderRadius: 999,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>

                        {/* Mini 1-5 distribution pills */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                          {[5, 4, 3, 2, 1].map((star) => (
                            <span key={star} style={{ background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                              {star}★: <strong style={{ color: 'var(--text)' }}>{comp.distribution[star] || 0}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trainee 5 Onboarding & Self-Assessment Areas + Career Recommendations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">Trainee Onboarding & Self-Assessment Index</h3>
                      <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                        Measures onboarding transition, KPI clarity, classroom training & unit satisfaction
                      </p>
                    </div>
                    <span className="gh-badge gh-badge-complete">Trainee Voice</span>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {traineeAreas.map((area) => {
                      const pctWidth = Math.min(100, Math.round((area.average / 5) * 100));
                      return (
                        <div key={area.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                                {area.shortLabel}
                              </span>
                              {area.confidential && (
                                <span className="gh-badge gh-badge-in_review" style={{ fontSize: 10, padding: '1px 6px' }}>
                                  HR Confidential
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-mono)', color: getScoreColor(area.average) }}>
                                {area.respondentCount > 0 ? area.average.toFixed(2) : '—'}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 6 }}>
                                ({area.positivePct}% Agree/Strongly Agree)
                              </span>
                            </div>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div
                              style={{
                                width: `${pctWidth}%`,
                                height: '100%',
                                background: getScoreColor(area.average),
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Official Career Status Recommendations Breakdown */}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">Supervisor Career Recommendations</h3>
                      <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                        Distribution of official post-assessment progression decisions
                      </p>
                    </div>
                    <span className="gh-badge gh-badge-draft">{totalRecommendations} Decided</span>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recommendations.map((rec) => {
                      const pct = totalRecommendations > 0 ? Math.round((rec.count / totalRecommendations) * 100) : 0;
                      return (
                        <div key={rec.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                            <span style={{ color: 'var(--text)' }}>{rec.label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              <strong>{rec.count}</strong> ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: rec.color,
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Overall Rating Calibration (Supervisor vs Trainee) & Department Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24, marginBottom: 24 }}>
              {/* Overall Tier Comparison */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Overall Rating Calibration (Trainee vs. Supervisor)</h3>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Compares overall self-rating distribution against supervisor overall performance ratings
                    </p>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(['tier5', 'tier4', 'tier3', 'tier2', 'tier1'] as const).map((tierKey) => {
                    const row = overallComparison[tierKey] || { label: tierKey, supervisor: 0, trainee: 0 };
                    const maxCount = Math.max(1, kpis.totalAppraisals || 1);
                    const supPct = Math.round((row.supervisor / maxCount) * 100);
                    const trPct = Math.round((row.trainee / maxCount) * 100);
                    return (
                      <div key={tierKey} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                          <span>{row.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>
                            Supervisor: <strong style={{ color: 'var(--accent)' }}>{row.supervisor}</strong> • Trainee:{' '}
                            <strong style={{ color: 'var(--info)' }}>{row.trainee}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, width: 64, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Supervisor</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${supPct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, width: 64, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Trainee</span>
                            <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${trPct}%`, height: '100%', background: 'var(--info)', borderRadius: 999 }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department & Business Unit Leaderboard */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">Department & Business Unit Analytics</h3>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                      Completion rates, mean competency scores, and progression outcomes by business unit
                    </p>
                  </div>
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Trainees</th>
                        <th>Completed</th>
                        <th>Sup. Avg</th>
                        <th>Self Avg</th>
                        <th>Fast-Track</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departmentBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                            No department records available
                          </td>
                        </tr>
                      ) : (
                        departmentBreakdown.map((d) => (
                          <tr key={d.department}>
                            <td style={{ fontWeight: 700, color: 'var(--text)' }}>{d.department}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{d.total}</td>
                            <td>
                              <span className="gh-badge gh-badge-complete">{d.completionPct}%</span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: getScoreColor(d.avgSupervisorScore) }}>
                              {d.avgSupervisorScore !== null ? d.avgSupervisorScore.toFixed(2) : '—'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                              {d.avgTraineeScore !== null ? d.avgTraineeScore.toFixed(2) : '—'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {d.fastTrackCount > 0 ? (
                                <span className="gh-badge gh-badge-complete">{d.fastTrackCount} ★</span>
                              ) : (
                                '0'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 4. Supervisor Assessment Turnaround & Scoring Calibration */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">Supervisor Evaluation Completion & Scoring Calibration</h3>
                  <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Tracks supervisor workload, completion rate, average score awarded, and review turnaround speed
                  </p>
                </div>
              </div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Supervisor</th>
                      <th>Department</th>
                      <th>Assigned</th>
                      <th>Completed</th>
                      <th>Pending</th>
                      <th>Completion %</th>
                      <th>Avg Score Given</th>
                      <th>Avg Turnaround</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisorBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>
                          No supervisor assignments recorded for this selection
                        </td>
                      </tr>
                    ) : (
                      supervisorBreakdown.map((s) => (
                        <tr key={s.supervisorId}>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{s.staffId}</div>
                          </td>
                          <td>{s.department}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{s.assigned}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 700 }}>{s.completed}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: s.pending > 0 ? 'var(--warning)' : 'var(--text-dim)', fontWeight: 700 }}>
                            {s.pending}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 130 }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div className="progress-bar-fill" style={{ width: `${s.completionPct}%` }} />
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{s.completionPct}%</span>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: getScoreColor(s.avgScoreGiven) }}>
                            {s.avgScoreGiven !== null ? `${s.avgScoreGiven.toFixed(2)} / 5.0` : '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {s.avgTurnaroundDays !== null ? `${s.avgTurnaroundDays} days` : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. Individual Trainee Report Scorecard & Qualitative Analysis Explorer */}
            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 className="card-title">Individual Trainee Scorecard & Qualitative Report Analysis</h3>
                  <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Click any trainee row to inspect full competency breakdowns, supervisor comments, strengths, L&amp;D needs &amp; confidential HR feedback
                  </p>
                </div>

                <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search trainee, staff ID, supervisor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="gh-input"
                    style={{ width: 230, padding: '7px 12px', fontSize: 12 }}
                  />

                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="gh-input"
                    style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <select
                    value={recFilter}
                    onChange={(e) => setRecFilter(e.target.value)}
                    className="gh-input"
                    style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}
                  >
                    <option value="all">All Recommendations</option>
                    <option value="confirm_promotion">Fast-Track / Confirm</option>
                    <option value="retain_on_track">On Track</option>
                    <option value="extend_probation">Extend Probation (PIP)</option>
                    <option value="reassign_unit">Reassign Unit</option>
                    <option value="discontinue">Discontinue</option>
                    <option value="pending">Pending Decision</option>
                  </select>
                </div>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trainee</th>
                      <th>Unit &amp; Location</th>
                      <th>Supervisor</th>
                      <th>Self Avg (1–5)</th>
                      <th>Sup. Avg (1–5)</th>
                      <th>Gap</th>
                      <th>Overall Rating</th>
                      <th>Recommendation</th>
                      <th className="no-print" style={{ textAlign: 'right' }}>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrainees.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--text-dim)' }}>
                          No trainee report records match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTrainees.flatMap((row) => {
                        const isExpanded = expandedTraineeId === row._id;
                        const mainRow = (
                          <tr
                            key={row._id}
                            onClick={() => setExpandedTraineeId(isExpanded ? null : row._id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                                {isExpanded ? '▼ ' : '▶ '}
                                {row.traineeName}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                {row.traineeStaffId}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{row.department}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{row.location}</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{row.supervisorName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                {row.supervisorStaffId}
                              </div>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: getScoreColor(row.traineeAvg) }}>
                              {row.traineeAvg !== null ? row.traineeAvg.toFixed(2) : '—'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: getScoreColor(row.supervisorAvg) }}>
                              {row.supervisorAvg !== null ? row.supervisorAvg.toFixed(2) : '—'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {row.calibrationGap !== null ? (
                                <span
                                  style={{
                                    color:
                                      Math.abs(row.calibrationGap) <= 0.5
                                        ? 'var(--success)'
                                        : row.calibrationGap > 0.5
                                        ? 'var(--warning)'
                                        : 'var(--info)',
                                    fontWeight: 700,
                                  }}
                                >
                                  {row.calibrationGap > 0 ? `+${row.calibrationGap}` : row.calibrationGap}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: 12 }}>
                              {row.supervisorOverall ? String(row.supervisorOverall).replace(/_/g, ' ') : '—'}
                            </td>
                            <td>{getRecBadge(row.recommendation, row.recommendationLabel)}</td>
                            <td className="no-print" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/admin/print/${row._id}`}
                                className="gh-btn gh-btn-ghost"
                                style={{ padding: '5px 10px', fontSize: 11, textDecoration: 'none' }}
                              >
                                🖨️ Official Form
                              </Link>
                            </td>
                          </tr>
                        );

                        if (!isExpanded) return [mainRow];

                        const detailRow = (
                          <tr key={`${row._id}_details`} style={{ background: 'var(--bg-3)' }}>
                            <td colSpan={9} style={{ padding: 20 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
                                {/* Left: Supervisor Competency Scores & Comments */}
                                <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Supervisor Competency Scores &amp; Comments
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {supervisorCompetencies.map((comp) => {
                                      const rScore = row.supervisorRatings[comp.id];
                                      const cText = row.supervisorComments[comp.id];
                                      return (
                                        <div key={comp.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                                            <span>{comp.shortLabel}</span>
                                            <span style={{ fontFamily: 'var(--font-mono)', color: getScoreColor(rScore) }}>
                                              {rScore !== null && rScore !== undefined ? `${rScore} / 5` : '—'}
                                            </span>
                                          </div>
                                          {cText && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                                              &ldquo;{cText}&rdquo;
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Right: Qualitative Highlights (Strengths, Development, L&D, Confidential Trainee Feedback) */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                  <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', marginBottom: 8 }}>
                                      Supervisor Qualitative Report
                                    </div>
                                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                                      <strong>Key Strengths:</strong>
                                      {row.keyStrengths.length > 0 ? (
                                        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                                          {row.keyStrengths.map((s, idx) => (
                                            <li key={idx}>{s}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>Not recorded</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                                      <strong>Areas for Improvement:</strong>{' '}
                                      <span style={{ color: 'var(--text-muted)' }}>{row.improvementAreas || '—'}</span>
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                      <strong>Recommended L&amp;D Training:</strong>{' '}
                                      <span style={{ color: 'var(--text-muted)' }}>{row.recommendedTraining || '—'}</span>
                                    </div>
                                  </div>

                                  <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--info)', textTransform: 'uppercase', marginBottom: 8 }}>
                                      Trainee Self-Assessment &amp; HR Confidential Notes
                                    </div>
                                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                                      <strong>Key Projects Delivered:</strong>
                                      {row.traineeProjects.length > 0 ? (
                                        <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                                          {row.traineeProjects.map((p, idx) => (
                                            <li key={idx}>{p}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>—</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                                      <strong>Unit &amp; Manager Rating (Confidential t_r4):</strong>{' '}
                                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                        {row.traineeRatings.t_r4 ?? '—'} / 5
                                      </span>
                                      {row.traineeComments.t_r4 && (
                                        <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                                          &ldquo;{row.traineeComments.t_r4}&rdquo;
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12 }}>
                                      <strong>What Supervisor/Unit Can Do Differently (Confidential t_q3):</strong>{' '}
                                      <span style={{ color: 'var(--text-muted)' }}>
                                        {row.traineeConfidentialFeedback || '—'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );

                        return [mainRow, detailRow];
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @media print {
          .print-only-header {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}
