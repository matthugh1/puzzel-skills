'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import React from 'react';

interface Document {
  id: string;
  fileName: string;
  fileSize: number;
  skillId: string;
  skillName: string;
  status: string;
  createdAt: string;
  analysis?: {
    score: number;
    status: string;
  };
}

interface DocumentsListProps {
  initialDocuments?: Document[];
}

const statusColors = {
  PENDING: { bg: 'var(--color-surface-secondary)', text: 'var(--color-text)', border: 'var(--color-border)' },
  PROCESSING: { bg: 'var(--color-surface-secondary)', text: 'var(--color-primary)', border: 'var(--color-primary)' },
  COMPLETED: { bg: 'var(--color-surface-secondary)', text: 'var(--color-success)', border: 'var(--color-success)' },
  FAILED: { bg: 'var(--color-surface-secondary)', text: 'var(--color-danger)', border: 'var(--color-danger)' },
};

export function DocumentsList({ initialDocuments = [] }: DocumentsListProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [loading, setLoading] = useState(!initialDocuments.length);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    skillId: '',
    search: '',
  });
  const [skills, setSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSkills();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [page, filters]);

  const loadSkills = async () => {
    try {
      const response = await fetch('/api/skills');
      const data = await response.json();
      if (data.success && data.data?.skills) {
        setSkills(data.data.skills);
      }
    } catch (err) {
      console.error('Error loading skills:', err);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (filters.status) params.append('status', filters.status);
      if (filters.skillId) params.append('skillId', filters.skillId);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/documents?${params.toString()}`);
      const data = await response.json();

      if (data.success && data.data) {
        setDocuments(data.data.documents || []);
        setTotalPages(data.data.totalPages || 1);
      } else {
        setError(data.error || 'Failed to load documents');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleAnalyze = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    try {
      setAnalyzingIds((prev) => new Set(prev).add(documentId));
      setError(null);
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: 'openai' }), // Default to OpenAI for list view
      });
      const data = await response.json();

      if (data.success) {
        // Reload documents to get updated status
        await loadDocuments();
      } else {
        setError(data.error || 'Failed to analyze document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze document');
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  if (loading && documents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading documents...</p>
      </div>
    );
  }

  if (error && documents.length === 0) {
    return (
      <div style={{
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md)'
      }}>
        <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        <button
          onClick={loadDocuments}
          style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: '0.875rem',
            color: 'var(--color-danger)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger-dark)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
        >
          Retry
        </button>
      </div>
    );
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem var(--spacing-md)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    transition: 'border-color var(--transition-fast)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* Error Message */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)'
        }}>
          <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>
          <button
            onClick={() => setError(null)}
            style={{
              marginTop: 'var(--spacing-sm)',
              fontSize: '0.875rem',
              color: 'var(--color-danger)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-danger-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-danger)'}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)'
      }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
          Filters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 'var(--spacing-md)' }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '500', 
              color: 'var(--color-text)', 
              marginBottom: 'var(--spacing-xs)' 
            }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search by name..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--color-primary-rgb), 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '500', 
              color: 'var(--color-text)', 
              marginBottom: 'var(--spacing-xs)' 
            }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--color-primary-rgb), 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: '500', 
              color: 'var(--color-text)', 
              marginBottom: 'var(--spacing-xs)' 
            }}>
              Skill
            </label>
            <select
              value={filters.skillId}
              onChange={(e) => handleFilterChange('skillId', e.target.value)}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--color-primary-rgb), 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <option value="">All Skills</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--color-surface-secondary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-2xl)',
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>No documents found</p>
          <Link
            href="/"
            style={{
              marginTop: 'var(--spacing-md)',
              display: 'inline-block',
              color: 'var(--color-primary)',
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          >
            Upload your first document →
          </Link>
        </div>
      ) : (
        <>
          <div style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            overflow: 'hidden'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
                <tr>
                  {['Document', 'Skill', 'Status', 'Score', 'Uploaded', 'Actions'].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: 'var(--spacing-md) var(--spacing-lg)',
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid var(--color-border)'
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const statusColor = statusColors[doc.status as keyof typeof statusColors] || statusColors.PENDING;
                  return (
                    <tr
                      key={doc.id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface)'}
                    >
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap' }}>
                        <Link
                          href={`/documents/${doc.id}`}
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            transition: 'color var(--transition-fast)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                        >
                          {doc.fileName}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                          {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>{doc.skillName}</div>
                      </td>
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: 'var(--spacing-xs) var(--spacing-sm)',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            borderRadius: '9999px',
                            backgroundColor: statusColor.bg,
                            color: statusColor.text,
                            border: `1px solid ${statusColor.border}`
                          }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap' }}>
                        {doc.analysis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text)' }}>
                              {doc.analysis.score}
                            </span>
                            <span
                              style={{
                                padding: 'var(--spacing-xs) var(--spacing-sm)',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                borderRadius: '9999px',
                                backgroundColor: doc.analysis.status === 'PASS'
                                  ? 'var(--color-surface-secondary)'
                                  : doc.analysis.status === 'FAIL'
                                  ? 'var(--color-surface-secondary)'
                                  : 'var(--color-surface-secondary)',
                                color: doc.analysis.status === 'PASS'
                                  ? 'var(--color-success)'
                                  : doc.analysis.status === 'FAIL'
                                  ? 'var(--color-danger)'
                                  : 'var(--color-warning)',
                                border: `1px solid ${doc.analysis.status === 'PASS'
                                  ? 'var(--color-success)'
                                  : doc.analysis.status === 'FAIL'
                                  ? 'var(--color-danger)'
                                  : 'var(--color-warning)'}`
                              }}
                            >
                              {doc.analysis.status}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: 'var(--spacing-md) var(--spacing-lg)', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                          <Link
                            href={`/documents/${doc.id}`}
                            style={{
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              transition: 'color var(--transition-fast)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                          >
                            View
                          </Link>
                          {doc.status === 'PENDING' && !analyzingIds.has(doc.id) && (
                            <button
                              onClick={(e) => handleAnalyze(doc.id, e)}
                              style={{
                                color: 'var(--color-primary)',
                                fontWeight: '500',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '0.875rem',
                                transition: 'color var(--transition-fast)'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                            >
                              Analyze
                            </button>
                          )}
                          {analyzingIds.has(doc.id) && (
                            <span style={{ color: 'var(--color-primary)' }}>Analyzing...</span>
                          )}
                          {doc.status === 'PROCESSING' && (
                            <span style={{ color: 'var(--color-primary)' }}>Processing...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1,
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== 1) {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--color-text)';
                  }
                }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.5 : 1,
                  transition: 'all var(--transition-fast)'
                }}
                onMouseEnter={(e) => {
                  if (page !== totalPages) {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (page !== totalPages) {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.color = 'var(--color-text)';
                  }
                }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
