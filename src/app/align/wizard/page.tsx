'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';

const steps = [
  { title: 'Clarify', description: 'Capture the question, outcomes, and success metrics.' },
  { title: 'Opportunities', description: 'Capture and score candidate use cases.' },
  { title: 'Roadmap v1', description: 'Prioritize top initiatives for the next phase.' },
  { title: 'Coalition', description: 'Identify sponsor, lead, and champions.' },
  { title: 'Guardrails', description: 'Set allowed categories and approval defaults.' },
];

export default function AlignWizardPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [outcomes, setOutcomes] = useState('');
  const [metrics, setMetrics] = useState('');
  const [stakeholders, setStakeholders] = useState('');
  const [constraints, setConstraints] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const summary = [
      question.trim() ? `Question:\\n${question.trim()}` : null,
      outcomes.trim() ? `Outcomes (one per line):\\n${outcomes.trim()}` : null,
      metrics.trim() ? `Success metrics (one per line):\\n${metrics.trim()}` : null,
      stakeholders.trim() ? `Stakeholders (one per line):\\n${stakeholders.trim()}` : null,
      constraints.trim() ? `Constraints (one per line):\\n${constraints.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\\n\\n');

    try {
      await apiRequest('/api/align', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || 'Alignment Snapshot',
          summary: summary || undefined,
          status: 'ACTIVE',
        }),
      });
      router.push('/align/opportunities');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alignment snapshot');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 'var(--spacing-md)',
        }}>
          <div>
            <h1 style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}>
              Align Wizard
            </h1>
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
            }}>
              Create the first alignment snapshot step by step.
            </p>
          </div>
          <Link
            href="/align"
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              border: '1px solid var(--color-border)',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            Back to Align
          </Link>
        </div>
      </header>

      <main className="page-content" style={{ padding: 'var(--spacing-xl)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 'var(--spacing-xl)',
          alignItems: 'start',
        }}>
          <aside style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
          }}>
            <h2 style={{
              margin: '0 0 var(--spacing-md) 0',
              fontSize: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-text-secondary)',
            }}>
              Steps
            </h2>
            <ol style={{
              margin: 0,
              paddingLeft: 'var(--spacing-lg)',
              color: 'var(--color-text)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
            }}>
              {steps.map((step, index) => (
                <li key={step.title}>
                  <div style={{ fontWeight: 600 }}>{index + 1}. {step.title}</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    {step.description}
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <section style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}>
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                margin: '0 0 var(--spacing-sm) 0',
                color: 'var(--color-text)',
              }}>
                Step 1: Clarify The Question
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
                Capture the question, desired outcomes, success metrics, stakeholders, and constraints.
              </p>
            </div>

            <form
              onSubmit={handleCreate}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 'var(--spacing-md)',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Snapshot title</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g., 2026 Align Baseline"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Clarify the question</span>
                <textarea
                  rows={4}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What is the most important business question AI should help us answer?"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Desired outcomes</span>
                <textarea
                  rows={3}
                  value={outcomes}
                  onChange={(event) => setOutcomes(event.target.value)}
                  placeholder="One per line, e.g., reduce cycle time by 30%"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Success metrics</span>
                <textarea
                  rows={3}
                  value={metrics}
                  onChange={(event) => setMetrics(event.target.value)}
                  placeholder="One per line, e.g., 95% deflection within 90 days"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Key stakeholders</span>
                <textarea
                  rows={3}
                  value={stakeholders}
                  onChange={(event) => setStakeholders(event.target.value)}
                  placeholder="One per line, e.g., COO, Support Ops Lead"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Constraints</span>
                <textarea
                  rows={3}
                  value={constraints}
                  onChange={(event) => setConstraints(event.target.value)}
                  placeholder="One per line, e.g., no PII, approvals required for external comms"
                  style={{
                    width: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-sm)',
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-text)',
                  }}
                />
              </label>

              {error && (
                <div style={{ color: 'var(--color-danger)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-lg)' }}>
                <button
                  type="button"
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-surface-secondary)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'not-allowed',
                  }}
                  disabled
                >
                  Back
                </button>
                <button
                  type="submit"
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    background: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                  }}
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Snapshot'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
