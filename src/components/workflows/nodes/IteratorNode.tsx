'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface IteratorNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function IteratorNode({ data, selected }: NodeProps<IteratorNodeData>) {
  const { step } = data;
  const collectionPath = step.config.iteratorConfig?.collectionPath || '';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-accent-bg)' : 'var(--color-accent-bg)',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-primary-light)'}`,
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
          Iterator
        </div>
      </div>
      {collectionPath && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            fontFamily: 'monospace',
            marginTop: '4px',
          }}
        >
          {collectionPath}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-primary)' }} />
    </div>
  );
}
