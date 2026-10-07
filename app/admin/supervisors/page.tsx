'use client';

import { useEffect, useState } from 'react';

interface SupervisorItem {
  _id: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  accessCode: string | null;
  active: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  assignedCount: number;
  completedCount: number;
  createdAt: string;
}

export default function AdminSupervisorsPage() {
  const [supervisors, setSupervisors] = useState<SupervisorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modals
  const [singleModalOpen, setSingleModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  // Single form state
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [customAccessCode, setCustomAccessCode] = useState('');
  const [accessCodeModal, setAccessCodeModal] = useState<{ name: string; staffId: string; accessCode: string } | null>(null);

  // Bulk state
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResult, setBulkResult] = useState<any[] | null>(null);

  const fetchSupervisors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/supervisors');
      if (!res.ok) throw new Error('Failed to load supervisors');
      const data = await res.json();
      setSupervisors(data.supervisors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          name,
          email,
          department,
          location,
          customAccessCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create supervisor');

      setSingleModalOpen(false);
      setStaffId('');
      setName('');
      setEmail('');
      setDepartment('');
      setLocation('');
      setCustomAccessCode('');

      setAccessCodeModal({
        name: data.user.name,
        staffId: data.user.staffId,
        accessCode: data.user.accessCode,
      });
      fetchSupervisors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRegenerateCode = async (sup: SupervisorItem) => {
    if (!confirm(`Generate a new access code for ${sup.name}? Their previous code will stop working.`)) return;
    try {
      const res = await fetch(`/api/supervisors/${sup._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_access_code' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate code');

      setAccessCodeModal({
        name: sup.name,
        staffId: sup.staffId,
        accessCode: data.accessCode,
      });
      fetchSupervisors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkSubmit = async () => {
    if (!bulkCsvText.trim()) return;
    try {
      setBulkSubmitting(true);
      const lines = bulkCsvText.trim().split('\n');
      const items: any[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(',').map((p) => p.trim());
        if (parts[0].toLowerCase() === 'staffid' || parts[0].toLowerCase() === 'staff_id') continue;
        items.push({
          staffId: parts[0] || '',
          name: parts[1] || '',
          email: parts[2] || '',
          department: parts[3] || '',
          location: parts[4] || '',
          accessCode: parts[5] || '',
        });
      }

      const res = await fetch('/api/supervisors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisors: items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk upload failed');

      setBulkResult(data.created || []);
      fetchSupervisors();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleToggleActive = async (sup: SupervisorItem) => {
    try {
      const res = await fetch(`/api/supervisors/${sup._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active' }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchSupervisors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnlock = async (sup: SupervisorItem) => {
    try {
      const res = await fetch(`/api/supervisors/${sup._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock' }),
      });
      if (!res.ok) throw new Error('Failed to unlock account');
      alert('Account unlocked successfully');
      fetchSupervisors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToClipboard = (text: string, label: string = 'Access code') => {
    navigator.clipboard.writeText(text);
    alert(`${label} (${text}) copied to clipboard!`);
  };

  const filtered = supervisors.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.staffId.toLowerCase().includes(q) ||
      (s.accessCode && s.accessCode.toLowerCase().includes(q)) ||
      s.department.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

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
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#002147', margin: 0 }}>
            Supervisor Management Directory
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
            Generate and manage Supervisor Access Codes for instant passwordless portal logins.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              setBulkResult(null);
              setBulkModalOpen(true);
            }}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            📂 Bulk CSV Import
          </button>
          <button
            onClick={() => setSingleModalOpen(true)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#002147',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 33, 71, 0.2)',
            }}
          >
            + Add Supervisor & Generate Code
          </button>
        </div>
      </div>

      {/* Directory Box */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <input
            type="text"
            placeholder="Search by name, staff ID, or access code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, minWidth: 320, outline: 'none', background: '#fff' }}
          />
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            Active Supervisors: <strong>{supervisors.length}</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <p>Loading supervisors...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
            No supervisors match your search.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 20px' }}>Supervisor Name</th>
                  <th style={{ padding: '12px 16px' }}>Staff ID</th>
                  <th style={{ padding: '12px 16px' }}>Access Code (Login Key)</th>
                  <th style={{ padding: '12px 16px' }}>Department & Location</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Trainee Load</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sup) => {
                  const isLocked = sup.lockedUntil && new Date(sup.lockedUntil) > new Date();

                  return (
                    <tr
                      key={sup._id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{sup.name}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{sup.email}</div>
                      </td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                        {sup.staffId}
                      </td>

                      {/* Access Code Column */}
                      <td style={{ padding: '14px 16px' }}>
                        {sup.accessCode ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#002147', letterSpacing: '0.04em' }}>
                              {sup.accessCode}
                            </span>
                            <button
                              onClick={() => copyToClipboard(sup.accessCode!, 'Access code')}
                              title="Copy Access Code"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}
                            >
                              📋
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>No code set</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{sup.department || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{sup.location || '—'}</div>
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        {isLocked ? (
                          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b' }}>
                            🔒 Locked
                          </span>
                        ) : sup.active ? (
                          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534' }}>
                            Active
                          </span>
                        ) : (
                          <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#e2e8f0', color: '#64748b' }}>
                            Deactivated
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 700, color: '#002147' }}>{sup.assignedCount}</span> assigned (
                        <span style={{ color: '#16a34a' }}>{sup.completedCount} done</span>)
                      </td>

                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {isLocked && (
                            <button
                              onClick={() => handleUnlock(sup)}
                              style={{ padding: '5px 10px', borderRadius: 6, background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                            >
                              Unlock
                            </button>
                          )}
                          <button
                            onClick={() => handleRegenerateCode(sup)}
                            style={{ padding: '5px 10px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#002147', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                          >
                            New Code
                          </button>
                          <button
                            onClick={() => handleToggleActive(sup)}
                            style={{ padding: '5px 8px', borderRadius: 6, background: 'none', border: 'none', color: sup.active ? '#94a3b8' : '#16a34a', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                          >
                            {sup.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SINGLE SUPERVISOR MODAL */}
      {singleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <form onSubmit={handleCreateSingle} style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>Add Supervisor</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              The system will assign an Access Code so the supervisor can log in without needing a password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Staff ID: *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GEN-SUP-012"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Full Name: *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nkechi Okafor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Work Email: *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. nkechi.okafor@genesisgroup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Department:</label>
                  <input
                    type="text"
                    placeholder="e.g. Restaurant Ops"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Location:</label>
                  <input
                    type="text"
                    placeholder="e.g. Port Harcourt"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  Custom Access Code (Optional — leave blank to auto-generate):
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for auto-generated (e.g. SUP-492014)"
                  value={customAccessCode}
                  onChange={(e) => setCustomAccessCode(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setSingleModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#002147', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Create & Generate Code
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BULK CSV MODAL */}
      {bulkModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 650, width: '100%', padding: 28 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>Bulk Import Supervisors</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Paste rows below. Format: <span style={{ fontFamily: 'monospace' }}>staffId, name, email, department, location, [optional accessCode]</span>
            </p>

            {bulkResult ? (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', marginBottom: 12 }}>
                  ✓ Successfully Imported {bulkResult.length} Supervisors & Generated Access Codes:
                </div>
                <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', padding: 12 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', fontWeight: 700 }}>
                        <th style={{ padding: '4px 8px' }}>Staff ID</th>
                        <th style={{ padding: '4px 8px' }}>Name</th>
                        <th style={{ padding: '4px 8px' }}>Access Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.staffId}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 600 }}>{r.name}</td>
                          <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 800, color: '#002147' }}>{r.accessCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => {
                      const text = bulkResult.map((r) => `${r.staffId}\t${r.name}\t${r.accessCode}`).join('\n');
                      navigator.clipboard.writeText(text);
                      alert('Copied all credentials to clipboard!');
                    }}
                    style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                  >
                    📋 Copy All to Clipboard
                  </button>
                  <button
                    onClick={() => {
                      setBulkModalOpen(false);
                      setBulkResult(null);
                    }}
                    style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#002147', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  rows={8}
                  placeholder="GEN-SUP-101, Chidi Obi, chidi.obi@genesisgroup.com, Operations, Port Harcourt&#10;GEN-SUP-102, Amina Bello, amina.bello@genesisgroup.com, Finance, Lagos"
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', outline: 'none', marginTop: 14, boxSizing: 'border-box' }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                  <button
                    onClick={() => setBulkModalOpen(false)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={bulkSubmitting}
                    style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#002147', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                  >
                    {bulkSubmitting ? 'Importing...' : 'Import & Generate Codes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ACCESS CODE NOTIFICATION POPUP */}
      {accessCodeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 480, width: '100%', padding: 28, textAlign: 'center' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px auto',
              fontSize: 24,
              fontWeight: 800,
            }}>
              ✓
            </div>

            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#002147' }}>
              Supervisor Access Code Ready
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
              Share this access code with <strong>{accessCodeModal.name}</strong> ({accessCodeModal.staffId}) to log in. No password needed!
            </p>

            <div style={{
              background: '#f8fafc',
              padding: '18px 20px',
              borderRadius: 12,
              border: '2px dashed #002147',
              margin: '20px 0',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Access Code:
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 900,
                color: '#002147',
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                marginTop: 6,
              }}>
                {accessCodeModal.accessCode}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const message = `Genesis Group MTP Assessment Portal: Hi ${accessCodeModal.name}, your supervisor access code is: ${accessCodeModal.accessCode}. Simply enter it at the login page to access your trainee queue.`;
                  navigator.clipboard.writeText(message);
                  alert('Login instructions copied to clipboard!');
                }}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                📋 Copy Invite Message
              </button>
              <button
                onClick={() => setAccessCodeModal(null)}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: '#002147', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
