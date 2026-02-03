'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface Opportunity {
  id: string;
  title: string;
  department: string | null;
  valueScore: number;
  feasibilityScore: number;
  status: string;
}

interface AlignOpportunitiesProps {
  snapshotId: string;
  opportunities: Opportunity[];
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--spacing-lg)',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  padding: 'var(--spacing-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text)',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--color-surface)',
};

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--color-primary)',
  color: 'var(--color-on-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--color-surface-secondary)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  cursor: 'pointer',
  fontWeight: 600,
};

export function AlignOpportunities({ snapshotId, opportunities: initialOpportunities }: AlignOpportunitiesProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [valueScore, setValueScore] = useState(3);
  const [feasibilityScore, setFeasibilityScore] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { opportunity } = await apiRequest<{ opportunity: Opportunity }>('/api/align/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          snapshotId,
          title: title.trim(),
          department: department.trim() || undefined,
          valueScore,
          feasibilityScore,
          status: 'IDEA',
        }),
      });
      setOpportunities((prev) => [opportunity, ...prev]);
      setTitle('');
      setDepartment('');
      setValueScore(3);
      setFeasibilityScore(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create opportunity');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Opportunity>) => {
    setError(null);
    try {
      const { opportunity } = await apiRequest<{ opportunity: Opportunity }>(`/api/align/opportunities/${id}` , {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setOpportunities((prev) => prev.map((item) => (item.id === id ? opportunity : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update opportunity');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/api/align/opportunities/${id}`, { method: 'DELETE' });
      setOpportunities((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete opportunity');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <section style={sectionStyle}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: 0,
          color: 'var(--color-text)',
          fontFamily: 'var(--font-display)',
        }}>
          Add Opportunity
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Capture a candidate use case and score it for impact and feasibility.
        </p>
        {error && <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--spacing-sm)' }}>{error}</div>}
        <form
          onSubmit={handleCreate}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--spacing-md)' }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="e.g., AI support triage"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Department</span>
            <input
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g., Support"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Value</span>
            <input
              type="number"
              min={1}
              max={5}
              value={valueScore}
              onChange={(event) => setValueScore(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Feasibility</span>
            <input
              type="number"
              min={1}
              max={5}
              value={feasibilityScore}
              onChange={(event) => setFeasibilityScore(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="submit"
              style={{
                ...primaryButtonStyle,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Opportunity'}
            </button>
          </div>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: 0,
          color: 'var(--color-text)',
          fontFamily: 'var(--font-display)',
        }}>
          Opportunity List
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Review and adjust scores as you learn more.
        </p>
        {opportunities.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)' }}>No opportunities yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
            {opportunities.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                  gap: 'var(--spacing-sm)',
                  alignItems: 'center',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-secondary)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{item.title}</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    {item.department || 'Unassigned'}
                  </div>
                </div>
                <select
                  value={item.status}
                  onChange={(event) => handleUpdate(item.id, { status: event.target.value })}
                  style={selectStyle}
                >
                  <option value="IDEA">Idea</option>
                  <option value="PRIORITIZED">Prioritized</option>
                  <option value="DEFERRED">Deferred</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.valueScore}
                  onChange={(event) => handleUpdate(item.id, { valueScore: Number(event.target.value) })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={item.feasibilityScore}
                  onChange={(event) => handleUpdate(item.id, { feasibilityScore: Number(event.target.value) })}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  style={secondaryButtonStyle}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
