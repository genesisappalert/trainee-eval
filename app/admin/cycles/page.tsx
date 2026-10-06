'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CycleItem {
  _id: string;
  name: string;
  slug: string;
  cohort: string;
  status: 'draft' | 'open' | 'closed' | 'archived';
  opensAt: string;
  traineeDeadline: string;
  supervisorDeadline: string;
  supervisorCount: number;
  stats: {
    total: number;
    awaitingSupervisor: number;
    complete: number;
    flagged: number;
  };
}

export default function AdminCyclesPage() {
  const [cycles, setCycles] = useState<CycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cycles');
      if (!res.ok) throw new Error('Failed to load cycles');
      const data = await res.json();
      setCycles(data.cycles || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
            ● Open (Active)
          </span>
        );
      case 'draft':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            Draft
          </span>
        );
      case 'closed':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
            Closed
          </span>
        );
      case 'archived':
        return (
          <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#e2e8f0', color: '#64748b' }}>
            Archived
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#002147', margin: 0, letterSpacing: '-0.02em' }}>
            Appraisal Cycles Management
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Create and oversee periodic appraisal cohorts, set submission deadlines, and monitor real-time completion.
          </p>
        </div>

        <Link
          href="/admin/cycles/new"
          style={{
            background: 'linear-gradient(135deg, #002147 0%, #0a3161 100%)',
            color: '#fff',
            padding: '11px 22px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(0, 33, 71, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          + Create New Cycle
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#002147', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 16, color: '#64748b', fontSize: 14 }}>Loading cycles...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>
      ) : cycles.length === 0 ? (
        <div style={{ background: '#fff', padding: 60, borderRadius: 16, textAlign: 'center', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>No appraisal cycles found</h3>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            Click "+ Create New Cycle" or run the seed data to create the initial cohort.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24 }}>
          {cycles.map((cycle) => {
            const completionPercent = cycle.stats.total > 0
              ? Math.round((cycle.stats.complete / cycle.stats.total) * 100)
              : 0;

            return (
              <div
                key={cycle._id}
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    {getStatusBadge(cycle.status)}
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      Cohort: {cycle.cohort}
                    </span>
                  </div>

                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#002147', margin: 0 }}>
                    {cycle.name}
                  </h2>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
                    Slug: /a/{cycle.slug}
                  </div>

                  {/* Deadlines Grid */}
                  <div style={{
                    marginTop: 20,
                    padding: 14,
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px solid #f1f5f9',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    fontSize: 12,
                  }}>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: 600 }}>Trainee Deadline:</div>
                      <div style={{ color: '#0f172a', fontWeight: 700, marginTop: 2 }}>
                        {new Date(cycle.traineeDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontWeight: 600 }}>Supervisor Deadline:</div>
                      <div style={{ color: '#0f172a', fontWeight: 700, marginTop: 2 }}>
                        {new Date(cycle.supervisorDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      <span style={{ color: '#334155' }}>
                        {cycle.stats.complete} of {cycle.stats.total} Appraisals Completed
                      </span>
                      <span style={{ color: '#002147', fontWeight: 700 }}>{completionPercent}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${completionPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #002147 0%, #16a34a 100%)',
                          borderRadius: 4,
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: '#64748b' }}>
                      <span>⏳ Awaiting Supervisor: <strong>{cycle.stats.awaitingSupervisor}</strong></span>
                      {cycle.stats.flagged > 0 && (
                        <span style={{ color: '#dc2626' }}>
                          ⚠️ Flagged: <strong>{cycle.stats.flagged}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                  <Link
                    href={`/admin/cycles/${cycle._id}`}
                    style={{ fontSize: 13, color: '#475569', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Edit & Settings →
                  </Link>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link
                      href={`/admin/cycles/${cycle._id}/tracker`}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 6,
                        background: '#002147',
                        color: '#fff',
                        textDecoration: 'none',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      Open HR Tracker →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
