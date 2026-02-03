'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface WaitNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function WaitNode({ data, selected }: NodeProps<WaitNodeData>) {
  const { step } = data;
  const waitType = step.config.waitType || 'DURATION';
  const duration = step.config.waitDuration;

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-warning-bg)' : 'var(--color-warning-bg)',
        border: `2px solid ${selected ? 'var(--color-warning)' : 'var(--color-warning-border)'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-warning)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-warning)',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-warning)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Wait
        </div>
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {waitType}
      </div>
      {duration && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            marginTop: '4px',
          }}
        >
          {duration}s
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-warning)' }} />
    </div>
  );
}
