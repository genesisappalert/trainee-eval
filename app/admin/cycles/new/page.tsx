'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewCyclePage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [cohort, setCohort] = useState('Cohort 2026');
  const [opensAt, setOpensAt] = useState(new Date().toISOString().split('T')[0]);
  const [traineeDeadline, setTraineeDeadline] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [supervisorDeadline, setSupervisorDeadline] = useState(
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-slugify
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  };

  useEffect(() => {
    async function loadSupervisors() {
      try {
        const res = await fetch('/api/supervisors');
        if (res.ok) {
          const data = await res.json();
          setSupervisors(data.supervisors || []);
          // By default select all active supervisors
          setSelectedSupervisors((data.supervisors || []).map((s: any) => s._id));
        }
      } catch (e) {
        // ignore
      }
    }
    loadSupervisors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !slug || !cohort || !opensAt || !traineeDeadline || !supervisorDeadline) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          cohort,
          opensAt,
          traineeDeadline,
          supervisorDeadline,
          supervisorIds: selectedSupervisors,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create cycle');
      }

      router.push('/admin/cycles');
    } catch (err: any) {
      setError(err.message || 'Error creating cycle');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSupervisor = (id: string) => {
    setSelectedSupervisors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '36px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/cycles" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Cycles
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: '8px 0 0 0' }}>
          Create New Assessment Cycle
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '4px 0 0 0' }}>
          Configure a new cohort cycle, specify submission windows, and attach authorized supervisors.
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,0.3)', color: 'var(--danger)', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 32, boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              Cycle Name: *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2026 Cohort Annual Assessment"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="gh-input"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                URL Slug: *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)' }}>
                <span style={{ background: 'var(--bg-3)', color: 'var(--text-dim)', padding: '10px 12px', fontSize: 12, borderRight: '1px solid var(--border)' }}>
                  /a/
                </span>
                <input
                  type="text"
                  required
                  placeholder="2026-annual"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Cohort: *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cohort 2026-B"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="gh-input"
              />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Opens At: *
              </label>
              <input
                type="date"
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="gh-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Trainee Deadline: *
              </label>
              <input
                type="date"
                required
                value={traineeDeadline}
                onChange={(e) => setTraineeDeadline(e.target.value)}
                className="gh-input"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                Supervisor Deadline: *
              </label>
              <input
                type="date"
                required
                value={supervisorDeadline}
                onChange={(e) => setSupervisorDeadline(e.target.value)}
                className="gh-input"
              />
            </div>
          </div>

          {/* Supervisor attachment */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                Attach Authorized Supervisors ({selectedSupervisors.length} selected):
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedSupervisors(
                    selectedSupervisors.length === supervisors.length ? [] : supervisors.map((s) => s._id)
                  )
                }
                style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {selectedSupervisors.length === supervisors.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'var(--bg-3)',
            }}>
              {supervisors.map((s) => (
                <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedSupervisors.includes(s._id)}
                    onChange={() => toggleSupervisor(s._id)}
                  />
                  <span>
                    <strong>{s.name}</strong> ({s.staffId}) — {s.department || 'All Units'}
                  </span>
                </label>
              ))}
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
              disabled={submitting}
              className="gh-btn gh-btn-primary"
              style={{ padding: '10px 24px', fontSize: 14 }}
            >
              {submitting ? 'Creating...' : 'Create Cycle'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
