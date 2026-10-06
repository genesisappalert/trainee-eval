'use client';

import { useEffect, useState } from 'react';

interface AuditItem {
  _id: string;
  actorId: { _id: string; name: string; staffId: string; email: string } | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  cycleId: { name: string; slug: string } | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async (action?: string) => {
    try {
      setLoading(true);
      const url = action ? `/api/audit?action=${action}` : '/api/audit';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(actionFilter);
  }, [actionFilter]);

  const getActionBadge = (action: string) => {
    if (action.includes('submitted')) {
      return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534' }}>{action}</span>;
    }
    if (action.includes('reassigned') || action.includes('reopened')) {
      return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>{action}</span>;
    }
    if (action.includes('password') || action.includes('lock')) {
      return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>{action}</span>;
    }
    return <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>{action}</span>;
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#002147', margin: 0 }}>
          System Audit Log Trail
        </h1>
        <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
          Tamper-evident chronological log of all HR administrative actions, supervisor submissions, reassignments, and sheet unlocks.
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', outline: 'none' }}
          >
            <option value="">All Actions</option>
            <option value="supervisor_sheet_submitted">supervisor_sheet_submitted</option>
            <option value="supervisor_reassigned">supervisor_reassigned</option>
            <option value="supervisor_sheet_reopened">supervisor_sheet_reopened</option>
            <option value="trainee_sheet_reopened">trainee_sheet_reopened</option>
            <option value="trainee_link_reissued">trainee_link_reissued</option>
            <option value="supervisor_created">supervisor_created</option>
            <option value="cycle_created">cycle_created</option>
            <option value="system_initialized">system_initialized</option>
          </select>

          <span style={{ fontSize: 13, color: '#64748b' }}>
            Showing <strong>{logs.length}</strong> event entries
          </span>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p>Loading audit entries...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
            No audit records found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 20px', width: '18%' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px', width: '20%' }}>Actor</th>
                  <th style={{ padding: '12px 16px', width: '22%' }}>Action</th>
                  <th style={{ padding: '12px 16px', width: '15%' }}>Target</th>
                  <th style={{ padding: '12px 20px' }}>Context Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 20px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {log.actorId?.name || 'System / Automated'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {log.actorId?.staffId || log.actorRole}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getActionBadge(log.action)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                      {log.targetType} ({log.targetId?.slice(-6)})
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
