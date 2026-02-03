'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface RoadmapItem {
  id: string;
  title: string;
  priority: number;
  status: string;
}

interface AlignRoadmapProps {
  snapshotId: string;
  roadmapItems: RoadmapItem[];
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

export function AlignRoadmap({ snapshotId, roadmapItems: initialRoadmap }: AlignRoadmapProps) {
  const [roadmapItems, setRoadmapItems] = useState(initialRoadmap);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(1);
  const [status, setStatus] = useState('PLANNED');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { roadmapItem } = await apiRequest<{ roadmapItem: RoadmapItem }>('/api/align/roadmap', {
        method: 'POST',
        body: JSON.stringify({
          snapshotId,
          title: title.trim(),
          priority,
          status,
        }),
      });
      setRoadmapItems((prev) => [roadmapItem, ...prev]);
      setTitle('');
      setPriority(1);
      setStatus('PLANNED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create roadmap item');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<RoadmapItem>) => {
    setError(null);
    try {
      const { roadmapItem } = await apiRequest<{ roadmapItem: RoadmapItem }>(`/api/align/roadmap/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      setRoadmapItems((prev) => prev.map((item) => (item.id === id ? roadmapItem : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roadmap item');
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/api/align/roadmap/${id}`, { method: 'DELETE' });
      setRoadmapItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete roadmap item');
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
          Add Roadmap Item
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Prioritize the near-term work to make the first opportunities real.
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
              placeholder="e.g., Build support agent pilot"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Priority</span>
            <input
              type="number"
              min={1}
              max={10}
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={selectStyle}
            >
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
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
              {saving ? 'Adding...' : 'Add Item'}
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
          Roadmap List
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Keep the ordering tight and focused.
        </p>
        {roadmapItems.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)' }}>No roadmap items yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
            {roadmapItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
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
                    Priority {item.priority}
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={item.priority}
                  onChange={(event) => handleUpdate(item.id, { priority: Number(event.target.value) })}
                  style={inputStyle}
                />
                <select
                  value={item.status}
                  onChange={(event) => handleUpdate(item.id, { status: event.target.value })}
                  style={selectStyle}
                >
                  <option value="PLANNED">Planned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
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
