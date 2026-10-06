'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'supervisor' | 'hr'>('supervisor');

  // Supervisor state
  const [accessCode, setAccessCode] = useState('');

  // HR Admin state
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle Supervisor Access Code Submission
  const handleSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!accessCode.trim()) {
      setError('Please enter your supervisor access code.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        accessCode: accessCode.trim().toUpperCase(),
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid access code or supervisor account is deactivated. Please verify with HR Capital.');
      } else {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (sessionData?.user?.roles?.includes('hr_admin')) {
          router.push('/admin');
        } else {
          router.push('/supervisor');
        }
      }
    } catch {
      setError('An unexpected connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle HR Admin Staff ID + Password Submission
  const handleHrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!staffId.trim() || !password) {
      setError('Staff ID and password are required.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        staffId: staffId.trim().toUpperCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid Staff ID or password. Multiple failed attempts will lock the account.');
      } else {
        router.push('/admin');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 20%, rgba(255, 12, 52, 0.12) 0%, rgba(15, 10, 11, 0) 50%), radial-gradient(circle at 80% 80%, rgba(255, 12, 52, 0.08) 0%, rgba(15, 10, 11, 0) 60%), var(--bg)',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Top right theme toggle */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{
        maxWidth: 460,
        width: '100%',
        background: 'var(--bg-card)',
        borderRadius: 24,
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
        padding: '36px 32px',
        position: 'relative',
        zIndex: 10,
        backdropFilter: 'blur(16px)',
      }}>
        {/* Brand Crest */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 72,
            height: 72,
            margin: '0 auto 14px auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 20,
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            padding: 8,
          }}>
            <img
              src="/genesis-logo.png"
              alt="Genesis Group"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
            Genesis Group
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-dim)', fontSize: 13, fontWeight: 500 }}>
            Management Trainee Programme Appraisal Platform
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 4,
          marginBottom: 24,
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => {
              setMode('supervisor');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: mode === 'supervisor' ? 700 : 500,
              cursor: 'pointer',
              background: mode === 'supervisor' ? 'var(--accent)' : 'transparent',
              color: mode === 'supervisor' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              boxShadow: mode === 'supervisor' ? '0 2px 8px rgba(255, 12, 52, 0.35)' : 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Supervisor Code
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('hr');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              fontSize: 13,
              fontWeight: mode === 'hr' ? 700 : 500,
              cursor: 'pointer',
              background: mode === 'hr' ? 'var(--accent)' : 'transparent',
              color: mode === 'hr' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              boxShadow: mode === 'hr' ? '0 2px 8px rgba(255, 12, 52, 0.35)' : 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            HR Admin Sign In
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'var(--danger-dim)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: 'var(--danger)',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.4,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {/* MODE A: Supervisor Access Code */}
        {mode === 'supervisor' && (
          <form onSubmit={handleSupervisorSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="accessCode" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Supervisor Access Code:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="accessCode"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. SUP-1010 or SUP-XXXXXX"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="gh-input"
                  style={{
                    padding: '12px 14px',
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                />
              </div>
              <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--text-dim)' }}>
                Enter the access code provided to you by HR Talent Management.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gh-btn gh-btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                borderRadius: 10,
              }}
            >
              {loading ? 'Verifying Access Code...' : 'Enter Supervisor Portal →'}
            </button>
          </form>
        )}

        {/* MODE B: HR Admin Login */}
        {mode === 'hr' && (
          <form onSubmit={handleHrSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="staffId" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                HR Staff ID:
              </label>
              <input
                id="staffId"
                type="text"
                required
                autoFocus
                placeholder="e.g. GEN-HR-001"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="gh-input"
                style={{
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.03em',
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                Password:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="gh-input"
                  style={{
                    paddingRight: 44,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-dim)',
                  }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gh-btn gh-btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                borderRadius: 10,
              }}
            >
              {loading ? 'Authenticating...' : 'Sign In as HR Admin →'}
            </button>
          </form>
        )}

        {/* Trainee notice */}
        <div style={{
          marginTop: 26,
          paddingTop: 18,
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}>
          Are you a <strong style={{ color: 'var(--text)' }}>Management Trainee</strong>?
          <br />
          Trainees do not require a login. Access your form directly via your cohort appraisal link.
        </div>
      </div>
    </div>
  );
}
