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
        background: selected ? '#dbeafe' : '#eff6ff',
        border: `2px solid ${selected ? '#3b82f6' : '#60a5fa'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(59, 130, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#3b82f6' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#3b82f6',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#3b82f6',
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6' }} />
    </div>
  );
}
