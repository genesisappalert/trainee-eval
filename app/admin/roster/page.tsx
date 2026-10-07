'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';

interface SupervisorRef {
  _id: string;
  name: string;
  staffId: string;
  email: string;
  department: string;
}

interface RosterEntryItem {
  _id: string;
  cycleId: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  expectedSupervisor: SupervisorRef | null;
  appraisal: {
    _id: string;
    status: string;
    flags: string[];
    traineeSubmittedAt: string | null;
    supervisorSubmittedAt: string | null;
  } | null;
  status: string;
  createdAt: string;
}

interface UnmatchedAppraisal {
  _id: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  status: string;
  flags: string[];
  supervisor: { _id: string; name: string; staffId: string } | null;
}

interface CycleOption {
  _id: string;
  name: string;
  slug: string;
  cohort: string;
  status: string;
}

interface RosterSummary {
  totalExpected: number;
  notStarted: number;
  traineeDraft: number;
  awaitingSupervisor: number;
  complete: number;
  unmatched: number;
}

export default function TraineeRosterPage() {
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [activeCycle, setActiveCycle] = useState<CycleOption | null>(null);
  const [roster, setRoster] = useState<RosterEntryItem[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedAppraisal[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorRef[]>([]);
  const [summary, setSummary] = useState<RosterSummary>({
    totalExpected: 0,
    notStarted: 0,
    traineeDraft: 0,
    awaitingSupervisor: 0,
    complete: 0,
    unmatched: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [supervisorFilter, setSupervisorFilter] = useState('all');

  // Modals
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RosterEntryItem | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Single Form State
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [expectedSupervisorId, setExpectedSupervisorId] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Bulk State
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null);

  const fetchRoster = async (cycleId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = cycleId ? `/api/roster?cycleId=${cycleId}` : '/api/roster';
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load roster');
      }
      const data = await res.json();
      setCycles(data.cycles || []);
      setActiveCycle(data.activeCycle || null);
      if (data.activeCycle?._id) {
        setSelectedCycleId(data.activeCycle._id);
      }
      setRoster(data.roster || []);
      setUnmatched(data.unmatchedAppraisals || []);
      setSupervisors(data.supervisors || []);
      setSummary(data.summary || {
        totalExpected: 0,
        notStarted: 0,
        traineeDraft: 0,
        awaitingSupervisor: 0,
        complete: 0,
        unmatched: 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  const handleCycleChange = (cycleId: string) => {
    setSelectedCycleId(cycleId);
    fetchRoster(cycleId);
  };

  const handleOpenAdd = () => {
    setEditingEntry(null);
    setStaffId('');
    setName('');
    setEmail('');
    setDepartment('');
    setLocation('');
    setExpectedSupervisorId('');
    setSingleModalOpen(true);
  };

  const handleOpenEdit = (entry: RosterEntryItem) => {
    setEditingEntry(entry);
    setStaffId(entry.staffId);
    setName(entry.name);
    setEmail(entry.email);
    setDepartment(entry.department);
    setLocation(entry.location);
    setExpectedSupervisorId(entry.expectedSupervisor?._id || '');
    setSingleModalOpen(true);
  };

  const handleSaveSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId) {
      alert('Please select an assessment cycle first');
      return;
    }

    try {
      setFormSubmitting(true);
      if (editingEntry) {
        // Update
        const res = await fetch(`/api/roster/${editingEntry._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            department,
            location,
            expectedSupervisorId: expectedSupervisorId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update trainee');
      } else {
        // Create
        const res = await fetch('/api/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cycleId: selectedCycleId,
            staffId,
            name,
            email,
            department,
            location,
            expectedSupervisorId: expectedSupervisorId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add trainee');
      }

      setSingleModalOpen(false);
      fetchRoster(selectedCycleId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving trainee');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (entry: RosterEntryItem) => {
    if (!confirm(`Are you sure you want to remove ${entry.name} (${entry.staffId}) from the roster?`)) return;

    try {
      const res = await fetch(`/api/roster/${entry._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete trainee');
      fetchRoster(selectedCycleId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting trainee');
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkCsvText.trim() || !selectedCycleId) return;

    try {
      setBulkSubmitting(true);
      const lines = bulkCsvText.trim().split('\n');
      const items: Array<{
        staffId: string;
        name: string;
        email: string;
        department: string;
        location: string;
        supervisorStaffId: string;
      }> = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',').map((p) => p.trim());
        const first = parts[0]?.toLowerCase();
        if (first === 'staffid' || first === 'staff_id' || first === 'staff id') continue;
        items.push({
          staffId: parts[0] || '',
          name: parts[1] || '',
          email: parts[2] || '',
          department: parts[3] || '',
          location: parts[4] || '',
          supervisorStaffId: parts[5] || '',
        });
      }

      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: selectedCycleId,
          entries: items,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk upload failed');

      setBulkResult({ created: data.created || 0, skipped: data.skipped || 0 });
      fetchRoster(selectedCycleId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Bulk upload failed');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleReconcileUnmatched = async (item: UnmatchedAppraisal) => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId: selectedCycleId,
          staffId: item.staffId,
          name: item.name,
          email: item.email,
          department: item.department,
          location: item.location,
          expectedSupervisorId: item.supervisor?._id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed');
      alert(`Successfully added ${item.name} (${item.staffId}) to the roster!`);
      fetchRoster(selectedCycleId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Reconciliation failed');
    }
  };

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    roster.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return Array.from(set).sort();
  }, [roster]);

  // Filtered roster entries
  const filteredRoster = useMemo(() => {
    return roster.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          r.name.toLowerCase().includes(q) ||
          r.staffId.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (deptFilter !== 'all' && r.department !== deptFilter) return false;
      if (supervisorFilter !== 'all' && r.expectedSupervisor?._id !== supervisorFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'not_started' && r.status !== 'not_started') return false;
        if (statusFilter === 'draft' && r.status !== 'trainee_draft') return false;
        if (statusFilter === 'awaiting_supervisor' && (r.status !== 'awaiting_supervisor' && r.status !== 'supervisor_draft')) return false;
        if (statusFilter === 'complete' && (r.status !== 'complete' && r.status !== 'printed')) return false;
      }
      return true;
    });
  }, [roster, search, deptFilter, supervisorFilter, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started':
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
            ○ Not Started
          </span>
        );
      case 'trainee_draft':
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
            ● Trainee Draft
          </span>
        );
      case 'awaiting_supervisor':
      case 'supervisor_draft':
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#e0f2fe', color: '#0369a1' }}>
            ● In Supervisor Queue
          </span>
        );
      case 'needs_reassignment':
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>
            ⚠ Needs Reassignment
          </span>
        );
      case 'complete':
      case 'printed':
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
            ✓ Completed
          </span>
        );
      default:
        return (
          <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <header className="top-header">
        <div>
          <h1 className="top-header-title">Trainee Roster</h1>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            Cohort Enrollment, Supervisor Mapping & Real-time Submission Tracking
          </span>
        </div>

        <div className="top-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Cycle Selector */}
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.cohort}) {c.status === 'open' ? '• Active' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setBulkResult(null);
              setBulkCsvText('');
              setBulkModalOpen(true);
            }}
            className="gh-btn gh-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Bulk CSV Upload
          </button>

          <button
            onClick={handleOpenAdd}
            className="gh-btn gh-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Trainee
          </button>
        </div>
      </header>

      <div className="page-container">
        {/* Unmatched Alert Banner */}
        {unmatched.length > 0 && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <strong style={{ color: '#92400e', fontSize: 14 }}>
                  {unmatched.length} Unmatched Assessment Submission{unmatched.length > 1 ? 's' : ''} Detected
                </strong>
              </div>
              <p style={{ margin: '6px 0 0 26px', color: '#78350f', fontSize: 13, lineHeight: 1.4 }}>
                The following trainees submitted assessments under Staff IDs that were not pre-loaded on this cohort roster:
                {' '}
                {unmatched.map((u) => `${u.name} (${u.staffId})`).join(', ')}.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {unmatched.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleReconcileUnmatched(u)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: '#92400e',
                    color: '#fff',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add {u.staffId} to Roster
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KPI Stats Grid */}
        <div className="stat-grid animate-in" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : summary.totalExpected}</div>
              <div className="kpi-label">Expected Trainees</div>
              <div className="kpi-sub">Total on cohort roster</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: '#f1f5f9', color: '#64748b' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : summary.notStarted}</div>
              <div className="kpi-label">Not Started</div>
              <div className="kpi-sub">Awaiting self-assessment</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-chip" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div className="kpi-value">{loading ? '—' : (summary.traineeDraft + summary.awaitingSupervisor)}</div>
              <div className="kpi-label">In Pipeline</div>
              <div className="kpi-sub">{summary.awaitingSupervisor} with supervisors</div>
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
              <div className="kpi-value">{loading ? '—' : summary.complete}</div>
              <div className="kpi-label">Completed</div>
              <div className="kpi-sub">Signed by both parties</div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
            {/* Search */}
            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
              <input
                type="text"
                placeholder="Search trainee name, staff ID, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input, transparent)',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">All Departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Supervisor Filter */}
            <select
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">All Supervisors ({supervisors.length})</option>
              {supervisors.map((s) => (
                <option key={s._id} value={s._id}>{s.name} ({s.staffId})</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="draft">Trainee Draft</option>
              <option value="awaiting_supervisor">In Supervisor Queue</option>
              <option value="complete">Completed</option>
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
            Showing <strong>{filteredRoster.length}</strong> of <strong>{roster.length}</strong> trainees
          </div>
        </div>

        {/* Data Table */}
        <div className="card animate-in">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trainee Details</th>
                  <th>Department & Location</th>
                  <th>Assigned Supervisor</th>
                  <th>Assessment Status</th>
                  <th>Portal Link</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : filteredRoster.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px 24px' }}>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                      <div className="font-semibold" style={{ fontSize: 16 }}>No trainees found</div>
                      <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                        {roster.length === 0
                          ? 'This cycle currently has no pre-loaded trainees. Add a trainee or upload a CSV roster.'
                          : 'No trainees match your search or filter criteria.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRoster.map((entry) => {
                    const portalUrl = activeCycle
                      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/a/${activeCycle.slug}`
                      : '';

                    return (
                      <tr key={entry._id}>
                        <td>
                          <div className="font-semibold" style={{ fontSize: 14 }}>{entry.name}</div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 2 }}>
                            {entry.staffId}
                          </div>
                          <div className="text-muted text-xs" style={{ marginTop: 2 }}>
                            {entry.email || 'No email registered'}
                          </div>
                        </td>

                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.department || '—'}</div>
                          <div className="text-muted text-xs" style={{ marginTop: 2 }}>{entry.location || '—'}</div>
                        </td>

                        <td>
                          {entry.expectedSupervisor ? (
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.expectedSupervisor.name}</div>
                              <div className="text-muted text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
                                {entry.expectedSupervisor.staffId}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
                              ⚠️ Unassigned
                            </span>
                          )}
                        </td>

                        <td>{getStatusBadge(entry.status)}</td>

                        <td>
                          {portalUrl && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(portalUrl);
                                alert(`Copied trainee portal link for ${entry.name}!`);
                              }}
                              className="btn btn-ghost btn-sm"
                              title="Copy assessment URL"
                              style={{ fontSize: 12, padding: '4px 8px' }}
                            >
                              🔗 Copy Link
                            </button>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {entry.appraisal && (
                              <Link
                                href={`/admin/cycles/${entry.cycleId}/tracker`}
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: 12 }}
                              >
                                View Live →
                              </Link>
                            )}
                            <button
                              onClick={() => handleOpenEdit(entry)}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 12 }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entry)}
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--error, #dc2626)', fontSize: 12 }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SINGLE ADD / EDIT MODAL */}
      {singleModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {editingEntry ? 'Edit Trainee Record' : 'Add Trainee to Roster'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
              Cohort Cycle: <strong>{activeCycle?.name}</strong>
            </p>

            <form onSubmit={handleSaveSingle} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Staff ID *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingEntry)}
                  placeholder="e.g. GEN-TR-095"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: editingEntry ? 'var(--bg-tertiary)' : 'transparent',
                    fontSize: 13,
                    fontFamily: 'var(--font-mono)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chinedu Eze"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Corporate Email
                </label>
                <input
                  type="email"
                  placeholder="e.g. chinedu.eze@genesisgroup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Restaurant Operations"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    Operating Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GRA Port Harcourt"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Assigned Expected Supervisor
                </label>
                <select
                  value={expectedSupervisorId}
                  onChange={(e) => setExpectedSupervisorId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">— Unassigned (Trainee will select) —</option>
                  {supervisors.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.staffId}) • {s.department}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setSingleModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving...' : editingEntry ? 'Update Trainee' : 'Add to Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK CSV IMPORT MODAL */}
      {bulkModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-card, #fff)',
            borderRadius: 16,
            maxWidth: 640,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Bulk Trainee Roster Upload (CSV)
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
              Import cohort trainees into <strong>{activeCycle?.name}</strong>.
            </p>

            <div style={{
              background: 'var(--bg-tertiary, #f8fafc)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              marginTop: 14,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              <strong>Expected CSV Column Format:</strong>
              <pre style={{ margin: '6px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
Staff ID, Full Name, Email, Department, Location, Supervisor Staff ID
GEN-TR-101, Chiamaka Obi, chiamaka.obi@genesisgroup.com, Finance, Lagos Island, GEN-SUP-002
GEN-TR-102, Ibrahim Bello, ibrahim.bello@genesisgroup.com, Supply Chain, Port Harcourt, GEN-SUP-003
              </pre>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Paste CSV Rows:
              </label>
              <textarea
                rows={8}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder="Paste CSV data here..."
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {bulkResult && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: '#dcfce7',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                fontSize: 13,
                color: '#15803d',
                fontWeight: 600,
              }}>
                ✓ Bulk upload complete: {bulkResult.created} trainees enrolled, {bulkResult.skipped} skipped/duplicates.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="btn btn-secondary"
                disabled={bulkSubmitting}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                className="btn btn-primary"
                disabled={bulkSubmitting || !bulkCsvText.trim()}
              >
                {bulkSubmitting ? 'Uploading...' : 'Process CSV Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
