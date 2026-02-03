'use client';

import { useState } from 'react';
import { FindingsList } from './FindingsList';

interface ComplianceResultsProps {
  score: number;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  findings: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    category?: string;
    description: string;
    location?: string;
  }>;
  violations: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
    rule: string;
    description: string;
    location?: string;
  }>;
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    action: string;
    description: string;
  }>;
  documentId?: string; // Optional documentId for export functionality
}

const statusColors = {
  PASS: { bg: 'var(--color-surface-secondary)', text: 'var(--color-success)', border: 'var(--color-success)' },
  FAIL: { bg: 'var(--color-surface-secondary)', text: 'var(--color-danger)', border: 'var(--color-danger)' },
  PARTIAL: { bg: 'var(--color-surface-secondary)', text: 'var(--color-warning)', border: 'var(--color-warning)' },
};

const statusLabels = {
  PASS: 'Pass',
  FAIL: 'Fail',
  PARTIAL: 'Partial Compliance',
};

export function ComplianceResults({
  score,
  status,
  findings,
  violations,
  recommendations,
  documentId,
}: ComplianceResultsProps) {
  const [exporting, setExporting] = useState(false);
  const statusColor = statusColors[status];
  const scoreColor = score >= 90
    ? 'var(--color-success)'
    : score >= 60
    ? 'var(--color-warning)'
    : 'var(--color-danger)';

  const handleExport = async () => {
    if (!documentId) {
      alert('Document ID is required for export');
      return;
    }

    try {
      setExporting(true);
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to export document');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'compliance_analysis_report.docx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export error:', error);
      alert(`Failed to export document: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Score and Status */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--spacing-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: 'var(--color-text)',
            fontFamily: 'Space Grotesk, sans-serif'
          }}>
            Compliance Score
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            {documentId && (
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  backgroundColor: exporting
                    ? 'var(--color-border)'
                    : 'var(--color-primary)',
                  color: 'white',
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: exporting ? 'not-allowed' : 'pointer',
                  transition: 'background-color var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                }}
                onMouseEnter={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exporting) {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                  }
                }}
              >
                {exporting ? 'Exporting...' : '📄 Export to Word'}
              </button>
            )}
            <span
              style={{
                padding: 'var(--spacing-xs) var(--spacing-md)',
                borderRadius: '9999px',
                fontSize: '0.875rem',
                fontWeight: '500',
                border: `1px solid ${statusColor.border}`,
                backgroundColor: statusColor.bg,
                color: statusColor.text
              }}
            >
              {statusLabels[status]}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: '700', color: 'var(--color-text)' }}>{score}</span>
            <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', marginLeft: 'var(--spacing-sm)' }}>/ 100</span>
          </div>
          <div style={{ width: '100%', backgroundColor: 'var(--color-border)', borderRadius: '9999px', height: '1rem' }}>
            <div
              style={{
                height: '1rem',
                borderRadius: '9999px',
                backgroundColor: scoreColor,
                width: `${score}%`,
                transition: 'width var(--transition-base)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Findings */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--spacing-lg)'
      }}>
        <FindingsList findings={findings} title="Findings" />
      </div>

      {/* Violations */}
      {violations.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 'var(--spacing-lg)'
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>
            Violations
          </h3>
          <FindingsList
            findings={violations.map((v) => ({
              severity: v.severity,
              category: v.rule,
              description: v.description,
              location: v.location,
            }))}
            title=""
          />
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          padding: 'var(--spacing-lg)'
        }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)', marginBottom: 'var(--spacing-md)' }}>
            Recommendations
          </h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {recommendations.map((rec, index) => {
              const priorityColor = rec.priority === 'HIGH'
                ? { bg: 'var(--color-surface-secondary)', text: 'var(--color-danger)', border: 'var(--color-danger)' }
                : rec.priority === 'MEDIUM'
                ? { bg: 'var(--color-surface-secondary)', text: 'var(--color-warning)', border: 'var(--color-warning)' }
                : { bg: 'var(--color-surface-secondary)', text: 'var(--color-primary)', border: 'var(--color-primary)' };
              
              return (
                <li key={index} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      marginRight: 'var(--spacing-md)',
                      backgroundColor: priorityColor.bg,
                      color: priorityColor.text,
                      border: `1px solid ${priorityColor.border}`
                    }}
                  >
                    {rec.priority}
                  </span>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {rec.action}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{rec.description}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
