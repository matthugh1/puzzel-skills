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
        background: selected ? '#dcfce7' : '#f0fdf4',
        border: `2px solid ${selected ? '#22c55e' : '#4ade80'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(34, 197, 94, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#22c55e' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#22c55e',
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
      <Handle type="source" position={Position.Bottom} style={{ background: '#22c55e' }} />
    </div>
  );
}
