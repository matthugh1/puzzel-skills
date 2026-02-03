'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface AppActionNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function AppActionNode({ data, selected }: NodeProps<AppActionNodeData>) {
  const { step } = data;
  const appId = step.config.appId || '';
  const actionId = step.config.actionId || '';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-success-bg)' : 'var(--color-success-bg)',
        border: `2px solid ${selected ? 'var(--color-success)' : 'var(--color-success-border)'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? 'var(--shadow-selected)' : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-success)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--color-success)',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-success)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          App Action
        </div>
      </div>
      {appId && (
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-text)',
          }}
        >
          {appId}
        </div>
      )}
      {actionId && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)',
            marginTop: '2px',
          }}
        >
          {actionId}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-success)' }} />
    </div>
  );
}
