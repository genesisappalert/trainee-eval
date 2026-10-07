'use client';

import { useEffect, useState, useMemo } from 'react';

interface AuditItem {
  _id: string;
  createdAt: string;
  rawAction: string;
  actionLabel: string;
  category: string;
  summary: string;
  actor: {
    name: string;
    staffId: string;
    role: string;
    email: string;
  };
  target: {
    type: string;
    label: string;
    id: string;
  };
  cycle: {
    name: string;
    slug: string;
  } | null;
  metadata: Record<string, any>;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/audit');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load audit logs');
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filtered entries
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        log.actionLabel.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.actor.name.toLowerCase().includes(q) ||
        log.actor.staffId.toLowerCase().includes(q) ||
        log.target.label.toLowerCase().includes(q);

      const matchesCategory =
        categoryFilter === 'all' ||
        log.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [logs, search, categoryFilter]);

  // Statistics
  const totalCount = logs.length;
  const governanceCount = logs.filter((l) => l.category === 'governance').length;
  const appraisalCount = logs.filter((l) => l.category === 'appraisal').length;
  const supervisorCount = logs.filter((l) => l.category === 'supervisors' || l.category === 'reassignment').length;

  const getActionBadge = (category: string, actionLabel: string, rawAction: string) => {
    if (rawAction.includes('delete') || rawAction.includes('deactivate')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          background: 'rgba(220, 38, 38, 0.1)',
          color: 'var(--danger, #DC2626)',
          border: '1px solid rgba(220, 38, 38, 0.25)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {actionLabel}
        </span>
      );
    }

    if (rawAction.includes('superadmin') || rawAction.includes('created')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          background: 'rgba(22, 163, 74, 0.1)',
          color: '#16A34A',
          border: '1px solid rgba(22, 163, 74, 0.25)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
          </svg>
          {actionLabel}
        </span>
      );
    }

    if (rawAction.includes('reassigned') || rawAction.includes('reopen')) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          background: 'rgba(217, 119, 6, 0.1)',
          color: '#D97706',
          border: '1px solid rgba(217, 119, 6, 0.25)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {actionLabel}
        </span>
      );
    }

    if (category === 'appraisal') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 700,
          background: 'rgba(37, 99, 235, 0.1)',
          color: '#2563EB',
          border: '1px solid rgba(37, 99, 235, 0.25)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {actionLabel}
        </span>
      );
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        background: 'var(--border)',
        color: 'var(--text)',
      }}>
        {actionLabel}
      </span>
    );
  };

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return { dateFormatted, timeFormatted };
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
        marginBottom: 28,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #FF0C34)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Security & Compliance
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
              Chronological Audit Log
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            System Audit Log Trail
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-dim)', fontSize: 14 }}>
            Plain-English chronological record of all administrative changes, evaluations, reassignments, and security events.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: 'var(--shadow)',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          Refresh Trail
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Audit Entries
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Recorded forensic milestones
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid rgba(255, 12, 52, 0.25)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #FF0C34)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Admin & Governance
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {governanceCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Roles, user accounts & privileges
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Assessment Submissions
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {appraisalCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Completed evaluations & reviews
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Supervisors & Reassignments
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {supervisorCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Roster & routing adjustments
          </div>
        </div>
      </div>

      {/* Directory Table Box */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        {/* Search & Filter Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2, var(--bg))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 300 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by person, staff ID, or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 38px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  outline: 'none',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Activity Categories</option>
              <option value="governance">🛡️ Admin & Role Governance</option>
              <option value="appraisal">📝 Assessment Evaluations</option>
              <option value="supervisors">👥 Supervisor Management</option>
              <option value="reassignment">🔄 Reassignments & Unlocks</option>
              <option value="cycle">📅 Assessment Cycle Setup</option>
              <option value="system">⚙️ System & Initialization</option>
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{totalCount}</strong> entries
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Loading system audit log trail...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger)' }}>
            <p style={{ fontWeight: 600 }}>Error loading audit entries: {error}</p>
            <button
              onClick={fetchLogs}
              style={{
                marginTop: 12,
                padding: '8px 16px',
                borderRadius: 6,
                background: 'var(--border)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No audit records matched your search query.</p>
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
              }}
              style={{
                marginTop: 10,
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2, var(--bg))', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', width: '14%' }}>
                    Date & Time
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', width: '18%' }}>
                    Performed By
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', width: '18%' }}>
                    Action Type
                  </th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Plain-English Description & Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const { dateFormatted, timeFormatted } = formatTimestamp(log.createdAt);
                  const isExpanded = expandedDetailsId === log._id;

                  return (
                    <tr
                      key={log._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {dateFormatted}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {timeFormatted}
                        </div>
                      </td>

                      {/* Actor */}
                      <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: log.actor.role === 'Superadmin'
                              ? 'linear-gradient(135deg, #FF0C34 0%, #99001A 100%)'
                              : 'var(--border)',
                            color: log.actor.role === 'Superadmin' ? '#FFFFFF' : 'var(--text)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0,
                          }}>
                            {log.actor.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                              {log.actor.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {log.actor.staffId && (
                                <span style={{ fontFamily: 'var(--font-mono)' }}>
                                  {log.actor.staffId}
                                </span>
                              )}
                              <span>•</span>
                              <span style={{ fontWeight: 600 }}>{log.actor.role}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                        <div>{getActionBadge(log.category, log.actionLabel, log.rawAction)}</div>
                        {log.target.label && log.target.label !== 'System Record' && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                            Target: <strong style={{ color: 'var(--text)' }}>{log.target.label}</strong>
                          </div>
                        )}
                      </td>

                      {/* Human-Readable Summary Narrative */}
                      <td style={{ padding: '16px 18px', verticalAlign: 'top' }}>
                        <div style={{
                          fontSize: 13,
                          color: 'var(--text)',
                          lineHeight: 1.5,
                          fontWeight: 500,
                        }}>
                          {log.summary}
                        </div>

                        {/* Attribute Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                          {log.metadata?.createdStaffId && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              fontSize: 11,
                              color: 'var(--text-dim)',
                              fontFamily: 'var(--font-mono)',
                            }}>
                              Staff ID: <strong>{log.metadata.createdStaffId}</strong>
                            </span>
                          )}

                          {log.metadata?.createdEmail && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'var(--bg)',
                              border: '1px solid var(--border)',
                              fontSize: 11,
                              color: 'var(--text-dim)',
                            }}>
                              Email: <strong>{log.metadata.createdEmail}</strong>
                            </span>
                          )}

                          {Array.isArray(log.metadata?.assignedRoles) && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(255, 12, 52, 0.06)',
                              border: '1px solid rgba(255, 12, 52, 0.2)',
                              fontSize: 11,
                              color: 'var(--accent, #FF0C34)',
                              fontWeight: 600,
                            }}>
                              Roles: {log.metadata.assignedRoles.join(', ')}
                            </span>
                          )}

                          {/* Technical JSON Toggle Button */}
                          <button
                            type="button"
                            onClick={() => setExpandedDetailsId(isExpanded ? null : log._id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-dim)',
                              fontSize: 11,
                              cursor: 'pointer',
                              padding: '2px 6px',
                              textDecoration: 'underline',
                              marginLeft: 'auto',
                            }}
                          >
                            {isExpanded ? 'Hide technical data' : 'Raw details'}
                          </button>
                        </div>

                        {/* Collapsible Raw Technical Data */}
                        {isExpanded && (
                          <div style={{
                            marginTop: 10,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'var(--bg)',
                            border: '1px solid var(--border)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--text-dim)',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}>
                            {JSON.stringify({
                              rawAction: log.rawAction,
                              targetType: log.target.type,
                              targetId: log.target.id,
                              metadata: log.metadata,
                            }, null, 2)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
