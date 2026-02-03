'use client';

import { useState } from 'react';
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

  const [allowedCategories, setAllowedCategories] = useState('');
  const [blockedCategories, setBlockedCategories] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleCreateOpportunity = async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Failed to add opportunity');
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!window.confirm('Delete this opportunity?')) return;
    setError(null);
    try {
      await apiRequest(`/api/align/opportunities/${id}`, { method: 'DELETE' });
      setOpportunities(opportunities.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete opportunity');
    }
  };

  const handleCreateRoadmapItem = async () => {
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Failed to add roadmap item');
    }
  };

  const handleDeleteRoadmapItem = async (id: string) => {
    if (!window.confirm('Delete this roadmap item?')) return;
    setError(null);
    try {
      await apiRequest(`/api/align/roadmap/${id}`, { method: 'DELETE' });
      setRoadmapItems(roadmapItems.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete roadmap item');
    }
  };

  const handleCreateCoalitionMember = async () => {
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add coalition member');
    }
  };

  const handleDeleteCoalitionMember = async (id: string) => {
    if (!window.confirm('Remove this coalition member?')) return;
    setError(null);
    try {
      await apiRequest(`/api/align/coalition/${id}`, { method: 'DELETE' });
      setCoalitionMembers(coalitionMembers.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove coalition member');
    }
  };

  const handleCreateGuardrail = async () => {
    setError(null);
    const allowed = allowedCategories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const blocked = blockedCategories
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

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
      setError(err instanceof Error ? err.message : 'Failed to add guardrail');
    }
  };

  const handleDeleteGuardrail = async (id: string) => {
    if (!window.confirm('Delete this guardrail policy?')) return;
    setError(null);
    try {
      await apiRequest(`/api/align/guardrails/${id}`, { method: 'DELETE' });
      setGuardrails(guardrails.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete guardrail');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {error && (
        <div style={{ color: 'var(--color-danger)' }}>{error}</div>
      )}

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Alignment Brief</h2>
          <div style={sectionMetaStyle}>{snapshot.status}</div>
        </header>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
          {snapshot.summary || 'No summary yet.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Opportunity Map</h2>
          <div style={sectionMetaStyle}>{opportunities.length} items</div>
        </header>
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {opportunities.map((item) => (
            <div key={item.id} style={itemRowStyle}>
              <div>
                <strong>{item.title}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {item.department || 'Unassigned'} · Value {item.valueScore} / Feasibility {item.feasibilityScore}
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
          <input
            type="number"
            min={1}
            max={5}
            value={opportunityValue}
            onChange={(event) => setOpportunityValue(Number(event.target.value))}
            style={inputStyle}
          />
          <input
            type="number"
            min={1}
            max={5}
            value={opportunityFeasibility}
            onChange={(event) => setOpportunityFeasibility(Number(event.target.value))}
            style={inputStyle}
          />
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
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {roadmapItems.map((item) => (
            <div key={item.id} style={itemRowStyle}>
              <div>
                <strong>{item.title}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  Priority {item.priority} · {item.status}
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
            style={inputStyle}
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
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {coalitionMembers.map((member) => (
            <div key={member.id} style={itemRowStyle}>
              <div>
                <strong>{member.user.name || member.user.email}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {member.role}
                </div>
              </div>
              <button type="button" onClick={() => handleDeleteCoalitionMember(member.id)} style={dangerButtonStyle}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <div style={formRowStyle}>
          <input
            type="text"
            placeholder="User ID"
            value={coalitionUserId}
            onChange={(event) => setCoalitionUserId(event.target.value)}
            style={inputStyle}
          />
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
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Add members using their user ID for now. We can replace this with a user picker next.
        </div>
      </section>

      <section style={sectionStyle}>
        <header style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Guardrails</h2>
          <div style={sectionMetaStyle}>{guardrails.length} policies</div>
        </header>
        <div style={{ display: 'grid', gap: 'var(--spacing-sm)' }}>
          {guardrails.map((policy) => (
            <div key={policy.id} style={itemRowStyle}>
              <div>
                <strong>{policy.allowedCategories.join(', ') || 'No allowed categories'}</strong>
                <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  Blocked: {policy.blockedCategories.join(', ') || 'None'} · Approval: {policy.requiresApproval ? 'Yes' : 'No'}
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
  background: 'white',
} as const;

const primaryButtonStyle = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  background: 'var(--color-primary)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontWeight: 600,
} as const;

const dangerButtonStyle = {
  padding: 'var(--spacing-xs) var(--spacing-sm)',
  background: 'var(--color-danger)',
  color: 'white',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
} as const;
