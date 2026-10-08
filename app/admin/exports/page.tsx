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
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#002147', margin: 0 }}>
          Export & Archival Center
        </h1>
        <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: 14 }}>
          Generate comprehensive cohort Excel workbooks, paired evaluation archives, and print bundles.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Excel Export Card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 28, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
            Master Excel Spreadsheet (.xlsx)
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
            Exports all paired trainee and supervisor responses. Contains two sheets:
            <br />• <strong>Assessments Master:</strong> Wide format (1 row per trainee, all fields in columns)
            <br />• <strong>Responses Long Format:</strong> Normalized key-value rows for BI analytics
          </p>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Select Cohort / Cycle:
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
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
                background: '#16a34a',
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
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 28, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🖨️</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#002147', margin: 0 }}>
            Print-Ready Official PDF Records
          </h2>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
            Generate pixel-perfect official Genesis Group assessment bundles for cohort archival, committee reviews, and physical personnel filing.
          </p>

          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Select Cohort / Cycle:
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, outline: 'none' }}
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
              href={`/admin/print/bulk?cycleId=${selectedCycleId}&status=complete`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 22px',
                borderRadius: 8,
                background: '#c8102e',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(200, 16, 46, 0.3)',
              }}
            >
              🖨️ Bulk Print Cohort Bundle (PDF) ↗
            </a>

            <a
              href={`/admin/cycles/${selectedCycleId}/tracker`}
              style={{
                display: 'inline-block',
                padding: '11px 18px',
                borderRadius: 8,
                background: '#f1f5f9',
                color: '#334155',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 13,
                border: '1px solid #cbd5e1',
              }}
            >
              Custom Select in Tracker →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
