'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionProvider } from 'next-auth/react';
import { ThemeToggle } from '@/components/ThemeToggle';

function SupervisorNavbar() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const user = session?.user as any;
  const isHr = user?.roles?.includes('hr_admin');

  return (
    <nav style={{
      background: 'var(--bg)',
      color: 'var(--text)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: 'var(--shadow-sm)',
      transition: 'background 0.2s ease, border-color 0.2s ease',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 24px',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/supervisor" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
            <div style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src="/genesis-logo.png"
                alt="Genesis Group"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em', lineHeight: 1.2, color: 'var(--text)' }}>
                GENESIS GROUP
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
                MTP SUPERVISOR PORTAL
              </div>
            </div>
          </Link>
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isHr && (
            <Link
              href="/admin"
              className="gh-btn gh-btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              Switch to HR Admin
            </Link>
          )}

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              {user?.name || 'Supervisor'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Staff ID: {user?.staffId || '—'}
            </span>
          </div>

          <ThemeToggle />

          <button
            onClick={handleSignOut}
            className="gh-btn gh-btn-ghost"
            style={{ fontSize: 12, padding: '7px 14px' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
        <SupervisorNavbar />
        <main>{children}</main>
      </div>
    </SessionProvider>
  );
}
