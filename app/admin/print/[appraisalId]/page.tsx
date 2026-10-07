'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OfficialTraineeDocument, OfficialSupervisorDocument } from '@/components/OfficialFormDocument';

export default function PrintableAppraisalPage() {
  const params = useParams();
  const router = useRouter();
  const appraisalId = params?.appraisalId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHrCopy, setIsHrCopy] = useState(true);
  const [activeView, setActiveView] = useState<'both' | 'trainee' | 'supervisor'>('both');

  useEffect(() => {
    async function loadRecord() {
      try {
        setLoading(true);
        const res = await fetch(`/api/supervisor/assess/${appraisalId}`);
        if (!res.ok) throw new Error('Failed to load assessment document');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (appraisalId) loadRecord();
  }, [appraisalId]);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div className="spinner spinner-lg" style={{ margin: '0 auto 16px auto' }} />
        <p style={{ fontWeight: 600, color: '#002147' }}>Loading pixel-perfect assessment documents...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <h3 style={{ color: '#c8102e' }}>Error loading document</h3>
        <p style={{ color: '#64748b' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginTop: 16 }}>
          ← Back
        </button>
      </div>
    );
  }

  const { appraisal, traineeAnswers, rawTraineeAnswers, supervisorAnswers, traineeSignatureSvg } = data;
  const activeTraineeAnswers = isHrCopy && rawTraineeAnswers ? rawTraineeAnswers : traineeAnswers;

  const handlePrint = () => {
    window.print();
  };

  const traineeDocData = {
    traineeName: appraisal.traineeName,
    supervisorName: supervisorAnswers?.s_signature_name || activeTraineeAnswers?.t_supervisor_other || '—',
    staffId: appraisal.traineeStaffId,
    appraisalDate: appraisal.traineeSubmittedAt || appraisal.createdAt,
    department: appraisal.department,
    location: appraisal.location,
    answers: activeTraineeAnswers || {},
    signatureDataUrl: traineeSignatureSvg || activeTraineeAnswers?.t_signature,
  };

  const supervisorDocData = {
    supervisorName: supervisorAnswers?.s_signature_name || '—',
    traineeName: appraisal.traineeName,
    staffId: supervisorAnswers?.s_staff_id || '—',
    appraisalDate: appraisal.supervisorSubmittedAt || supervisorAnswers?.s_signature_date,
    department: supervisorAnswers?.s_department || appraisal.department,
    location: supervisorAnswers?.s_location || appraisal.location,
    answers: supervisorAnswers || {},
    signatureDataUrl: supervisorAnswers?.s_signature_svg || supervisorAnswers?.s_signature,
  };

  return (
    <div style={{ background: '#525659', minHeight: '100vh', padding: '24px 0' }}>
      {/* Control Toolbar (hidden during print) */}
      <div
        className="no-print"
        style={{
          maxWidth: 820,
          margin: '0 auto 20px auto',
          background: '#ffffff',
          padding: '12px 20px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}
      >
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
              fontWeight: 600,
            }}
          >
            ← Back
          </button>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#002147' }}>
              {appraisal.traineeName} ({appraisal.traineeStaffId})
            </span>
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
              • {appraisal.cycleName}
            </span>
          </div>
        </div>

        {/* View mode buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 6 }}>
          <button
            onClick={() => setActiveView('both')}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
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
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'supervisor' ? '#002147' : 'transparent',
              color: activeView === 'supervisor' ? '#fff' : '#475569',
            }}
          >
            Supervisor Form Only
          </button>
          <button
            onClick={() => setActiveView('trainee')}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: activeView === 'trainee' ? '#002147' : 'transparent',
              color: activeView === 'trainee' ? '#fff' : '#475569',
            }}
          >
            Trainee Form Only
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isHrCopy}
              onChange={(e) => setIsHrCopy(e.target.checked)}
            />
            Include HR Confidential Fields
          </label>

          <button
            onClick={handlePrint}
            style={{
              background: '#c8102e',
              color: '#ffffff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(200, 16, 46, 0.3)',
            }}
          >
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Render Document(s) */}
      <div className="printable-documents-wrapper">
        {(activeView === 'both' || activeView === 'supervisor') && (
          <div style={{ marginBottom: activeView === 'both' ? 36 : 0 }}>
            <OfficialSupervisorDocument data={supervisorDocData} isInteractive={false} />
          </div>
        )}

        {(activeView === 'both' || activeView === 'trainee') && (
          <div>
            <OfficialTraineeDocument data={traineeDocData} isInteractive={false} />
          </div>
        )}
      </div>
    </div>
  );
}
