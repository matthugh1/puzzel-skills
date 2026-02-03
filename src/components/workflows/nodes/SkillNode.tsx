'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface SkillNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function SkillNode({ data, selected }: NodeProps<SkillNodeData>) {
  const { label, step } = data;
  const skillName = step.config.skillId || 'Unconfigured';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-accent-bg)' : 'var(--color-neutral-bg)',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-neutral-border)'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-primary)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-primary)',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Skill
        </div>
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {skillName}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-primary)' }} />
    </div>
  );
}
