'use client';

import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
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

  // Print & Display preferences
  const [isHrCopy, setIsHrCopy] = useState(true);
  const [activeFormView, setActiveFormView] = useState<'both' | 'supervisor' | 'trainee'>('both');
  const [displayMode, setDisplayMode] = useState<'split' | 'continuous'>('split');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const singleDocRef = useRef<HTMLDivElement>(null);

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

  const items = data?.items || [];
  const currentItem = items[currentIndex];

  // Set document title to trainee name when viewing split response
  useEffect(() => {
    if (displayMode === 'split' && currentItem) {
      const traineeName = currentItem.appraisal.traineeName || 'Trainee';
      const staffId = currentItem.appraisal.traineeStaffId || '';
      document.title = `${traineeName} (${staffId}) - Performance Appraisal`;
    } else if (data) {
      document.title = `Genesis Appraisals Bundle - ${data.cycleName || 'Cohort'}`;
    }
  }, [displayMode, currentItem, data]);

  const handlePrint = () => {
    window.print();
  };

  // Direct single trainee PDF download using html2pdf.js
  const handleDownloadSinglePdf = async () => {
    if (!currentItem || !singleDocRef.current) return;
    try {
      setIsDownloadingPdf(true);
      const html2pdf = (await import('html2pdf.js')).default;
      const cleanName = currentItem.appraisal.traineeName.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const cleanStaffId = currentItem.appraisal.traineeStaffId.replace(/[/\\?%*:|"<>]/g, '_').trim();
      const filename = `${cleanName} (${cleanStaffId}) - Performance Appraisal.pdf`;

      const opt = {
        margin: [8, 10, 8, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await (html2pdf as any)().set(opt).from(singleDocRef.current).save();
    } catch (e: any) {
      alert(`Could not generate PDF: ${e.message}. Using browser print dialog instead.`);
      window.print();
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Direct ZIP download of all trainee files named individually
  const handleDownloadZip = () => {
    setIsDownloadingZip(true);
    const params = new URLSearchParams();
    if (cycleId) params.set('cycleId', cycleId);
    if (ids) params.set('ids', ids);
    if (status) params.set('status', status);
    params.set('viewMode', activeFormView);
    params.set('isHrCopy', isHrCopy ? 'true' : 'false');

    window.location.href = `/api/exports/zip?${params.toString()}`;
    setTimeout(() => {
      setIsDownloadingZip(false);
    }, 2500);
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 20px auto' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#002147', margin: 0 }}>
          Preparing Appraisal Documents...
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>
          Splitting individual trainee records, scorecards, and digital signatures.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', padding: 32, background: '#fff', borderRadius: 12, border: '1px solid #fee2e2', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ color: '#c8102e', fontSize: 20, fontWeight: 800, margin: 0 }}>
          Unable to Load Appraisal Records
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
          ← Return
        </button>
      </div>
    );
  }

  if (items.length === 0) {
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
          ← Back
        </button>
      </div>
    );
  }

  const renderTraineeDocumentBlock = (item: any, isSingle = false) => {
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
        {/* Supervisor Form */}
        {(activeFormView === 'both' || activeFormView === 'supervisor') && (
          <div>
            <OfficialSupervisorDocument data={supervisorDocData} isInteractive={false} />
            {activeFormView === 'both' && <div className="bulk-page-break" />}
          </div>
        )}

        {/* Trainee Form */}
        {(activeFormView === 'both' || activeFormView === 'trainee') && (
          <div>
            <OfficialTraineeDocument data={traineeDocData} isInteractive={false} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: '#525659', minHeight: '100vh', padding: '24px 0 60px 0' }}>
      {/* Top Main Toolbar (no-print) */}
      <div
        className="no-print"
        style={{
          maxWidth: 980,
          margin: '0 auto 16px auto',
          background: '#ffffff',
          padding: '12px 20px',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 6px 20px rgba(0,0,0,0.22)',
          position: 'sticky',
          top: 12,
          zIndex: 60,
        }}
      >
        {/* Left: Back & Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              padding: '6px 12px',
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
                Appraisal Print & Archival
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
                {items.length} {items.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {data.cycleName || 'Assessment Cycle'} {data.cohort ? `(${data.cohort})` : ''}
            </div>
          </div>
        </div>

        {/* Middle: Split mode vs Continuous mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: 3, borderRadius: 8 }}>
          <button
            onClick={() => setDisplayMode('split')}
            title="View and print one trainee response at a time, named as the trainee"
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: displayMode === 'split' ? '#002147' : 'transparent',
              color: displayMode === 'split' ? '#fff' : '#475569',
            }}
          >
            📑 Split Per Trainee
          </button>
          <button
            onClick={() => setDisplayMode('continuous')}
            title="View all trainees stacked together in one continuous bundle"
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: displayMode === 'continuous' ? '#002147' : 'transparent',
              color: displayMode === 'continuous' ? '#fff' : '#475569',
            }}
          >
            📚 Continuous Bundle
          </button>
        </div>

        {/* Right: ZIP Export Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            title="Download a ZIP archive containing individual document files for every trainee, named after each trainee"
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
            }}
          >
            <span>📦</span>
            <span>{isDownloadingZip ? 'Archiving ZIP...' : 'Export as ZIP (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Toolbar: Secondary Controls (Form Views, Confidential Checkbox, Trainee Stepper) */}
      <div
        className="no-print"
        style={{
          maxWidth: 980,
          margin: '0 auto 20px auto',
          background: '#ffffff',
          padding: '10px 20px',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {/* Form Selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: '#334155' }}>Include:</span>
          <select
            value={activeFormView}
            onChange={(e) => setActiveFormView(e.target.value as any)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
            }}
          >
            <option value="both">All Forms (Supervisor + Trainee)</option>
            <option value="supervisor">Supervisor Form Only</option>
            <option value="trainee">Trainee Form Only</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 12, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isHrCopy}
              onChange={(e) => setIsHrCopy(e.target.checked)}
            />
            HR Confidential Fields
          </label>
        </div>

        {/* Trainee Navigation (Active in Split mode) */}
        {displayMode === 'split' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: currentIndex === 0 ? '#f1f5f9' : '#e2e8f0',
                border: '1px solid #cbd5e1',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: currentIndex === 0 ? '#94a3b8' : '#002147',
              }}
            >
              ◀ Prev
            </button>

            <select
              value={currentIndex}
              onChange={(e) => setCurrentIndex(Number(e.target.value))}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 12,
                fontWeight: 700,
                color: '#002147',
                maxWidth: 280,
                outline: 'none',
              }}
            >
              {items.map((it, idx) => (
                <option key={it.appraisal._id} value={idx}>
                  {idx + 1}. {it.appraisal.traineeName} ({it.appraisal.traineeStaffId})
                </option>
              ))}
            </select>

            <button
              onClick={() => setCurrentIndex((prev) => Math.min(items.length - 1, prev + 1))}
              disabled={currentIndex === items.length - 1}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: currentIndex === items.length - 1 ? '#f1f5f9' : '#e2e8f0',
                border: '1px solid #cbd5e1',
                cursor: currentIndex === items.length - 1 ? 'not-allowed' : 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: currentIndex === items.length - 1 ? '#94a3b8' : '#002147',
              }}
            >
              Next ▶
            </button>

            <button
              onClick={handleDownloadSinglePdf}
              disabled={isDownloadingPdf}
              title="Download a PDF of this specific trainee named as their name"
              style={{
                padding: '6px 14px',
                background: '#002147',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>⬇</span>
              <span>{isDownloadingPdf ? 'Creating PDF...' : 'Save as PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              style={{
                padding: '6px 14px',
                background: '#c8102e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>🖨️</span>
              <span>Print This Trainee</span>
            </button>
          </div>
        ) : (
          <div>
            <button
              onClick={handlePrint}
              style={{
                background: '#c8102e',
                color: '#ffffff',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🖨️</span>
              <span>Print All ({items.length}) in One Bundle</span>
            </button>
          </div>
        )}
      </div>

      {/* DOCUMENT RENDER AREA */}
      <div className="printable-documents-wrapper">
        {displayMode === 'split' ? (
          /* Split Per Trainee: Render ONLY the currently selected trainee's document */
          currentItem && (
            <div ref={singleDocRef}>
              <div
                className="no-print"
                style={{
                  maxWidth: 820,
                  margin: '0 auto 12px auto',
                  background: '#002147',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  Showing Response {currentIndex + 1} of {items.length}: {currentItem.appraisal.traineeName} ({currentItem.appraisal.traineeStaffId})
                </span>
                <span style={{ fontSize: 11, opacity: 0.85 }}>
                  Browser print/PDF save will name file as: "{currentItem.appraisal.traineeName} ({currentItem.appraisal.traineeStaffId}) - Performance Appraisal.pdf"
                </span>
              </div>
              {renderTraineeDocumentBlock(currentItem, true)}
            </div>
          )
        ) : (
          /* Continuous Bundle: Render all documents sequentially with page breaks */
          items.map((item, idx) => (
            <div key={item.appraisal._id}>
              {idx > 0 && (
                <div className="bulk-doc-screen-divider">
                  <span className="bulk-doc-screen-badge">
                    Record {idx + 1} of {items.length}: {item.appraisal.traineeName} ({item.appraisal.traineeStaffId})
                  </span>
                </div>
              )}
              {renderTraineeDocumentBlock(item, false)}
              {idx < items.length - 1 && <div className="bulk-page-break" />}
            </div>
          ))
        )}
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
