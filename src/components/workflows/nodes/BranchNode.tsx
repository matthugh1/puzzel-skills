'use client';

import { Handle, Position, NodeProps } from 'reactflow';
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface BranchNodeData {
  label: string;
  step: WorkflowStep;
  onUpdate?: (step: WorkflowStep) => void;
}

export function BranchNode({ data, selected }: NodeProps<BranchNodeData>) {
  const { step } = data;
  const paths = step.config.paths || [];
  const conditionType = step.config.condition?.type || 'JSONPATH';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
          Branch
        </div>
      </div>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          marginBottom: '8px',
        }}
      >
        {conditionType}
      </div>
      {paths.map((path, index) => (
        <Handle
          key={`source-${index}`}
          type="source"
          position={Position.Bottom}
          id={`path-${index}`}
          style={{
            background: 'var(--color-warning)',
            left: `${(index + 1) * (100 / (paths.length + 1))}%`,
          }}
        />
      ))}
      {paths.length === 0 && (
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-warning)' }} />
      )}
    </div>
  );
}
