'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface TaskNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function TaskNode({ data, selected }: NodeProps<TaskNodeData>) {
  const { step } = data;
  const taskDescription = step.config.taskDescription || 'Unconfigured';

  return (
    <div
      style={{
        padding: '12px 16px',
        background: selected ? '#fef3c7' : '#fffbeb',
        border: `2px solid ${selected ? '#f59e0b' : '#fbbf24'}`,
        borderRadius: 'var(--radius-md)',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(245, 158, 11, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s ease',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#f59e0b' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#f59e0b',
          }}
        />
        <div
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#f59e0b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Task
        </div>
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text)',
        }}
      >
        {taskDescription}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b' }} />
    </div>
  );
}
