'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ComplianceResults } from '@/components/analysis/ComplianceResults';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';

interface Document {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  skillId: string;
  skillName: string;
  status: string;
  createdAt: string;
  analysis?: {
    id: string;
    score: number;
    status: string;
    findings: unknown;
    violations: unknown;
    recommendations: unknown;
    completedAt: string;
  };
}

export default function DocumentDetailPage() {
  const params = useParams();
  const documentId = params.id as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic'>('openai');
  const [availableProviders, setAvailableProviders] = useState<Array<'openai' | 'anthropic'>>(['openai']);

  useEffect(() => {
    loadDocument();
    loadAvailableProviders();
  }, [documentId]);

  const loadAvailableProviders = async () => {
    try {
      // Fetch from compliance analyzer's own API endpoint
      const response = await fetch('/api/providers');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.providers) {
          const configuredProviders = data.data.providers as Array<'openai' | 'anthropic'>;
          const enabledProviders = data.data.enabledProviders as Array<'openai' | 'anthropic'> || [];
          
          if (configuredProviders.length > 0) {
            setAvailableProviders(configuredProviders);
            // Set default to first enabled provider, or first configured if none enabled
            const defaultProvider = enabledProviders.length > 0 ? enabledProviders[0] : configuredProviders[0];
            if (!configuredProviders.includes(selectedProvider)) {
              setSelectedProvider(defaultProvider);
            } else if (!enabledProviders.includes(selectedProvider) && enabledProviders.length > 0) {
              // If current selection is disabled but there are enabled providers, switch to enabled one
              setSelectedProvider(enabledProviders[0]);
            }
          } else {
            // No providers configured, show both options
            setAvailableProviders(['openai', 'anthropic']);
          }
        } else {
          // Fallback: show both options
          setAvailableProviders(['openai', 'anthropic']);
        }
      } else {
        // If API fails, show both options
        console.warn('Failed to fetch providers, showing all options');
        setAvailableProviders(['openai', 'anthropic']);
      }
    } catch (err) {
      // If we can't fetch, default to showing both options
      // The API will validate and return a clear error if provider isn't configured
      console.log('Could not fetch available providers, will show all options');
      setAvailableProviders(['openai', 'anthropic']);
    }
  };

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/documents/${documentId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setDocument(data.data);
      } else {
        setError(data.error || 'Failed to load document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    console.log('Analyze button clicked with provider:', selectedProvider);
    setAnalyzing(true);
    setShowProgress(true);
    setError(null);
    // The AnalysisProgress component will handle the actual API call via streaming
    // No need to make a separate POST request here
  };

  const handleAnalysisComplete = async () => {
    setAnalyzing(false);
    setShowProgress(false);
    // Reload document to get analysis results
    await loadDocument();
  };

  const handleAnalysisError = (errorMessage: string) => {
    setAnalyzing(false);
    setShowProgress(false);
    setError(errorMessage);
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading document...</div>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="container mx-auto px-4 py-8" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)'
        }}>
          <p style={{ color: 'var(--color-danger)' }}>{error || 'Document not found'}</p>
        </div>
      </main>
    );
  }

  const hasAnalysis = document.analysis !== null && document.analysis !== undefined;
  const analysisData = document.analysis;

  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl" style={{ backgroundColor: 'var(--color-background)' }}>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Link
            href="/documents"
            style={{
              color: 'var(--color-primary)',
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          >
            ← Back to Documents
          </Link>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <Link
            href="/"
            style={{
              color: 'var(--color-primary)',
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary-dark)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
          >
            Upload New
          </Link>
        </div>
        <h1 style={{ 
          fontSize: '2.25rem', 
          fontWeight: '700', 
          color: 'var(--color-text)',
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
          {document.fileName}
        </h1>
      </div>

      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-lg)',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)', fontSize: '0.875rem' }}>
          <div>
            <span style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>Skill:</span>
            <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text)' }}>{document.skillName}</span>
          </div>
          <div>
            <span style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>Status:</span>
            <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text)' }}>{document.status}</span>
          </div>
          <div>
            <span style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>File Size:</span>
            <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text)' }}>
              {(document.fileSize / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <div>
            <span style={{ fontWeight: '500', color: 'var(--color-text-secondary)' }}>Uploaded:</span>
            <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text)' }}>
              {new Date(document.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {!hasAnalysis && document.status !== 'PROCESSING' && !showProgress && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-lg)',
          border: '1px solid var(--color-border)'
        }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-md)' }}>
            This document has not been analyzed yet.
          </p>
          
          {/* Provider Selection */}
          <div style={{ marginBottom: 'var(--spacing-md)' }}>
            <label
              htmlFor="provider-select"
              style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              AI Provider:
            </label>
            <select
              id="provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as 'openai' | 'anthropic')}
              disabled={analyzing || document.status === 'PROCESSING'}
              style={{
                width: '100%',
                maxWidth: '300px',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                cursor: analyzing || document.status === 'PROCESSING' ? 'not-allowed' : 'pointer',
                opacity: analyzing || document.status === 'PROCESSING' ? 0.6 : 1,
              }}
            >
              {availableProviders.includes('openai') && (
                <option value="openai">OpenAI</option>
              )}
              {availableProviders.includes('anthropic') && (
                <option value="anthropic">Anthropic (Claude)</option>
              )}
              {availableProviders.length === 0 && (
                <option value="">No providers available</option>
              )}
            </select>
            {availableProviders.length === 0 && (
              <p style={{ 
                fontSize: '0.75rem', 
                color: 'var(--color-danger)', 
                marginTop: 'var(--spacing-xs)' 
              }}>
                Please configure at least one AI provider in the admin settings.
              </p>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={analyzing || document.status === 'PROCESSING'}
            style={{
              backgroundColor: analyzing || document.status === 'PROCESSING'
                ? 'var(--color-border)'
                : 'var(--color-primary)',
              color: 'white',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontWeight: '500',
              cursor: analyzing || document.status === 'PROCESSING' ? 'not-allowed' : 'pointer',
              transition: 'background-color var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              if (!analyzing && document.status !== 'PROCESSING') {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (!analyzing && document.status !== 'PROCESSING') {
                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              }
            }}
          >
            {analyzing || document.status === 'PROCESSING'
              ? 'Analyzing...'
              : 'Analyze Document'}
          </button>
        </div>
      )}

      {showProgress && (
        <AnalysisProgress
          documentId={documentId}
          provider={selectedProvider}
          onComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}

      {document.status === 'PROCESSING' && !showProgress && (
        <div style={{
          backgroundColor: 'var(--color-surface-secondary)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <p style={{ color: 'var(--color-primary)' }}>Document is being analyzed...</p>
        </div>
      )}

      {hasAnalysis && analysisData && (
        <ComplianceResults
          score={analysisData.score}
          status={analysisData.status as 'PASS' | 'FAIL' | 'PARTIAL'}
          findings={(analysisData.findings as any) || []}
          violations={(analysisData.violations as any) || []}
          recommendations={(analysisData.recommendations as any) || []}
          documentId={documentId}
        />
      )}

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-md)',
          marginTop: 'var(--spacing-lg)'
        }}>
          <p style={{ color: 'var(--color-danger)' }}>{error}</p>
        </div>
      )}
    </main>
  );
}
