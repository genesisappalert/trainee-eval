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
        <Link href="/admin/cycles" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Cycles
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#002147', margin: '8px 0 0 0' }}>
          Create New Assessment Cycle
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0 0' }}>
          Configure a new cohort cycle, specify submission windows, and attach authorized supervisors.
        </p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 32, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Cycle Name: *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 2026 Cohort Annual Assessment"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                URL Slug: *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ background: '#f8fafc', color: '#64748b', padding: '10px 12px', fontSize: 12, borderRight: '1px solid #cbd5e1' }}>
                  /a/
                </span>
                <input
                  type="text"
                  required
                  placeholder="2026-annual"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Cohort: *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cohort 2026-B"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Opens At: *
              </label>
              <input
                type="date"
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Trainee Deadline: *
              </label>
              <input
                type="date"
                required
                value={traineeDeadline}
                onChange={(e) => setTraineeDeadline(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Supervisor Deadline: *
              </label>
              <input
                type="date"
                required
                value={supervisorDeadline}
                onChange={(e) => setSupervisorDeadline(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Supervisor attachment */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                Attach Authorized Supervisors ({selectedSupervisors.length} selected):
              </label>
              <button
                type="button"
                onClick={() =>
                  setSelectedSupervisors(
                    selectedSupervisors.length === supervisors.length ? [] : supervisors.map((s) => s._id)
                  )
                }
                style={{ fontSize: 12, color: '#002147', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {selectedSupervisors.length === supervisors.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: '#f8fafc',
            }}>
              {supervisors.map((s) => (
                <label key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', cursor: 'pointer' }}>
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
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                color: '#475569',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                border: 'none',
                background: '#002147',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {submitting ? 'Creating...' : 'Create Cycle'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
