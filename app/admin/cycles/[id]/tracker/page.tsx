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
            <Link href="/admin/cycles" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
              ← Cycles
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: 13, color: '#002147', fontWeight: 700 }}>Tracker</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#002147', margin: '4px 0 0 0' }}>
            {cycle?.name || 'Assessment Tracker'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 13 }}>
            Cohort: <strong>{cycle?.cohort}</strong> • Public Link:{' '}
            <a
              href={`/a/${cycle?.slug}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#002147', fontWeight: 600, textDecoration: 'underline' }}
            >
              /a/{cycle?.slug} ↗
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href={`/admin/print/bulk?cycleId=${id}&status=complete`}
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
            🖨️ Bulk Print Completed ({counters.complete || 0})
          </Link>

          <a
            href={`/api/exports/excel?cycleId=${id}`}
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
            📊 Export to Excel (.xlsx)
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
        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Total Trainees</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#002147', marginTop: 4 }}>{counters.total || 0}</div>
        </div>

        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Trainee In-Progress</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#475569', marginTop: 4 }}>{counters.traineeDraft || 0}</div>
        </div>

        <div style={{
          background: counters.awaitingSupervisor > 0 ? '#fffbeb' : '#fff',
          padding: 18,
          borderRadius: 12,
          border: counters.awaitingSupervisor > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
        }}>
          <div style={{ color: counters.awaitingSupervisor > 0 ? '#b45309' : '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            Awaiting Supervisor
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: counters.awaitingSupervisor > 0 ? '#d97706' : '#002147', marginTop: 4 }}>
            {counters.awaitingSupervisor || 0}
          </div>
        </div>

        <div style={{ background: '#fff', padding: 18, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Completed</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>{counters.complete || 0}</div>
        </div>

        <div style={{
          background: (counters.needsReassignment + counters.unassigned) > 0 ? '#fef2f2' : '#fff',
          padding: 18,
          borderRadius: 12,
          border: (counters.needsReassignment + counters.unassigned) > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
        }}>
          <div style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
            Flagged / Attention
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
            {(counters.needsReassignment || 0) + (counters.unassigned || 0)}
          </div>
        </div>
      </div>

      {/* Main Table Box */}
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        overflow: 'hidden',
      }}>
        {/* Table Filters Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: '#f8fafc',
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
                border: '1px solid #cbd5e1',
                fontSize: 13,
                outline: 'none',
                minWidth: 260,
                background: '#fff',
              }}
            />

            {departments.length > 0 && (
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  outline: 'none',
                  background: '#fff',
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

          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 8, padding: 3 }}>
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
                  background: statusFilter === tab.val ? '#fff' : 'transparent',
                  color: statusFilter === tab.val ? '#002147' : '#64748b',
                  boxShadow: statusFilter === tab.val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p>Loading records...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 600 }}>No trainee records found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
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
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s',
                      background: selectedIds.includes(row._id) ? '#f0fdf4' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedIds.includes(row._id)) e.currentTarget.style.background = '#f8fafc';
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
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.traineeName}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{row.traineeStaffId}</div>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#334155' }}>{row.department || '—'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.location || '—'}</div>
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {row.supervisor ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#002147' }}>{row.supervisor.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{row.supervisor.staffId}</div>
                        </div>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {getStatusBadge(row.status, row.flags)}
                    </td>
                    <td style={{ padding: '14px 14px', color: '#64748b' }}>
                      {row.traineeSubmittedAt
                        ? new Date(row.traineeSubmittedAt).toLocaleDateString('en-GB')
                        : 'Not submitted'}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      {row.status === 'awaiting_supervisor' || row.status === 'supervisor_draft' ? (
                        <span style={{
                          fontWeight: 700,
                          color: row.daysOutstanding >= 7 ? '#dc2626' : row.daysOutstanding >= 3 ? '#d97706' : '#16a34a'
                        }}>
                          {row.daysOutstanding}d
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ fontSize: 11 }}>
                        <span>T: <strong>{row.traineeOverall || '—'}</strong></span>
                        <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
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
                          Link
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

      {/* REISSUE LINK MODAL */}
      {modalType === 'reissue' && selectedRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>Reissue Trainee Access Link</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
              Generate a secure 128-bit private link for <strong>{selectedRow.traineeName}</strong> ({selectedRow.traineeEmail}).
            </p>

            {reissuedUrl ? (
              <div style={{ marginTop: 20, background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>
                  ✓ New Link Generated:
                </div>
                <div style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace', background: '#fff', padding: 8, border: '1px solid #e2e8f0', borderRadius: 4 }}>
                  {reissuedUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(reissuedUrl);
                    alert('Copied to clipboard!');
                  }}
                  style={{
                    marginTop: 10,
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  📋 Copy Link to Clipboard
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 13, color: '#334155' }}>
                  Clicking generate will invalidate any previous access links and create a new resume token for this trainee.
                </p>
                <button
                  onClick={handleReissue}
                  disabled={modalSubmitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#002147',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {modalSubmitting ? 'Generating...' : 'Generate New Link'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button
                onClick={() => setModalType(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
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
            🖨️ Print Selected Bundle ({selectedIds.length})
          </Link>
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
