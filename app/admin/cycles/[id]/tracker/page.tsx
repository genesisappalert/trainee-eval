'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface TrackerRow {
  _id: string;
  traineeStaffId: string;
  traineeName: string;
  traineeEmail: string;
  department: string;
  location: string;
  supervisor: { _id: string; name: string; staffId: string; email: string } | null;
  status: string;
  flags: string[];
  traineeSubmittedAt: string | null;
  supervisorSubmittedAt: string | null;
  daysOutstanding: number;
  hasTraineeSheet: boolean;
  hasSupervisorSheet: boolean;
  traineeOverall: string | null;
  supervisorOverall: string | null;
  releaseWithheld: boolean;
  supervisorToken?: string | null;
}

export default function HrTrackerPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<any>(null);
  const [counters, setCounters] = useState<any>({});
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [selectedRow, setSelectedRow] = useState<TrackerRow | null>(null);
  const [modalType, setModalType] = useState<'reassign' | 'reopen' | 'reissue' | null>(null);

  // Modal form states
  const [newSupervisorId, setNewSupervisorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reopenTarget, setReopenTarget] = useState<'trainee' | 'supervisor'>('supervisor');
  const [reopenReason, setReopenReason] = useState('');
  const [reissuedUrl, setReissuedUrl] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchTracker = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cycles/${id}/tracker`);
      if (!res.ok) throw new Error('Failed to load tracker');
      const data = await res.json();
      setCycle(data.cycle);
      setCounters(data.counters);
      setRows(data.rows);
      setSupervisors(data.supervisors);
    } catch (err: any) {
      alert(err.message || 'Error loading tracker');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTracker();
  }, [id]);

  // Handle Reassign
  const handleReassign = async () => {
    if (!selectedRow || !newSupervisorId) {
      alert('Please select a supervisor');
      return;
    }
    try {
      setModalSubmitting(true);
      const res = await fetch(`/api/cycles/${id}/tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign',
          appraisalId: selectedRow._id,
          newSupervisorId,
          reason: reassignReason || 'HR Administrative Reassignment',
        }),
      });
      if (!res.ok) throw new Error('Failed to reassign supervisor');
      setModalType(null);
      fetchTracker();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Reopen
  const handleReopen = async () => {
    if (!selectedRow || !reopenReason) {
      alert('A reason is mandatory for reopening a submission');
      return;
    }
    try {
      setModalSubmitting(true);
      const res = await fetch(`/api/cycles/${id}/tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reopen',
          appraisalId: selectedRow._id,
          target: reopenTarget,
          reason: reopenReason,
        }),
      });
      if (!res.ok) throw new Error('Failed to reopen sheet');
      setModalType(null);
      fetchTracker();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Reissue Link
  const handleReissue = async () => {
    if (!selectedRow) return;
    try {
      setModalSubmitting(true);
      const res = await fetch(`/api/cycles/${id}/tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reissue_link',
          appraisalId: selectedRow._id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reissue link');
      setReissuedUrl(data.resumeUrl);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Unique departments for filter dropdown
  const departments = Array.from(new Set(rows.map((r) => r.department).filter(Boolean)));

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (statusFilter === 'awaiting' && r.status !== 'awaiting_supervisor') return false;
    if (statusFilter === 'complete' && r.status !== 'complete' && r.status !== 'printed') return false;
    if (statusFilter === 'flagged' && r.flags.length === 0 && r.status !== 'needs_reassignment') return false;
    if (statusFilter === 'drafts' && r.status !== 'trainee_draft' && r.status !== 'supervisor_draft') return false;

    if (deptFilter !== 'all' && r.department !== deptFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = r.traineeName.toLowerCase().includes(q);
      const matchStaff = r.traineeStaffId.toLowerCase().includes(q);
      const matchSup = r.supervisor?.name.toLowerCase().includes(q) || false;
      if (!matchName && !matchStaff && !matchSup) return false;
    }

    return true;
  });

  const getStatusBadge = (status: string, flags: string[]) => {
    if (flags.includes('needs_reassignment')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
          Needs Reassignment
        </span>
      );
    }
    if (flags.includes('unassigned')) {
      return (
        <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
          Unassigned Supervisor
        </span>
      );
    }
    switch (status) {
      case 'awaiting_supervisor':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            Awaiting Supervisor
          </span>
        );
      case 'supervisor_draft':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>
            Supervisor Draft
          </span>
        );
      case 'complete':
      case 'printed':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
            Complete
          </span>
        );
      case 'reopened':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fce7f3', color: '#9d174d', border: '1px solid #fbcfe8' }}>
            Reopened
          </span>
        );
      case 'trainee_draft':
        return (
          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>
            Trainee Draft
          </span>
        );
      default:
        return <span style={{ fontSize: 11 }}>{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1560, margin: '0 auto', padding: '28px 24px' }}>
      {/* Tracker Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/admin/cycles" style={{ fontSize: 13, color: 'var(--text-dim)', textDecoration: 'none', fontWeight: 600 }}>
              ← Cycles
            </Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>Tracker</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '4px 0 0 0' }}>
            {cycle?.name || 'Assessment Tracker'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
            Cohort: <strong style={{ color: 'var(--text)' }}>{cycle?.cohort}</strong> • Public Link:{' '}
            <a
              href={`/a/${cycle?.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}
            >
              /a/{cycle?.slug} ↗
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href={
              selectedIds.length > 0
                ? `/admin/print/bulk?ids=${selectedIds.join(',')}`
                : `/admin/print/bulk?cycleId=${id}&status=complete`
            }
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              background: '#002147',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(0, 33, 71, 0.2)',
            }}
          >
            🖨️ {selectedIds.length > 0 ? `Print Selected (${selectedIds.length})` : `Print / Split (${counters.complete || 0})`}
          </Link>

          <a
            href={
              selectedIds.length > 0
                ? `/api/exports/zip?ids=${selectedIds.join(',')}`
                : `/api/exports/zip?cycleId=${id}&status=complete`
            }
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              background: '#047857',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
            }}
          >
            📦 {selectedIds.length > 0 ? `Export Selected ZIP (${selectedIds.length})` : `Export ZIP (${counters.complete || 0})`}
          </a>

          <a
            href={
              selectedIds.length > 0
                ? `/api/exports/excel?cycleId=${id}&ids=${selectedIds.join(',')}`
                : `/api/exports/excel?cycleId=${id}`
            }
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              background: '#16a34a',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.2)',
            }}
          >
            📊 {selectedIds.length > 0 ? `Export Selected Excel (${selectedIds.length})` : 'Export to Excel (.xlsx)'}
          </a>
        </div>
      </div>

      {/* KPI Counters Banner (PRD A-12) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Trainees</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{counters.total || 0}</div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Trainee In-Progress</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-muted)', marginTop: 4 }}>{counters.traineeDraft || 0}</div>
        </div>

        <div style={{
          background: counters.awaitingSupervisor > 0 ? 'var(--warning-dim)' : 'var(--bg-card)',
          padding: 18,
          borderRadius: 12,
          border: counters.awaitingSupervisor > 0 ? '1px solid rgba(217,119,6,0.3)' : '1px solid var(--border)',
        }}>
          <div style={{ color: counters.awaitingSupervisor > 0 ? 'var(--warning)' : 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            Awaiting Supervisor
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: counters.awaitingSupervisor > 0 ? 'var(--warning)' : 'var(--text)', marginTop: 4 }}>
            {counters.awaitingSupervisor || 0}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 18, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--success)', marginTop: 4 }}>{counters.complete || 0}</div>
        </div>

        <div style={{
          background: (counters.needsReassignment + counters.unassigned) > 0 ? 'var(--danger-dim)' : 'var(--bg-card)',
          padding: 18,
          borderRadius: 12,
          border: (counters.needsReassignment + counters.unassigned) > 0 ? '1px solid rgba(220,38,38,0.3)' : '1px solid var(--border)',
        }}>
          <div style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            Flagged / Attention
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--danger)', marginTop: 4 }}>
            {(counters.needsReassignment || 0) + (counters.unassigned || 0)}
          </div>
        </div>
      </div>

      {/* Main Table Box */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        {/* Table Filters Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--bg-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search name, staff ID, supervisor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                outline: 'none',
                minWidth: 260,
                background: 'var(--bg)',
                color: 'var(--text)',
              }}
            />

            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            {[
              { val: 'all', label: 'All Records' },
              { val: 'awaiting', label: 'Awaiting Supervisor' },
              { val: 'complete', label: 'Completed' },
              { val: 'flagged', label: 'Flagged' },
              { val: 'drafts', label: 'Drafts' },
            ].map((tab) => (
              <button
                key={tab.val}
                onClick={() => setStatusFilter(tab.val)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: statusFilter === tab.val ? 'var(--accent)' : 'transparent',
                  color: statusFilter === tab.val ? '#fff' : 'var(--text-dim)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
            <p>Loading records...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 600 }}>No trainee records found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 700 }}>
                  <th style={{ width: 36, padding: '12px 10px 12px 16px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredRows.map((r) => r._id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '12px 16px' }}>Trainee Name & Staff ID</th>
                  <th style={{ padding: '12px 14px' }}>Unit / Location</th>
                  <th style={{ padding: '12px 14px' }}>Supervisor</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Trainee Submitted</th>
                  <th style={{ padding: '12px 14px' }}>Days Outst.</th>
                  <th style={{ padding: '12px 14px' }}>Ratings Summary</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row._id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s',
                      background: selectedIds.includes(row._id) ? 'var(--success-dim)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedIds.includes(row._id)) e.currentTarget.style.background = 'var(--bg-3)';
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedIds.includes(row._id)) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ width: 36, padding: '14px 10px 14px 16px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, row._id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== row._id));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.traineeName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{row.traineeStaffId}</div>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{row.department || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{row.location || '—'}</div>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {row.supervisor ? (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{row.supervisor.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{row.supervisor.staffId}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {getStatusBadge(row.status, row.flags)}
                    </td>
                    <td style={{ padding: '14px 14px', color: 'var(--text-dim)' }}>
                      {row.traineeSubmittedAt
                        ? new Date(row.traineeSubmittedAt).toLocaleDateString('en-GB')
                        : 'Not submitted'}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {row.status === 'awaiting_supervisor' || row.status === 'supervisor_draft' ? (
                        <span style={{
                          fontWeight: 700,
                          color: row.daysOutstanding >= 7 ? 'var(--danger)' : row.daysOutstanding >= 3 ? 'var(--warning)' : 'var(--success)'
                        }}>
                          {row.daysOutstanding}d
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text)' }}>
                        <span>T: <strong>{row.traineeOverall || '—'}</strong></span>
                        <span style={{ margin: '0 4px', color: 'var(--border)' }}>|</span>
                        <span>S: <strong>{row.supervisorOverall || '—'}</strong></span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {/* Printable PDF Link */}
                        <Link
                          href={`/admin/print/${row._id}`}
                          title="Print official PDF"
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            background: '#002147',
                            color: '#fff',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          Print PDF
                        </Link>

                        {/* Reassign */}
                        <button
                          onClick={() => {
                            setSelectedRow(row);
                            setNewSupervisorId(row.supervisor?._id || '');
                            setReassignReason('');
                            setModalType('reassign');
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Reassign
                        </button>

                        {/* Reopen */}
                        <button
                          onClick={() => {
                            setSelectedRow(row);
                            setReopenReason('');
                            setModalType('reopen');
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Reopen
                        </button>

                        {/* Copy Direct Supervisor Evaluation Link */}
                        {row.supervisorToken && (
                          <button
                            onClick={() => {
                              const supUrl = `${window.location.origin}/s/${row.supervisorToken}`;
                              navigator.clipboard.writeText(supUrl);
                              alert(`Copied unique Supervisor Evaluation Link for ${row.traineeName}!\n\n${supUrl}`);
                            }}
                            title="Copy unique private link for the supervisor to evaluate this trainee without logging in"
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'var(--accent-dim)',
                              border: '1px solid var(--accent-border)',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            🔗 Sup. Link
                          </button>
                        )}

                        {/* Reissue Link */}
                        <button
                          onClick={() => {
                            setSelectedRow(row);
                            setReissuedUrl('');
                            setModalType('reissue');
                          }}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          Links
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REASSIGN MODAL */}
      {modalType === 'reassign' && selectedRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>Reassign Supervisor</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
              Trainee: <strong>{selectedRow.traineeName}</strong> ({selectedRow.traineeStaffId})
            </p>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Select New Supervisor: *
              </label>
              <select
                value={newSupervisorId}
                onChange={(e) => setNewSupervisorId(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
              >
                <option value="">-- Choose supervisor --</option>
                {supervisors.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.staffId}) — {s.department || 'All Units'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Reason for Reassignment:
              </label>
              <input
                type="text"
                placeholder="e.g. Trainee rotated to Port Harcourt branch"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setModalType(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={modalSubmitting}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#002147', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                {modalSubmitting ? 'Saving...' : 'Confirm Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REOPEN MODAL */}
      {modalType === 'reopen' && selectedRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>Reopen Assessment Submission</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
              Unlock submission for trainee or supervisor to allow revisions. (PRD A-18: Mandatory Reason).
            </p>

            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Reopen Target:
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reopen_target"
                    checked={reopenTarget === 'supervisor'}
                    onChange={() => setReopenTarget('supervisor')}
                  />
                  Supervisor Sheet
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reopen_target"
                    checked={reopenTarget === 'trainee'}
                    onChange={() => setReopenTarget('trainee')}
                  />
                  Trainee Sheet
                </label>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Reason for Reopening: *
              </label>
              <textarea
                rows={3}
                required
                placeholder="State why this record is being reopened (e.g. Trainee entered wrong rotation dates)..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setModalType(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={modalSubmitting}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                {modalSubmitting ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REISSUE / SHARE LINKS MODAL */}
      {modalType === 'reissue' && selectedRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', color: 'var(--text)', borderRadius: 16, border: '1px solid var(--border)', maxWidth: 540, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Direct Evaluation &amp; Trainee Links</h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
              Share the direct supervisor evaluation link or reissue a trainee resume token for <strong>{selectedRow.traineeName}</strong> ({selectedRow.traineeStaffId}).
            </p>

            {/* Direct Supervisor Evaluation Link */}
            {selectedRow.supervisorToken && (
              <div style={{ marginTop: 18, background: 'var(--accent-dim)', padding: 16, borderRadius: 10, border: '1px solid var(--accent-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
                  📨 Direct Supervisor Evaluation Link (No Login Required):
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                  Send this link to the trainee&apos;s supervisor so they can evaluate {selectedRow.traineeName} directly:
                </p>
                <div style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/s/{selectedRow.supervisorToken}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/s/${selectedRow.supervisorToken}`;
                      navigator.clipboard.writeText(url);
                      alert('Supervisor evaluation link copied to clipboard!');
                    }}
                    className="gh-btn gh-btn-primary"
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    📋 Copy Supervisor Link
                  </button>
                </div>
              </div>
            )}

            {/* Trainee Link Reissue */}
            {reissuedUrl ? (
              <div style={{ marginTop: 16, background: 'var(--bg-3)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>
                  ✓ New Trainee Resume Link Generated:
                </div>
                <div style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'var(--font-mono)', background: 'var(--bg)', padding: 8, border: '1px solid var(--border)', borderRadius: 6 }}>
                  {reissuedUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reissuedUrl);
                    alert('Trainee link copied to clipboard!');
                  }}
                  className="gh-btn gh-btn-ghost"
                  style={{ marginTop: 10, padding: '6px 14px', fontSize: 12 }}
                >
                  📋 Copy Trainee Link
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  Trainee Self-Assessment Resume Link
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
                  Need to reissue the trainee&apos;s own link? Clicking below will generate a new trainee resume token.
                </p>
                <button
                  onClick={handleReissue}
                  disabled={modalSubmitting}
                  className="gh-btn gh-btn-ghost"
                  style={{ padding: '8px 16px', fontSize: 12 }}
                >
                  {modalSubmitting ? 'Generating...' : 'Generate New Trainee Link'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setModalType(null)}
                className="gh-btn gh-btn-ghost"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Selection Bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#002147',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            zIndex: 90,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {selectedIds.length} {selectedIds.length === 1 ? 'record' : 'records'} selected
          </span>
          <Link
            href={`/admin/print/bulk?ids=${selectedIds.join(',')}`}
            style={{
              padding: '7px 16px',
              background: '#c8102e',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 12,
              boxShadow: '0 2px 6px rgba(200, 16, 46, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🖨️ Print Selected ({selectedIds.length})
          </Link>
          <a
            href={`/api/exports/zip?ids=${selectedIds.join(',')}`}
            style={{
              padding: '7px 16px',
              background: '#16a34a',
              color: '#fff',
              borderRadius: 6,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 12,
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📦 Export ZIP ({selectedIds.length})
          </a>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
}
