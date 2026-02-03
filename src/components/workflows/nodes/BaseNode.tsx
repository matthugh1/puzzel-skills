'use client';

/**
 * Base Node Component
 * Common styling and structure for all workflow nodes
 */

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface BaseNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function BaseNode({ data, selected }: NodeProps<BaseNodeData>) {
  const { label } = data;

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? 'var(--color-primary-light)' : 'white',
        border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '150px',
        boxShadow: selected ? '0 4px 12px rgba(139, 92, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
          marginBottom: '4px',
        }}
      >
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
}
