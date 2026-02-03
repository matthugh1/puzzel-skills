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
        background: selected ? '#fce7f3' : '#fdf2f8',
        border: `2px solid ${selected ? '#ec4899' : '#f472b6'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(236, 72, 153, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#ec4899' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ec4899',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#ec4899',
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#ec4899' }} />
    </div>
  );
}
