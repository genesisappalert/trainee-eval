'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OfficialTraineeDocument, OfficialSupervisorDocument } from '@/components/OfficialFormDocument';

function BulkPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cycleId = searchParams.get('cycleId');
  const ids = searchParams.get('ids');
  const status = searchParams.get('status') || 'complete';

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    count: number;
    cycleName: string | null;
    cohort: string | null;
    items: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isHrCopy, setIsHrCopy] = useState(true);
  const [activeView, setActiveView] = useState<'both' | 'supervisor' | 'trainee'>('both');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadBulkRecords() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (cycleId) params.set('cycleId', cycleId);
        if (ids) params.set('ids', ids);
        if (status) params.set('status', status);

        const res = await fetch(`/api/print/bulk?${params.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load bulk appraisal records');
        }

        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error loading records');
      } finally {
        setLoading(false);
      }
    }

    if (cycleId || ids) {
      loadBulkRecords();
    } else {
      setError('No cycleId or appraisal IDs specified for bulk printing.');
      setLoading(false);
    }
  }, [cycleId, ids, status]);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchTerm.trim()) return data.items;
    const q = searchTerm.toLowerCase();
    return data.items.filter(
      (item) =>
        item.appraisal.traineeName?.toLowerCase().includes(q) ||
        item.appraisal.traineeStaffId?.toLowerCase().includes(q) ||
        item.supervisor?.name?.toLowerCase().includes(q) ||
        item.appraisal.department?.toLowerCase().includes(q)
    );
  }, [data, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 20px auto' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#002147', margin: 0 }}>
          Compiling Official Assessment Bundle...
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
          Preparing pixel-perfect official documents, digital signatures, and evaluation scorecards.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', padding: 32, background: '#fff', borderRadius: 12, border: '1px solid #fee2e2', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ color: '#c8102e', fontSize: 20, fontWeight: 800, margin: 0 }}>
          Unable to Load Bulk Print Records
        </h3>
        <p style={{ color: '#64748b', fontSize: 14, margin: '12px 0 20px 0' }}>{error}</p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '10px 20px',
            background: '#002147',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← Return to Dashboard
        </button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', padding: 36, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>📄</div>
        <h3 style={{ color: '#002147', fontSize: 20, fontWeight: 800, margin: 0 }}>
          No Completed Appraisals Found
        </h3>
        <p style={{ color: '#64748b', fontSize: 14, margin: '12px 0 20px 0' }}>
          There are currently no completed assessment records ready for printing under the selected criteria.
        </p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '10px 20px',
            background: '#002147',
            color: '#fff',
            borderRadius: 8,
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← Back to Tracker
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#525659', minHeight: '100vh', padding: '24px 0' }}>
      {/* Floating Control Toolbar (Hidden during print) */}
      <div
        className="no-print"
        style={{
          maxWidth: 960,
          margin: '0 auto 24px auto',
          background: '#ffffff',
          padding: '14px 24px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          position: 'sticky',
          top: 16,
          zIndex: 50,
        }}
      >
        {/* Left Side: Back & Cohort info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '7px 14px',
              borderRadius: 6,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            ← Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#002147' }}>
                Bulk Print Bundle
              </span>
              <span
                style={{
                  fontSize: 11,
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 700,
                }}
              >
                {filteredItems.length} {filteredItems.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {data.cycleName || 'Assessment Cycle'} {data.cohort ? `(${data.cohort})` : ''}
            </div>
          </div>
        </div>

        {/* Middle: View Mode Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 8,
          }}
        >
          <button
            onClick={() => setActiveView('both')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'both' ? '#002147' : 'transparent',
              color: activeView === 'both' ? '#fff' : '#475569',
            }}
          >
            All Forms (Both)
          </button>
          <button
            onClick={() => setActiveView('supervisor')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'supervisor' ? '#002147' : 'transparent',
              color: activeView === 'supervisor' ? '#fff' : '#475569',
            }}
          >
            Supervisor Forms Only
          </button>
          <button
            onClick={() => setActiveView('trainee')}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'trainee' ? '#002147' : 'transparent',
              color: activeView === 'trainee' ? '#fff' : '#475569',
            }}
          >
            Trainee Forms Only
          </button>
        </div>

        {/* Right Controls: Confidential toggle & Print Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isHrCopy}
              onChange={(e) => setIsHrCopy(e.target.checked)}
            />
            HR Confidential Copy
          </label>

          <button
            onClick={handlePrint}
            style={{
              background: '#c8102e',
              color: '#ffffff',
              border: 'none',
              padding: '9px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 3px 10px rgba(200, 16, 46, 0.35)',
              transition: 'transform 0.1s ease',
            }}
          >
            <span>🖨️</span>
            <span>Print All ({filteredItems.length})</span>
          </button>
        </div>
      </div>

      {/* Trainee Documents Sequence */}
      <div className="printable-documents-wrapper">
        {filteredItems.map((item, idx) => {
          const { appraisal, traineeAnswers, rawTraineeAnswers, supervisorAnswers, supervisor, traineeSignatureSvg, supervisorSignatureSvg } = item;
          const activeTraineeAnswers = isHrCopy && rawTraineeAnswers ? rawTraineeAnswers : traineeAnswers;

          const traineeDocData = {
            traineeName: appraisal.traineeName,
            supervisorName: supervisorAnswers?.s_signature_name || activeTraineeAnswers?.t_supervisor_other || supervisor?.name || '—',
            staffId: appraisal.traineeStaffId,
            appraisalDate: appraisal.traineeSubmittedAt || appraisal.createdAt,
            department: appraisal.department,
            location: appraisal.location,
            answers: activeTraineeAnswers || {},
            signatureDataUrl: traineeSignatureSvg || activeTraineeAnswers?.t_signature,
          };

          const supervisorDocData = {
            supervisorName: supervisorAnswers?.s_signature_name || supervisor?.name || '—',
            traineeName: appraisal.traineeName,
            staffId: supervisorAnswers?.s_staff_id || supervisor?.staffId || '—',
            appraisalDate: appraisal.supervisorSubmittedAt || supervisorAnswers?.s_signature_date,
            department: supervisorAnswers?.s_department || appraisal.department,
            location: supervisorAnswers?.s_location || appraisal.location,
            answers: supervisorAnswers || {},
            signatureDataUrl: supervisorSignatureSvg || supervisorAnswers?.s_signature,
          };

          return (
            <div key={appraisal._id} className="bulk-print-item">
              {/* Screen Divider between trainee records */}
              {idx > 0 && (
                <div className="bulk-doc-screen-divider">
                  <span className="bulk-doc-screen-badge">
                    Record {idx + 1} of {filteredItems.length}: {appraisal.traineeName} ({appraisal.traineeStaffId})
                  </span>
                </div>
              )}

              {/* Supervisor Form */}
              {(activeView === 'both' || activeView === 'supervisor') && (
                <div>
                  <OfficialSupervisorDocument data={supervisorDocData} isInteractive={false} />
                  {activeView === 'both' && <div className="bulk-page-break" />}
                </div>
              )}

              {/* Trainee Form */}
              {(activeView === 'both' || activeView === 'trainee') && (
                <div>
                  <OfficialTraineeDocument data={traineeDocData} isInteractive={false} />
                </div>
              )}

              {/* Page break between separate trainee records */}
              {idx < filteredItems.length - 1 && <div className="bulk-page-break" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BulkPrintPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '80px 24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 20px auto' }} />
          <p style={{ fontWeight: 600, color: '#002147' }}>Loading appraisal records...</p>
        </div>
      }
    >
      <BulkPrintContent />
    </Suspense>
  );
}
