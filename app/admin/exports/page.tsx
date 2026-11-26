'use client';

import { useEffect, useState } from 'react';

export default function AdminExportsPage() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCycles() {
      try {
        const res = await fetch('/api/cycles');
        if (res.ok) {
          const data = await res.json();
          setCycles(data.cycles || []);
          if (data.cycles?.length > 0) {
            setSelectedCycleId(data.cycles[0]._id);
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadCycles();
  }, []);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 24px' }}>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Export & Archival Center
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-dim)', fontSize: 14 }}>
            Generate comprehensive cohort Excel workbooks, paired evaluation archives, print bundles, and analytical reports.
          </p>
        </div>
        <a
          href="/admin/analytics"
          className="gh-btn gh-btn-primary"
          style={{ textDecoration: 'none', padding: '10px 18px', fontSize: 13 }}
        >
          📈 Open Report Analytics Dashboard →
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24 }}>
        {/* Excel Export Card */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Master Excel Spreadsheet (.xlsx)
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
            Exports all paired trainee and supervisor responses. Contains two sheets:
            <br />• <strong style={{ color: 'var(--text)' }}>Assessments Master:</strong> Wide format (1 row per trainee, all fields & comments in columns)
            <br />• <strong style={{ color: 'var(--text)' }}>Responses Long Format:</strong> Normalized key-value rows for BI analytics
          </p>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              Select Cohort / Cycle:
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="gh-input"
            >
              {cycles.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.cohort})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 24 }}>
            <a
              href={`/api/exports/excel?cycleId=${selectedCycleId}`}
              style={{
                display: 'inline-block',
                padding: '11px 22px',
                borderRadius: 8,
                background: 'var(--success)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              ⬇ Download Excel Workbook
            </a>
          </div>
        </div>

        {/* PDF Document Print Card */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)', padding: 28, boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🖨️</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Print-Ready Official PDF Records
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
            Generate pixel-perfect official Genesis Group assessment bundles for cohort archival, committee reviews, and physical personnel filing.
          </p>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
              Select Cohort / Cycle:
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="gh-input"
            >
              {cycles.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.cohort})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <a
              href={`/api/exports/zip?cycleId=${selectedCycleId}&status=complete`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 22px',
                borderRadius: 8,
                background: 'var(--success)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
              }}
            >
              📦 Download Cohort ZIP (.zip)
            </a>

            <a
              href={`/admin/print/bulk?cycleId=${selectedCycleId}&status=complete`}
              target="_blank"
              rel="noreferrer"
              className="gh-btn gh-btn-primary"
              style={{ textDecoration: 'none', padding: '11px 20px', fontSize: 13 }}
            >
              🖨️ Open Print & Split Viewer ↗
            </a>

            <a
              href={`/admin/cycles/${selectedCycleId}/tracker`}
              className="gh-btn gh-btn-ghost"
              style={{ textDecoration: 'none', padding: '11px 18px', fontSize: 13 }}
            >
              Tracker Selection →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
