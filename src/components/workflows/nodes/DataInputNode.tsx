'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface DataInputNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function DataInputNode({ data, selected }: NodeProps<DataInputNodeData>) {
  const { step } = data;
  const hasSchema = step.config.inputSchema && Object.keys(step.config.inputSchema as Record<string, unknown>).length > 0;

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? '#e0e7ff' : '#f3f4f6',
        border: `2px solid ${selected ? '#6366f1' : '#9ca3af'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(99, 102, 241, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#6366f1' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#6366f1',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#6366f1',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Data Input
        </div>
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {hasSchema ? 'Form Input' : 'Unconfigured'}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#6366f1' }} />
    </div>
  );
}
