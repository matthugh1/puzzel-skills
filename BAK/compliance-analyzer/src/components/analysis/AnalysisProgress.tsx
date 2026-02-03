'use client';

import { useState, useEffect } from 'react';

export interface ProgressUpdate {
  type: 'status' | 'skill' | 'model' | 'thinking' | 'extracting' | 'analyzing' | 'parsing' | 'connected' | 'completed' | 'error';
  message: string;
  skillName?: string;
  model?: string;
  progress?: number;
  error?: string;
  result?: any;
}

interface AnalysisProgressProps {
  documentId: string;
  provider?: 'openai' | 'anthropic';
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export function AnalysisProgress({
  documentId,
  provider = 'openai',
  onComplete,
  onError,
}: AnalysisProgressProps) {
  const [updates, setUpdates] = useState<ProgressUpdate[]>([
    { type: 'status', message: 'Initializing analysis...', progress: 0 }
  ]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [skillName, setSkillName] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let abortController: AbortController | null = null;

    const startAnalysis = async () => {
      // Update initial status message
      setUpdates([{ type: 'status', message: 'Connecting to analysis service...', progress: 0 }]);
      setIsConnected(false);

      try {
        abortController = new AbortController();
        const url = `/api/documents/${documentId}/analyze/stream?provider=${provider}`;
        const response = await fetch(url, {
          method: 'GET',
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6); // Remove 'data: ' prefix
                if (jsonStr.trim()) {
                  const data: ProgressUpdate = JSON.parse(jsonStr);
                  console.log('Progress update:', data);

                  if (data.type === 'connected') {
                    setIsConnected(true);
                    setUpdates((prev) => [...prev, data]);
                  } else if (data.type === 'completed') {
                    setUpdates((prev) => [...prev, data]);
                    setCurrentProgress(100);
                    if (onComplete) {
                      setTimeout(() => onComplete(), 500);
                    }
                    return;
                  } else if (data.type === 'error') {
                    setUpdates((prev) => [...prev, data]);
                    if (onError) {
                      onError(data.error || 'Analysis failed');
                    }
                    return;
                  } else {
                    setUpdates((prev) => [...prev, data]);
                    if (data.progress !== undefined) {
                      setCurrentProgress(data.progress);
                    }
                    if (data.skillName) {
                      setSkillName(data.skillName);
                    }
                    if (data.model) {
                      setModel(data.model);
                    }
                  }
                }
              } catch (error) {
                console.error('Error parsing SSE data:', error, line);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Analysis stream aborted');
          return;
        }
        console.error('Error reading stream:', error);
        if (onError) {
          onError(error.message || 'Failed to read analysis stream');
        }
      }
    };

    startAnalysis();

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [documentId, provider, onComplete, onError]);

  const getProgressColor = (type: string) => {
    switch (type) {
      case 'skill':
        return 'var(--color-primary)';
      case 'model':
        return 'var(--color-primary)';
      case 'thinking':
        return 'var(--color-warning)';
      case 'extracting':
        return 'var(--color-info)';
      case 'analyzing':
        return 'var(--color-primary)';
      case 'parsing':
        return 'var(--color-success)';
      case 'error':
        return 'var(--color-danger)';
      default:
        return 'var(--color-text-secondary)';
    }
  };

  const getProgressIcon = (type: string) => {
    switch (type) {
      case 'skill':
        return '📚';
      case 'model':
        return '🤖';
      case 'thinking':
        return '💭';
      case 'extracting':
        return '📄';
      case 'analyzing':
        return '🔍';
      case 'parsing':
        return '⚙️';
      case 'error':
        return '❌';
      case 'completed':
        return '✅';
      default:
        return '•';
    }
  };

  // Debug: Log when component renders
  console.log('AnalysisProgress rendering', { documentId, updates: updates.length, currentProgress });

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--spacing-lg)',
        marginBottom: 'var(--spacing-lg)',
        minHeight: '200px', // Ensure it's visible
      }}
    >
      {/* Header with skill and model info */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: 'var(--color-text)',
              marginBottom: 'var(--spacing-xs)',
            }}
          >
            Analyzing Document
          </h3>
          {skillName && (
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginTop: 'var(--spacing-xs)',
              }}
            >
              <span style={{ fontWeight: '500' }}>Skill:</span> {skillName}
            </div>
          )}
          {model && (
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginTop: 'var(--spacing-xs)',
              }}
            >
              <span style={{ fontWeight: '500' }}>Model:</span> {model}
            </div>
          )}
        </div>
        {!isConnected && (
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted)',
            }}
          >
            Connecting...
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--color-border)',
          borderRadius: '9999px',
          height: '0.5rem',
          marginBottom: 'var(--spacing-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '0.5rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-primary)',
            width: `${currentProgress}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Progress updates */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
          maxHeight: '300px',
          overflowY: 'auto',
        }}
      >
        {updates.map((update, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--spacing-sm)',
              fontSize: '0.875rem',
              padding: 'var(--spacing-xs)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                update.type === 'error'
                  ? 'var(--color-surface-secondary)'
                  : 'transparent',
            }}
          >
            <span
              style={{
                color: getProgressColor(update.type),
                fontSize: '1rem',
              }}
            >
              {getProgressIcon(update.type)}
            </span>
            <span
              style={{
                color:
                  update.type === 'error'
                    ? 'var(--color-danger)'
                    : 'var(--color-text)',
                flex: 1,
              }}
            >
              {update.message}
            </span>
            {update.progress !== undefined && (
              <span
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}
              >
                {update.progress}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
