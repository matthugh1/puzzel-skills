'use client';

/**
 * Node Palette Component
 * Provides draggable node types for adding to workflow canvas
 */

import { useCallback } from 'react';
// Client-side ID generation
function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
import type { WorkflowStep } from '@/lib/runtime/langgraph/config';

interface NodePaletteProps {
  onAddNode: (step: WorkflowStep) => void;
}

const nodeTypes: Array<{
  type: WorkflowStep['type'];
  label: string;
  icon: string;
  color: string;
}> = [
  { type: 'SKILL', label: 'Skill', icon: '⚡', color: 'var(--color-primary)' },
  { type: 'BRANCH', label: 'Branch', icon: '🔀', color: 'var(--color-warning)' },
  { type: 'MERGE', label: 'Merge', icon: '🔗', color: 'var(--color-info-text)' },
  { type: 'ITERATOR', label: 'Iterator', icon: '🔁', color: 'var(--color-primary)' },
  { type: 'WAIT', label: 'Wait', icon: '⏸️', color: 'var(--color-warning)' },
  { type: 'APP_ACTION', label: 'App Action', icon: '🔌', color: 'var(--color-success)' },
  { type: 'TASK', label: 'Task', icon: '📋', color: 'var(--color-warning)' },
  { type: 'DATA_INPUT', label: 'Data Input', icon: '📝', color: 'var(--color-primary)' },
];

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const handleAddNode = useCallback(
    (type: WorkflowStep['type']) => {
      const step: WorkflowStep = {
        id: generateId(),
        type,
        config: getDefaultConfig(type),
      };
      onAddNode(step);
    },
    [onAddNode]
  );

  return (
    <div
      style={{
        width: '200px',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: 'var(--spacing-md)',
        overflowY: 'auto',
      }}
    >
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-text)',
          marginBottom: 'var(--spacing-md)',
          fontFamily: 'var(--font-body)',
        }}
      >
        Add Step
      </h3>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-xs)',
        }}
      >
        {nodeTypes.map((nodeType) => (
          <button
            key={nodeType.type}
            onClick={() => handleAddNode(nodeType.type)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-surface)',
              border: `1px solid var(--color-border)`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-secondary)';
              e.currentTarget.style.borderColor = nodeType.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-surface)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{nodeType.icon}</span>
            <span style={{ fontWeight: 500 }}>{nodeType.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getDefaultConfig(type: WorkflowStep['type']): WorkflowStep['config'] {
  switch (type) {
    case 'SKILL':
      return {};
    case 'BRANCH':
      return {
        condition: { type: 'JSONPATH' },
        paths: [],
      };
    case 'MERGE':
      return {
        mergeStrategy: 'FIRST',
      };
    case 'ITERATOR':
      return {
        iteratorConfig: {
          collectionPath: '',
          stepId: '',
        },
      };
    case 'WAIT':
      return {
        waitType: 'DURATION',
        waitDuration: 60,
      };
    case 'APP_ACTION':
      return {
        appId: '',
        actionId: '',
        actionParams: {},
      };
    case 'TASK':
      return {
        taskDescription: '',
        description: '',
        assigneeId: '',
      };
    case 'DATA_INPUT':
      return {
        inputSchema: {
          type: 'object',
          properties: {},
        },
        assigneeId: '',
      };
    default:
      return {};
  }
}
