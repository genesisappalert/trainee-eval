'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';

interface AdminItem {
  _id: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  location: string;
  roles: string[];
  accessCode: string | null;
  active: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export default function AdminsManagementPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [callerIsSuperAdmin, setCallerIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'superadmin' | 'hr_admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createRole, setCreateRole] = useState<'superadmin' | 'hr_admin'>('superadmin');
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Human Resources');
  const [location, setLocation] = useState('HQ Port Harcourt');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSupervisorAlso, setIsSupervisorAlso] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Created Success Modal (for sharing temporary credentials)
  const [createdSummary, setCreatedSummary] = useState<{
    staffId: string;
    name: string;
    email: string;
    role: string;
    password?: string;
    accessCode?: string | null;
  } | null>(null);

  // Reset Password Modal
  const [resetModalAdmin, setResetModalAdmin] = useState<AdminItem | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Custom Confirmation Alert Modal State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    badge?: string;
    message: string;
    detail?: string;
    confirmLabel: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admins');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load administrators');
      }
      const data = await res.json();
      setAdmins(data.admins || []);
      setCallerIsSuperAdmin(data.callerIsSuperAdmin ?? false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const triggerErrorToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = 'Gen#';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(result);
  };

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setStaffId('');
    setName('');
    setEmail('');
    setDepartment('Human Resources');
    setLocation('HQ Port Harcourt');
    setPassword('');
    setShowPassword(false);
    setIsSupervisorAlso(false);
    // If caller is superadmin, default to superadmin, otherwise hr_admin
    setCreateRole(callerIsSuperAdmin ? 'superadmin' : 'hr_admin');
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!staffId.trim() || !name.trim() || !email.trim() || !password) {
      setCreateError('Please complete all required fields.');
      return;
    }
    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: staffId.trim().toUpperCase(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department.trim(),
          location: location.trim(),
          role: createRole,
          password,
          isSupervisorAlso,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create administrator');
      }

      setCreateModalOpen(false);
      setCreatedSummary({
        staffId: data.user.staffId,
        name: data.user.name,
        email: data.user.email,
        role: createRole,
        password: password,
        accessCode: data.user.accessCode,
      });

      triggerToast(`Successfully created ${createRole === 'superadmin' ? 'Superadmin' : 'HR Admin'} ${data.user.name}`);
      fetchAdmins();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActiveClick = (admin: AdminItem) => {
    const nextStatus = !admin.active;
    setConfirmDialog({
      isOpen: true,
      title: nextStatus ? 'Reactivate Administrator' : 'Deactivate Administrator',
      badge: nextStatus ? 'Access Restored' : 'Account Suspension',
      isDestructive: !nextStatus,
      message: nextStatus
        ? `Reactivate administrative privileges for ${admin.name}?`
        : `Deactivate administrative access for ${admin.name}?`,
      detail: nextStatus
        ? `${admin.name} will be able to log in to the management console with their existing credentials.`
        : `${admin.name} will be immediately prevented from logging into the portal. Their previous assessment activity will remain on record.`,
      confirmLabel: nextStatus ? 'Yes, Reactivate' : 'Yes, Deactivate',
      onConfirm: async () => {
        try {
          setConfirmSubmitting(true);
          const res = await fetch(`/api/admins/${admin._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: nextStatus }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to update admin status');
          }

          triggerToast(`${admin.name} has been ${nextStatus ? 'reactivated' : 'deactivated'}.`);
          setConfirmDialog(null);
          fetchAdmins();
        } catch (err: any) {
          triggerErrorToast(err.message);
        } finally {
          setConfirmSubmitting(false);
        }
      },
    });
  };

  const handleDeleteAdminClick = (admin: AdminItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete Administrator',
      badge: 'Irreversible Action',
      isDestructive: true,
      message: `Are you sure you want to completely delete ${admin.name} (${admin.staffId})?`,
      detail: `This will permanently remove their administrator profile and console credentials from the database. This action cannot be reversed.`,
      confirmLabel: 'Permanently Delete',
      onConfirm: async () => {
        try {
          setConfirmSubmitting(true);
          const res = await fetch(`/api/admins/${admin._id}`, {
            method: 'DELETE',
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to delete administrator');
          }

          triggerToast(`Administrator ${admin.name} permanently deleted.`);
          setConfirmDialog(null);
          fetchAdmins();
        } catch (err: any) {
          triggerErrorToast(err.message);
        } finally {
          setConfirmSubmitting(false);
        }
      },
    });
  };

  const handleUnlockAccount = async (admin: AdminItem) => {
    try {
      const res = await fetch(`/api/admins/${admin._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlock: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock account');

      triggerToast(`Account unlocked for ${admin.name}.`);
      fetchAdmins();
    } catch (err: any) {
      triggerErrorToast(err.message);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalAdmin) return;
    setResetError(null);

    if (resetPasswordVal.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }

    try {
      setResetting(true);
      const res = await fetch(`/api/admins/${resetModalAdmin._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordVal }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      triggerToast(`Password reset successfully for ${resetModalAdmin.name}`);
      setResetModalAdmin(null);
      setResetPasswordVal('');
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetting(false);
    }
  };

  // Filtered List
  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.staffId.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q);

      const isSuper = a.roles.includes('superadmin');
      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'superadmin' && isSuper) ||
        (roleFilter === 'hr_admin' && !isSuper);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && a.active) ||
        (statusFilter === 'inactive' && !a.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [admins, search, roleFilter, statusFilter]);

  // Statistics
  const totalCount = admins.length;
  const superAdminCount = admins.filter((a) => a.roles.includes('superadmin')).length;
  const hrAdminCount = admins.filter((a) => a.roles.includes('hr_admin') && !a.roles.includes('superadmin')).length;
  const activeCount = admins.filter((a) => a.active).length;

  const currentUserId = (session?.user as any)?.id;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: 'var(--success, #16a34a)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          fontSize: 14,
          animation: 'fadeIn 0.2s ease',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {successToast}
        </div>
      )}

      {errorToast && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          background: 'var(--danger, #DC2626)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontWeight: 600,
          fontSize: 14,
          animation: 'fadeIn 0.2s ease',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorToast}
        </div>
      )}

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
              System Governance
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
              Access Control & Roles
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Admins & Roles Management
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-dim)', fontSize: 14 }}>
            Manage platform Superadmins and HR Administrators with elevated system privileges.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={fetchAdmins}
            title="Refresh directory"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleOpenCreateModal}
            style={{
              padding: '11px 22px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #FF0C34)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255, 12, 52, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'transform 0.15s ease, background 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Add Superadmin / Admin
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
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
            Total Administrators
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            System accounts with console access
          </div>
        </div>

        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 14,
          padding: '20px 22px',
          border: '1px solid rgba(255, 12, 52, 0.25)',
          boxShadow: 'var(--shadow)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--accent, #FF0C34)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #FF0C34)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Superadmins
            </div>
            <span style={{
              background: 'rgba(255, 12, 52, 0.1)',
              color: 'var(--accent, #FF0C34)',
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 20,
            }}>
              ROOT LEVEL
            </span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {superAdminCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Can create and manage Superadmins
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
            HR Administrators
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', marginTop: 8 }}>
            {hrAdminCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            Cycle & assessment managers
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
            Active Accounts
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--success, #16a34a)', marginTop: 8 }}>
            {activeCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
            {totalCount - activeCount > 0 ? `${totalCount - activeCount} currently deactivated` : '100% active and healthy'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
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
                placeholder="Search by name, staff ID, or email..."
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

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Roles</option>
              <option value="superadmin">Superadmins Only</option>
              <option value="hr_admin">HR Admins Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 600 }}>
            Showing <strong>{filteredAdmins.length}</strong> of <strong>{totalCount}</strong> admins
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Loading administration directory...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--danger)' }}>
            <p style={{ fontWeight: 600 }}>Error loading admins: {error}</p>
            <button
              onClick={fetchAdmins}
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
              Try Again
            </button>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No administrators matched your filters.</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Try clearing your search query or reset filters.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-2, var(--bg))', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Administrator
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Role & Access
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Department & Location
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Status
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Created
                  </th>
                  <th style={{ padding: '12px 18px', fontWeight: 700, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => {
                  const isSuper = admin.roles.includes('superadmin');
                  const isCurrent = admin._id === currentUserId;
                  const isLocked = Boolean(admin.lockedUntil && new Date(admin.lockedUntil) > new Date());

                  return (
                    <tr
                      key={admin._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isCurrent ? 'rgba(255, 12, 52, 0.02)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Name & Staff ID */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: isSuper
                              ? 'linear-gradient(135deg, #FF0C34 0%, #99001A 100%)'
                              : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 14,
                            boxShadow: isSuper ? '0 2px 8px rgba(255, 12, 52, 0.3)' : 'none',
                          }}>
                            {admin.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {admin.name}
                              {isCurrent && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'var(--border)',
                                  color: 'var(--text-dim)',
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                              {admin.staffId} • {admin.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Access */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {isSuper ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 800,
                              background: 'rgba(255, 12, 52, 0.12)',
                              color: 'var(--accent, #FF0C34)',
                              border: '1px solid rgba(255, 12, 52, 0.3)',
                              letterSpacing: '0.03em',
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                              </svg>
                              SUPERADMIN
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 10px',
                              borderRadius: 20,
                              fontSize: 11,
                              fontWeight: 700,
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563EB',
                              border: '1px solid rgba(37, 99, 235, 0.25)',
                            }}>
                              HR ADMIN
                            </span>
                          )}

                          {admin.roles.includes('supervisor') && (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: 20,
                              fontSize: 10,
                              fontWeight: 600,
                              background: 'var(--border)',
                              color: 'var(--text-dim)',
                            }} title={`Access Code: ${admin.accessCode || 'None'}`}>
                              + Supervisor
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Department & Location */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {admin.department || 'Human Resources'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                          {admin.location || 'HQ Port Harcourt'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 18px' }}>
                        {isLocked ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(217, 119, 6, 0.1)',
                            color: '#D97706',
                          }}>
                            Locked Out
                          </span>
                        ) : admin.active ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(22, 163, 74, 0.1)',
                            color: '#16A34A',
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                            Active
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background: 'rgba(100, 116, 139, 0.12)',
                            color: '#64748B',
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748B' }} />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Created */}
                      <td style={{ padding: '14px 18px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {new Date(admin.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {isLocked && (
                            <button
                              onClick={() => handleUnlockAccount(admin)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: 6,
                                border: '1px solid #D97706',
                                background: 'transparent',
                                color: '#D97706',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Unlock
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setResetModalAdmin(admin);
                              setResetPasswordVal('');
                              setResetError(null);
                            }}
                            title="Reset admin password"
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--bg)',
                              color: 'var(--text)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reset Password
                          </button>

                          {/* Only allow deactivation/deletion if not current user */}
                          {!isCurrent && (
                            <>
                              <button
                                onClick={() => handleToggleActiveClick(admin)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: admin.active
                                    ? '1px solid rgba(220, 38, 38, 0.3)'
                                    : '1px solid rgba(22, 163, 74, 0.3)',
                                  background: 'transparent',
                                  color: admin.active ? 'var(--danger, #DC2626)' : 'var(--success, #16A34A)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {admin.active ? 'Deactivate' : 'Reactivate'}
                              </button>

                              <button
                                onClick={() => handleDeleteAdminClick(admin)}
                                title="Permanently delete administrator"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 6,
                                  border: '1px solid rgba(220, 38, 38, 0.25)',
                                  background: 'rgba(220, 38, 38, 0.05)',
                                  color: 'var(--danger, #DC2626)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Delete
                              </button>
                            </>
                          )}
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

      {/* CREATE ADMIN / SUPERADMIN MODAL */}
      {createModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16,
            maxWidth: 580,
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  Provision Administrator Account
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
                  Create a new Superadmin or HR Admin with console login access.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} style={{ padding: '24px' }}>
              {createError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  color: 'var(--danger, #DC2626)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 20,
                }}>
                  {createError}
                </div>
              )}

              {/* ROLE SELECTOR CARDS */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                  Select Administrative Role *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Superadmin Option */}
                  <div
                    onClick={() => {
                      if (callerIsSuperAdmin) setCreateRole('superadmin');
                    }}
                    style={{
                      border: createRole === 'superadmin' ? '2px solid var(--accent, #FF0C34)' : '1px solid var(--border)',
                      background: createRole === 'superadmin' ? 'rgba(255, 12, 52, 0.05)' : 'var(--bg)',
                      borderRadius: 12,
                      padding: 14,
                      cursor: callerIsSuperAdmin ? 'pointer' : 'not-allowed',
                      opacity: callerIsSuperAdmin ? 1 : 0.55,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent, #FF0C34)' }}>
                        Superadmin
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        background: 'rgba(255, 12, 52, 0.15)',
                        color: 'var(--accent, #FF0C34)',
                        padding: '2px 6px',
                        borderRadius: 10,
                      }}>
                        ROOT
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Full system authority. Can create & manage other Superadmins, HR Admins, and system policies.
                    </p>
                    {!callerIsSuperAdmin && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 6, fontWeight: 600 }}>
                        Requires Superadmin caller
                      </div>
                    )}
                  </div>

                  {/* HR Admin Option */}
                  <div
                    onClick={() => setCreateRole('hr_admin')}
                    style={{
                      border: createRole === 'hr_admin' ? '2px solid #2563EB' : '1px solid var(--border)',
                      background: createRole === 'hr_admin' ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg)',
                      borderRadius: 12,
                      padding: 14,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: '#2563EB' }}>
                        HR Admin
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 800,
                        background: 'rgba(37, 99, 235, 0.15)',
                        color: '#2563EB',
                        padding: '2px 6px',
                        borderRadius: 10,
                      }}>
                        STANDARD
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.4 }}>
                      Manages assessment rounds, supervisor rosters, trainees, audits, and generates executive Excel exports.
                    </p>
                  </div>
                </div>
              </div>

              {/* Staff ID & Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Staff ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GEN-ADM-002"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ngozi Chinedu"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ngozi.chinedu@genesisgroup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Department & Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Human Resources"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HQ Port Harcourt"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Initial Password */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Initial Login Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent, #FF0C34)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ⚡ Suggest Strong Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: showPassword ? 'var(--font-mono)' : 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Dual Role Option */}
              <div style={{
                marginBottom: 24,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}>
                <input
                  type="checkbox"
                  id="supervisorToggle"
                  checked={isSupervisorAlso}
                  onChange={(e) => setIsSupervisorAlso(e.target.checked)}
                  style={{ marginTop: 3, cursor: 'pointer' }}
                />
                <label htmlFor="supervisorToggle" style={{ fontSize: 12, color: 'var(--text)', cursor: 'pointer', lineHeight: 1.4 }}>
                  <strong>Also grant Supervisor evaluation privileges</strong>
                  <br />
                  <span style={{ color: 'var(--text-dim)' }}>
                    Automatically generates an Access Code so this administrator can also evaluate assigned trainees in the supervisor portal.
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent, #FF0C34)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(255, 12, 52, 0.25)',
                  }}
                >
                  {creating ? 'Provisioning...' : `Create ${createRole === 'superadmin' ? 'Superadmin' : 'HR Admin'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATED SUMMARY MODAL */}
      {createdSummary && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16,
            maxWidth: 500,
            width: '100%',
            padding: 24,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(22, 163, 74, 0.12)',
              color: 'var(--success, #16A34A)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
              Administrator Successfully Created!
            </h3>
            <p style={{ margin: '6px 0 16px 0', fontSize: 13, color: 'var(--text-dim)' }}>
              Share these login credentials securely with <strong>{createdSummary.name}</strong>.
            </p>

            <div style={{
              background: 'var(--bg)',
              borderRadius: 12,
              padding: 16,
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              marginBottom: 20,
            }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Role:</span>
                <span style={{ fontWeight: 700, color: createdSummary.role === 'superadmin' ? 'var(--accent, #FF0C34)' : '#2563EB' }}>
                  {createdSummary.role.toUpperCase()}
                </span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Staff ID:</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{createdSummary.staffId}</span>
              </div>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Email:</span>
                <span style={{ color: 'var(--text)' }}>{createdSummary.email}</span>
              </div>
              <div style={{ marginBottom: createdSummary.accessCode ? 8 : 0, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Password:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent, #FF0C34)' }}>{createdSummary.password}</span>
              </div>
              {createdSummary.accessCode && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Supervisor Code:</span>
                  <span style={{ fontWeight: 700, color: '#16A34A' }}>{createdSummary.accessCode}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  const text = `Genesis Assessment Portal Credentials:\nRole: ${createdSummary.role}\nStaff ID: ${createdSummary.staffId}\nPassword: ${createdSummary.password}${createdSummary.accessCode ? `\nSupervisor Code: ${createdSummary.accessCode}` : ''}\nLogin URL: ${window.location.origin}/login`;
                  navigator.clipboard.writeText(text);
                  triggerToast('Credentials copied to clipboard!');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                📋 Copy Credentials
              </button>
              <button
                onClick={() => setCreatedSummary(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent, #FF0C34)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalAdmin && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16,
            maxWidth: 440,
            width: '100%',
            padding: 24,
            border: '1px solid var(--border)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.2s ease',
          }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
              Reset Password for {resetModalAdmin.name}
            </h3>
            <p style={{ margin: '6px 0 16px 0', fontSize: 13, color: 'var(--text-dim)' }}>
              Set a new secure password for Staff ID: <strong>{resetModalAdmin.staffId}</strong>.
            </p>

            {resetError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(220, 38, 38, 0.1)',
                color: 'var(--danger)',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 16,
              }}>
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    required
                    placeholder="Enter new password (min 6 characters)"
                    value={resetPasswordVal}
                    onChange={(e) => setResetPasswordVal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 42px 10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    {showResetPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setResetModalAdmin(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent, #FF0C34)',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: resetting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resetting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CUSTOM CONFIRMATION ALERT MODAL */}
      {confirmDialog && confirmDialog.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.68)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 16,
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 16,
            maxWidth: 460,
            width: '100%',
            padding: 24,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
            position: 'relative',
          }}>
            {/* Header Icon + Badge */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: confirmDialog.isDestructive
                  ? 'rgba(220, 38, 38, 0.12)'
                  : 'rgba(37, 99, 235, 0.12)',
                color: confirmDialog.isDestructive
                  ? 'var(--danger, #DC2626)'
                  : '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {confirmDialog.isDestructive ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>

              {confirmDialog.badge && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 12,
                  letterSpacing: '0.04em',
                  background: confirmDialog.isDestructive ? 'rgba(220, 38, 38, 0.1)' : 'rgba(37, 99, 235, 0.1)',
                  color: confirmDialog.isDestructive ? 'var(--danger, #DC2626)' : '#2563EB',
                }}>
                  {confirmDialog.badge.toUpperCase()}
                </span>
              )}
            </div>

            {/* Title & Body */}
            <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
              {confirmDialog.title}
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
              {confirmDialog.message}
            </p>

            {confirmDialog.detail && (
              <div style={{
                background: 'var(--bg)',
                borderRadius: 8,
                padding: '10px 12px',
                border: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--text-dim)',
                lineHeight: 1.45,
                marginBottom: 20,
              }}>
                {confirmDialog.detail}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: confirmDialog.detail ? 0 : 20 }}>
              <button
                type="button"
                disabled={confirmSubmitting}
                onClick={() => setConfirmDialog(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                disabled={confirmSubmitting}
                onClick={() => confirmDialog.onConfirm()}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: confirmDialog.isDestructive ? 'var(--danger, #DC2626)' : 'var(--accent, #FF0C34)',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: confirmSubmitting ? 'not-allowed' : 'pointer',
                  opacity: confirmSubmitting ? 0.7 : 1,
                  boxShadow: confirmDialog.isDestructive
                    ? '0 4px 12px rgba(220, 38, 38, 0.25)'
                    : '0 4px 12px rgba(255, 12, 52, 0.25)',
                }}
              >
                {confirmSubmitting ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
