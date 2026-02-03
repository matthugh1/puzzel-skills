'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface MergeNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function MergeNode({ data, selected }: NodeProps<MergeNodeData>) {
  const { step } = data;
  const strategy = step.config.mergeStrategy || 'FIRST';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-info-bg)' : 'var(--color-info-bg)',
        border: `2px solid ${selected ? 'var(--color-info-text)' : 'var(--color-info-border)'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-info-text)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-info-text)',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-info-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Merge
        </div>
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {strategy}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-info-text)' }} />
    </div>
  );
}
