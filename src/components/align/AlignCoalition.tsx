'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface CoalitionMember {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

interface AlignCoalitionProps {
  snapshotId: string;
  coalitionMembers: CoalitionMember[];
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

const roleCopy: Record<string, string> = {
  SPONSOR: 'Executive sponsor who owns outcomes.',
  LEAD: 'Day-to-day lead driving delivery.',
  CHAMPION: 'Functional champion amplifying adoption.',
};

const roleOrder = ['SPONSOR', 'LEAD', 'CHAMPION'];

export function AlignCoalition({ snapshotId, coalitionMembers: initialMembers }: AlignCoalitionProps) {
  const [coalitionMembers, setCoalitionMembers] = useState(initialMembers);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('CHAMPION');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [options, setOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedMembers = useMemo(() => {
    return [...coalitionMembers].sort((a, b) => {
      const roleDiff = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
      if (roleDiff !== 0) return roleDiff;
      return (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email);
    });
  }, [coalitionMembers]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setOptions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiRequest<{ users: UserOption[] }>(
          `/api/align/coalition/users?query=${encodeURIComponent(search.trim())}`
        );
        setOptions(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search users');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!selectedUserId) {
      setError('Select a user to add.');
      return;
    }
    try {
      const { coalitionMember } = await apiRequest<{ coalitionMember: CoalitionMember }>(
        '/api/align/coalition',
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId,
            userId: selectedUserId,
            role,
          }),
        }
      );
      setCoalitionMembers((prev) => [coalitionMember, ...prev]);
      setSelectedUserId('');
      setSearch('');
      setOptions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coalition member');
    }
  };

  const handleUpdate = async (id: string, updates: Partial<CoalitionMember>) => {
    setError(null);
    try {
      const { coalitionMember } = await apiRequest<{ coalitionMember: CoalitionMember }>(
        `/api/align/coalition/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setCoalitionMembers((prev) => prev.map((item) => (item.id === id ? coalitionMember : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update coalition member');
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      await apiRequest(`/api/align/coalition/${id}`, { method: 'DELETE' });
      setCoalitionMembers((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove coalition member');
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
          Build the Coalition
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Add the sponsor, lead, and champions who will drive adoption.
        </p>
        {error && <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--spacing-sm)' }}>{error}</div>}
        <form
          onSubmit={handleAdd}
          style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--spacing-md)' }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Find user</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              style={selectStyle}
            >
              <option value="SPONSOR">Sponsor</option>
              <option value="LEAD">Lead</option>
              <option value="CHAMPION">Champion</option>
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" style={primaryButtonStyle}>Add</button>
          </div>
        </form>
        {loading && (
          <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-sm)' }}>
            Searching...
          </div>
        )}
        {options.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)', display: 'grid', gap: 'var(--spacing-xs)' }}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedUserId(option.id)}
                style={{
                  ...secondaryButtonStyle,
                  textAlign: 'left',
                  background: selectedUserId === option.id
                    ? 'var(--color-primary-light)'
                    : 'var(--color-surface-secondary)',
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{option.name || option.email}</div>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{option.email}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: 0,
          color: 'var(--color-text)',
          fontFamily: 'var(--font-display)',
        }}>
          Current Coalition
        </h2>
        <p style={{ color: 'var(--color-text-secondary)', margin: 'var(--spacing-xs) 0 var(--spacing-md)' }}>
          Keep roles explicit so accountability stays clear.
        </p>
        {sortedMembers.length === 0 ? (
          <div style={{ color: 'var(--color-text-secondary)' }}>No coalition members yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
            {sortedMembers.map((member) => (
              <div
                key={member.id}
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
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {member.user.name || member.user.email}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    {member.user.email}
                  </div>
                </div>
                <select
                  value={member.role}
                  onChange={(event) => handleUpdate(member.id, { role: event.target.value })}
                  style={selectStyle}
                >
                  <option value="SPONSOR">Sponsor</option>
                  <option value="LEAD">Lead</option>
                  <option value="CHAMPION">Champion</option>
                </select>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {roleCopy[member.role]}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(member.id)}
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
