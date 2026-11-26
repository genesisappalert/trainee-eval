'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CycleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [cycle, setCycle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [status, setStatus] = useState('open');
  const [traineeDeadline, setTraineeDeadline] = useState('');
  const [supervisorDeadline, setSupervisorDeadline] = useState('');
  const [resultsReleased, setResultsReleased] = useState(false);

  useEffect(() => {
    async function fetchCycle() {
      try {
        setLoading(true);
        const res = await fetch(`/api/cycles/${id}`);
        if (!res.ok) throw new Error('Failed to load cycle');
        const data = await res.json();
        setCycle(data.cycle);
        setStatus(data.cycle.status);
        setTraineeDeadline(new Date(data.cycle.traineeDeadline).toISOString().split('T')[0]);
        setSupervisorDeadline(new Date(data.cycle.supervisorDeadline).toISOString().split('T')[0]);
        setResultsReleased(data.cycle.resultsReleased || false);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchCycle();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(`/api/cycles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          traineeDeadline,
          supervisorDeadline,
          resultsReleased,
        }),
      });

      if (!res.ok) throw new Error('Failed to update cycle');
      alert('Cycle settings saved successfully!');
      router.push('/admin/cycles');
    } catch (err: any) {
      alert(err.message || 'Error updating cycle');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <p>Loading cycle configuration...</p>
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#dc2626' }}>{error || 'Cycle not found'}</p>
        <Link href="/admin/cycles">Back to cycles</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href="/admin/cycles" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Cycles
          </Link>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: '8px 0 0 0' }}>
            {cycle.name}
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '4px 0 0 0' }}>
            Cohort: <strong style={{ color: 'var(--text)' }}>{cycle.cohort}</strong> • Public URL: <span style={{ fontFamily: 'var(--font-mono)' }}>/a/{cycle.slug}</span>
          </p>
        </div>

        <Link
          href={`/admin/cycles/${cycle._id}/tracker`}
          className="gh-btn gh-btn-primary"
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          View Live HR Tracker →
        </Link>
      </div>

      <form onSubmit={handleSave} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 32, boxShadow: 'var(--shadow)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px 0' }}>
          Cycle Status & Submission Deadlines
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Cycle State */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              Cycle Lifecycle State:
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { val: 'draft', label: 'Draft (Not open yet)' },
                { val: 'open', label: 'Open (Accepting submissions)' },
                { val: 'closed', label: 'Closed (Submissions locked)' },
                { val: 'archived', label: 'Archived (Historical read-only)' },
              ].map((opt) => (
                <label
                  key={opt.val}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: status === opt.val ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: status === opt.val ? 'var(--accent-dim)' : 'var(--bg)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    checked={status === opt.val}
                    onChange={() => setStatus(opt.val)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Extend Deadlines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Trainee Submission Deadline:
              </label>
              <input
                type="date"
                required
                value={traineeDeadline}
                onChange={(e) => setTraineeDeadline(e.target.value)}
                className="gh-input"
              />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Trainees cannot submit after this date unless cycle is open or extended.
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Supervisor Review Deadline:
              </label>
              <input
                type="date"
                required
                value={supervisorDeadline}
                onChange={(e) => setSupervisorDeadline(e.target.value)}
                className="gh-input"
              />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                Target completion date for supervisor assessments.
              </div>
            </div>
          </div>

          {/* Release Results Toggle */}
          <div style={{ background: 'var(--bg-3)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={resultsReleased}
                onChange={(e) => setResultsReleased(e.target.checked)}
              />
              Release Assessment Results to Trainees
            </label>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4, marginLeft: 24 }}>
              When enabled, trainees can view their completed supervisor ratings (excluding confidential items).
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <Link
              href="/admin/cycles"
              className="gh-btn gh-btn-ghost"
              style={{ textDecoration: 'none' }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="gh-btn gh-btn-primary"
              style={{ padding: '10px 24px', fontSize: 14 }}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
