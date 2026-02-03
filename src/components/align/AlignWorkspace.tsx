'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

interface SnapshotCounts {
  opportunities: number;
  roadmapItems: number;
  coalitionMembers: number;
  guardrailPolicies: number;
}

interface AlignmentSnapshot {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  updatedAt: string;
  _count: SnapshotCounts;
}

interface Opportunity {
  id: string;
  title: string;
  department: string | null;
  valueScore: number;
  feasibilityScore: number;
  status: string;
}

interface RoadmapItem {
  id: string;
  title: string;
  priority: number;
  status: string;
}

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

interface GuardrailPolicy {
  id: string;
  allowedCategories: string[];
  blockedCategories: string[];
  requiresApproval: boolean;
}

interface AlignWorkspaceProps {
  snapshot: AlignmentSnapshot;
  opportunities: Opportunity[];
  roadmapItems: RoadmapItem[];
  coalitionMembers: CoalitionMember[];
  guardrailPolicies: GuardrailPolicy[];
}

export function AlignWorkspace({
  snapshot,
  opportunities: initialOpportunities,
  roadmapItems: initialRoadmap,
  coalitionMembers: initialCoalition,
  guardrailPolicies: initialGuardrails,
}: AlignWorkspaceProps) {
  const [snapshotTitle, setSnapshotTitle] = useState(snapshot.title);
  const [snapshotSummary, setSnapshotSummary] = useState(snapshot.summary || '');
  const [snapshotStatus, setSnapshotStatus] = useState(snapshot.status);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [roadmapItems, setRoadmapItems] = useState(initialRoadmap);
  const [coalitionMembers, setCoalitionMembers] = useState(initialCoalition);
  const [guardrails, setGuardrails] = useState(initialGuardrails);

  const [opportunityTitle, setOpportunityTitle] = useState('');
  const [opportunityDept, setOpportunityDept] = useState('');
  const [opportunityValue, setOpportunityValue] = useState(3);
  const [opportunityFeasibility, setOpportunityFeasibility] = useState(3);

  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapPriority, setRoadmapPriority] = useState(1);

  const [coalitionUserId, setCoalitionUserId] = useState('');
  const [coalitionRole, setCoalitionRole] = useState('CHAMPION');
  const [coalitionSearch, setCoalitionSearch] = useState('');
  const [coalitionOptions, setCoalitionOptions] = useState<UserOption[]>([]);
  const [coalitionLoading, setCoalitionLoading] = useState(false);

  const [allowedCategories, setAllowedCategories] = useState('');
  const [blockedCategories, setBlockedCategories] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [coalitionError, setCoalitionError] = useState<string | null>(null);
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  const handleUpdateSnapshot = async () => {
    setSnapshotError(null);
    setSnapshotSaving(true);
    setSnapshotSaved(false);
    try {
      await apiRequest(`/api/align/${snapshot.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: snapshotTitle.trim() || 'Alignment Snapshot',
          summary: snapshotSummary.trim() || undefined,
          status: snapshotStatus,
        }),
      });
      setSnapshotSaved(true);
      setTimeout(() => setSnapshotSaved(false), 2000);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : 'Failed to update snapshot');
    } finally {
      setSnapshotSaving(false);
    }
  };

  useEffect(() => {
    if (coalitionSearch.trim().length < 2) {
      setCoalitionOptions([]);
      return;
    }

    let active = true;
    const handle = setTimeout(async () => {
      setCoalitionLoading(true);
      try {
        const data = await apiRequest<{ users: UserOption[] }>(
          `/api/align/coalition/users?search=${encodeURIComponent(coalitionSearch.trim())}`
        );
        if (active) {
          setCoalitionOptions(data.users);
        }
      } catch {
        if (active) {
          setCoalitionOptions([]);
        }
      } finally {
        if (active) {
          setCoalitionLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [coalitionSearch]);

  const handleCreateOpportunity = async () => {
    setOpportunityError(null);
    if (!opportunityTitle.trim()) {
      setOpportunityError('Opportunity title is required.');
      return;
    }
    try {
      const { opportunity } = await apiRequest<{ opportunity: Opportunity }>(
        '/api/align/opportunities',
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId: snapshot.id,
            title: opportunityTitle,
            department: opportunityDept || undefined,
            valueScore: opportunityValue,
            feasibilityScore: opportunityFeasibility,
          }),
        }
      );
      setOpportunities([opportunity, ...opportunities]);
      setOpportunityTitle('');
      setOpportunityDept('');
      setOpportunityValue(3);
      setOpportunityFeasibility(3);
    } catch (err) {
      setOpportunityError(err instanceof Error ? err.message : 'Failed to add opportunity');
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!window.confirm('Delete this opportunity?')) return;
    setOpportunityError(null);
    try {
      await apiRequest(`/api/align/opportunities/${id}`, { method: 'DELETE' });
      setOpportunities(opportunities.filter((item) => item.id !== id));
    } catch (err) {
      setOpportunityError(err instanceof Error ? err.message : 'Failed to delete opportunity');
    }
  };

  const handleCreateRoadmapItem = async () => {
    setRoadmapError(null);
    if (!roadmapTitle.trim()) {
      setRoadmapError('Roadmap item title is required.');
      return;
    }
    try {
      const { roadmapItem } = await apiRequest<{ roadmapItem: RoadmapItem }>(
        '/api/align/roadmap',
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId: snapshot.id,
            title: roadmapTitle,
            priority: roadmapPriority,
          }),
        }
      );
      setRoadmapItems([...roadmapItems, roadmapItem].sort((a, b) => a.priority - b.priority));
      setRoadmapTitle('');
      setRoadmapPriority(1);
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Failed to add roadmap item');
    }
  };

  const handleDeleteRoadmapItem = async (id: string) => {
    if (!window.confirm('Delete this roadmap item?')) return;
    setRoadmapError(null);
    try {
      await apiRequest(`/api/align/roadmap/${id}`, { method: 'DELETE' });
      setRoadmapItems(roadmapItems.filter((item) => item.id !== id));
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Failed to delete roadmap item');
    }
  };

  const handleUpdateOpportunity = async (
    id: string,
    updates: Partial<Opportunity>
  ) => {
    setOpportunityError(null);
    try {
      const { opportunity } = await apiRequest<{ opportunity: Opportunity }>(
        `/api/align/opportunities/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setOpportunities((prev) =>
        prev.map((item) => (item.id === id ? opportunity : item))
      );
    } catch (err) {
      setOpportunityError(err instanceof Error ? err.message : 'Failed to update opportunity');
    }
  };

  const handleUpdateRoadmapItem = async (
    id: string,
    updates: Partial<RoadmapItem>
  ) => {
    setRoadmapError(null);
    try {
      const { roadmapItem } = await apiRequest<{ roadmapItem: RoadmapItem }>(
        `/api/align/roadmap/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setRoadmapItems((prev) =>
        prev.map((item) => (item.id === id ? roadmapItem : item))
      );
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Failed to update roadmap item');
    }
  };

  const handleCreateCoalitionMember = async () => {
    setCoalitionError(null);
    if (!coalitionUserId) {
      setCoalitionError('Select a user before adding to the coalition.');
      return;
    }
    try {
      const { coalitionMember } = await apiRequest<{ coalitionMember: CoalitionMember }>(
        '/api/align/coalition',
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId: snapshot.id,
            userId: coalitionUserId,
            role: coalitionRole,
          }),
        }
      );
      setCoalitionMembers([...coalitionMembers, coalitionMember]);
      setCoalitionUserId('');
      setCoalitionRole('CHAMPION');
      setCoalitionSearch('');
      setCoalitionOptions([]);
    } catch (err) {
      setCoalitionError(err instanceof Error ? err.message : 'Failed to add coalition member');
    }
  };

  const handleDeleteCoalitionMember = async (id: string) => {
    if (!window.confirm('Remove this coalition member?')) return;
    setCoalitionError(null);
    try {
      await apiRequest(`/api/align/coalition/${id}`, { method: 'DELETE' });
      setCoalitionMembers(coalitionMembers.filter((item) => item.id !== id));
    } catch (err) {
      setCoalitionError(err instanceof Error ? err.message : 'Failed to remove coalition member');
    }
  };

  const handleCreateGuardrail = async () => {
    setGuardrailError(null);
    const allowed = allowedCategories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const blocked = blockedCategories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (allowed.length === 0 && blocked.length === 0) {
      setGuardrailError('Provide at least one allowed or blocked category.');
      return;
    }

    try {
      const { guardrailPolicy } = await apiRequest<{ guardrailPolicy: GuardrailPolicy }>(
        '/api/align/guardrails',
        {
          method: 'POST',
          body: JSON.stringify({
            snapshotId: snapshot.id,
            allowedCategories: allowed,
            blockedCategories: blocked,
            requiresApproval,
          }),
        }
      );
      setGuardrails([guardrailPolicy, ...guardrails]);
      setAllowedCategories('');
      setBlockedCategories('');
      setRequiresApproval(false);
    } catch (err) {
      setGuardrailError(err instanceof Error ? err.message : 'Failed to add guardrail');
    }
  };

  const handleDeleteGuardrail = async (id: string) => {
    if (!window.confirm('Delete this guardrail policy?')) return;
    setGuardrailError(null);
    try {
      await apiRequest(`/api/align/guardrails/${id}`, { method: 'DELETE' });
      setGuardrails(guardrails.filter((item) => item.id !== id));
    } catch (err) {
      setGuardrailError(err instanceof Error ? err.message : 'Failed to delete guardrail');
    }
  };

  const handleUpdateCoalitionMember = async (
    id: string,
    updates: Partial<CoalitionMember>
  ) => {
    setCoalitionError(null);
    try {
      const { coalitionMember } = await apiRequest<{ coalitionMember: CoalitionMember }>(
        `/api/align/coalition/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setCoalitionMembers((prev) =>
        prev.map((item) => (item.id === id ? coalitionMember : item))
      );
    } catch (err) {
      setCoalitionError(err instanceof Error ? err.message : 'Failed to update coalition member');
    }
  };

  const handleUpdateGuardrail = async (
    id: string,
    updates: Partial<GuardrailPolicy>
  ) => {
    setGuardrailError(null);
    try {
      const { guardrailPolicy } = await apiRequest<{ guardrailPolicy: GuardrailPolicy }>(
        `/api/align/guardrails/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      setGuardrails((prev) =>
        prev.map((item) => (item.id === id ? guardrailPolicy : item))
      );
    } catch (err) {
      setGuardrailError(err instanceof Error ? err.message : 'Failed to update guardrail');
    }
  };

  const parseSummarySections = (summaryText: string) => {
    return summaryText
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const [firstLine, ...rest] = block.split('\n');
        const label = firstLine?.replace(/:$/, '').trim() || 'Notes';
        const content = rest.join('\n').trim() || 'Not provided.';
        return { label, content };
      });
  };

  const summarySections = snapshotSummary.trim()
    ? parseSummarySections(snapshotSummary)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Snapshot</h2>
          <div style={sectionMetaStyle}>Last updated: {new Date(snapshot.updatedAt).toLocaleString()}</div>
        </header>
        {snapshotError && <div style={{ color: 'var(--color-danger)' }}>{snapshotError}</div>}
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Title</span>
            <input
              type="text"
              value={snapshotTitle}
              onChange={(event) => setSnapshotTitle(event.target.value)}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Status</span>
            <select
              value={snapshotStatus}
              onChange={(event) => setSnapshotStatus(event.target.value)}
              style={selectStyle}
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Summary</span>
            <textarea
              rows={4}
              value={snapshotSummary}
              onChange={(event) => setSnapshotSummary(event.target.value)}
              style={inputStyle}
            />
          </label>
          <div>
            <button
              type="button"
              onClick={handleUpdateSnapshot}
              style={{
                ...primaryButtonStyle,
                opacity: snapshotSaving ? 0.7 : 1,
                cursor: snapshotSaving ? 'not-allowed' : 'pointer',
              }}
              disabled={snapshotSaving}
            >
              {snapshotSaving ? 'Saving...' : 'Save Snapshot'}
            </button>
            {snapshotSaved && (
              <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-success)' }}>
                Saved
              </span>
            )}
          </div>
        </div>
      </section>
      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Alignment Brief</h2>
          <div style={sectionMetaStyle}>{snapshotStatus}</div>
        </header>
        {summarySections.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            No summary yet.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 'var(--spacing-md)',
            }}
          >
            {summarySections.map((section) => (
              <div
                key={section.label}
                style={{
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--spacing-xs)',
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontSize: '0.95rem',
                  }}
                >
                  {section.label}
                </div>
                <div
                  style={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Opportunity Map</h2>
          <div style={sectionMetaStyle}>{opportunities.length} items</div>
        </header>
        {opportunityError && <div style={{ color: 'var(--color-danger)' }}>{opportunityError}</div>}
        {opportunities.length === 0 && (
          <div style={emptyStateStyle}>
            No opportunities yet. Add the first candidate use case below.
          </div>
        )}
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {opportunities.map((item) => (
            <div key={item.id} style={itemRowStyle}>
              <div>
                <strong>{item.title}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {item.department || 'Unassigned'} · Value {item.valueScore} / Feasibility {item.feasibilityScore}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
                  <select
                    value={item.status}
                    onChange={(event) => handleUpdateOpportunity(item.id, { status: event.target.value })}
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
                    onChange={(event) =>
                      handleUpdateOpportunity(item.id, { valueScore: Number(event.target.value) })
                    }
                    style={smallInputStyle}
                  />
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={item.feasibilityScore}
                    onChange={(event) =>
                      handleUpdateOpportunity(item.id, { feasibilityScore: Number(event.target.value) })
                    }
                    style={smallInputStyle}
                  />
                </div>
              </div>
              <button type="button" onClick={() => handleDeleteOpportunity(item.id)} style={dangerButtonStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div style={formRowStyle}>
          <input
            type="text"
            placeholder="Opportunity title"
            value={opportunityTitle}
            onChange={(event) => setOpportunityTitle(event.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Department"
            value={opportunityDept}
            onChange={(event) => setOpportunityDept(event.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              type="number"
              min={1}
              max={5}
              value={opportunityValue}
              onChange={(event) => setOpportunityValue(Number(event.target.value))}
              style={smallInputStyle}
            />
            <input
              type="number"
              min={1}
              max={5}
              value={opportunityFeasibility}
              onChange={(event) => setOpportunityFeasibility(Number(event.target.value))}
              style={smallInputStyle}
            />
          </div>
          <button type="button" onClick={handleCreateOpportunity} style={primaryButtonStyle}>
            Add
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Roadmap</h2>
          <div style={sectionMetaStyle}>{roadmapItems.length} items</div>
        </header>
        {roadmapError && <div style={{ color: 'var(--color-danger)' }}>{roadmapError}</div>}
        {roadmapItems.length === 0 && (
          <div style={emptyStateStyle}>
            No roadmap items yet. Add your first priority below.
          </div>
        )}
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {roadmapItems.map((item) => (
            <div key={item.id} style={itemRowStyle}>
              <div>
                <strong>{item.title}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  Priority {item.priority} · {item.status}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
                  <select
                    value={item.status}
                    onChange={(event) => handleUpdateRoadmapItem(item.id, { status: event.target.value })}
                    style={selectStyle}
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.priority}
                    onChange={(event) =>
                      handleUpdateRoadmapItem(item.id, { priority: Number(event.target.value) })
                    }
                    style={smallInputStyle}
                  />
                </div>
              </div>
              <button type="button" onClick={() => handleDeleteRoadmapItem(item.id)} style={dangerButtonStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div style={formRowStyle}>
          <input
            type="text"
            placeholder="Roadmap item"
            value={roadmapTitle}
            onChange={(event) => setRoadmapTitle(event.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            min={1}
            max={999}
            value={roadmapPriority}
            onChange={(event) => setRoadmapPriority(Number(event.target.value))}
            style={smallInputStyle}
          />
          <button type="button" onClick={handleCreateRoadmapItem} style={primaryButtonStyle}>
            Add
          </button>
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Coalition</h2>
          <div style={sectionMetaStyle}>{coalitionMembers.length} members</div>
        </header>
        {coalitionError && <div style={{ color: 'var(--color-danger)' }}>{coalitionError}</div>}
        {coalitionMembers.length === 0 && (
          <div style={emptyStateStyle}>
            No coalition members yet. Add sponsors, leads, and champions.
          </div>
        )}
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {coalitionMembers.map((member) => (
            <div key={member.id} style={itemRowStyle}>
              <div>
                <strong>{member.user.name || member.user.email}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {member.role}
                </div>
                <div style={{ marginTop: 'var(--spacing-xs)' }}>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      handleUpdateCoalitionMember(member.id, { role: event.target.value })
                    }
                    style={selectStyle}
                  >
                    <option value="SPONSOR">Sponsor</option>
                    <option value="LEAD">Lead</option>
                    <option value="CHAMPION">Champion</option>
                    <option value="IT">IT</option>
                    <option value="SECURITY">Security</option>
                    <option value="LND">L&D</option>
                  </select>
                </div>
              </div>
              <button type="button" onClick={() => handleDeleteCoalitionMember(member.id)} style={dangerButtonStyle}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <div style={formRowStyle}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by name or email"
              value={coalitionSearch}
              onChange={(event) => {
                setCoalitionSearch(event.target.value);
                setCoalitionUserId('');
              }}
              style={inputStyle}
            />
            {coalitionLoading && (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: 'var(--spacing-xs)' }}>
                Searching...
              </div>
            )}
            {coalitionOptions.length > 0 && (
              <div style={optionListStyle}>
                {coalitionOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setCoalitionUserId(option.id);
                      setCoalitionSearch(option.name || option.email);
                      setCoalitionOptions([]);
                    }}
                    style={optionButtonStyle}
                  >
                    <div style={{ fontWeight: 600 }}>{option.name || option.email}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{option.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={coalitionRole}
            onChange={(event) => setCoalitionRole(event.target.value)}
            style={inputStyle}
          >
            <option value="SPONSOR">Sponsor</option>
            <option value="LEAD">Lead</option>
            <option value="CHAMPION">Champion</option>
            <option value="IT">IT</option>
            <option value="SECURITY">Security</option>
            <option value="LND">L&D</option>
          </select>
          <button type="button" onClick={handleCreateCoalitionMember} style={primaryButtonStyle}>
            Add
          </button>
        </div>
        {coalitionUserId && (
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Selected user ID: {coalitionUserId}
          </div>
        )}
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Search for a user and select them to add to the coalition.
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Guardrails</h2>
          <div style={sectionMetaStyle}>{guardrails.length} policies</div>
        </header>
        {guardrailError && <div style={{ color: 'var(--color-danger)' }}>{guardrailError}</div>}
        {guardrails.length === 0 && (
          <div style={emptyStateStyle}>
            No guardrails yet. Add allowed or blocked categories to set boundaries.
          </div>
        )}
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {guardrails.map((policy) => (
            <div key={policy.id} style={itemRowStyle}>
              <div>
                <strong>{policy.allowedCategories.join(', ') || 'No allowed categories'}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  Blocked: {policy.blockedCategories.join(', ') || 'None'} · Approval: {policy.requiresApproval ? 'Yes' : 'No'}
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-xs)' }}>
                  <input
                    type="text"
                    defaultValue={policy.allowedCategories.join(', ')}
                    onBlur={(event) => {
                      const value = event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean);
                      handleUpdateGuardrail(policy.id, { allowedCategories: value });
                    }}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    defaultValue={policy.blockedCategories.join(', ')}
                    onBlur={(event) => {
                      const value = event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean);
                      handleUpdateGuardrail(policy.id, { blockedCategories: value });
                    }}
                    style={inputStyle}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    <input
                      type="checkbox"
                      defaultChecked={policy.requiresApproval}
                      onChange={(event) =>
                        handleUpdateGuardrail(policy.id, { requiresApproval: event.target.checked })
                      }
                    />
                    Approval
                  </label>
                </div>
              </div>
              <button type="button" onClick={() => handleDeleteGuardrail(policy.id)} style={dangerButtonStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div style={formRowStyle}>
          <input
            type="text"
            placeholder="Allowed categories (comma separated)"
            value={allowedCategories}
            onChange={(event) => setAllowedCategories(event.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Blocked categories (comma separated)"
            value={blockedCategories}
            onChange={(event) => setBlockedCategories(event.target.value)}
            style={inputStyle}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
            />
            Approval required
          </label>
          <button type="button" onClick={handleCreateGuardrail} style={primaryButtonStyle}>
            Add
          </button>
        </div>
      </section>
    </div>
  );
}

const sectionStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--spacing-lg)',
} as const;

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 'var(--spacing-md)',
} as const;

const sectionTitleStyle = {
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: 0,
  color: 'var(--color-text)',
} as const;

const sectionMetaStyle = {
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
} as const;

const itemRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--spacing-md)',
  padding: 'var(--spacing-sm) 0',
  borderBottom: '1px solid var(--color-border)',
} as const;

const formRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--spacing-sm)',
  marginTop: 'var(--spacing-md)',
} as const;

const inputStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  padding: 'var(--spacing-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text)',
  background: 'var(--color-surface)',
} as const;

const selectStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text)',
  background: 'var(--color-surface)',
} as const;

const smallInputStyle = {
  width: '70px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  fontFamily: 'var(--font-body)',
  color: 'var(--color-text)',
  background: 'var(--color-surface)',
} as const;

const emptyStateStyle = {
  padding: 'var(--spacing-sm) 0',
  color: 'var(--color-text-secondary)',
  fontSize: '0.9rem',
} as const;

const optionListStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 10,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-md)',
  padding: 'var(--spacing-xs)',
  display: 'grid',
  gap: 'var(--spacing-xs)',
} as const;

const optionButtonStyle = {
  textAlign: 'left',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  cursor: 'pointer',
} as const;

const primaryButtonStyle = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  background: 'var(--color-primary)',
  color: 'var(--color-on-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontWeight: 600,
} as const;

const dangerButtonStyle = {
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  background: 'var(--color-danger)',
  color: 'var(--color-on-primary)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
} as const;
