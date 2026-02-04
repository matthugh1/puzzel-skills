'use client';

import { useRouter } from 'next/navigation';

interface EscalateToAgentButtonProps {
  workspaceId: string;
  context: {
    skillId?: string;
    result?: unknown;
    goal?: string;
  };
}

export function EscalateToAgentButton({ workspaceId, context }: EscalateToAgentButtonProps) {
  const router = useRouter();

  const handleEscalate = () => {
    // Build goal from context
    const goal = context.goal || 
      (context.skillId ? `Continue and expand on skill execution` : 
       'Continue and expand on this task');

    // Build initial context with execution details
    const initialContext: Record<string, unknown> = {
      workspaceId,
      ...(context.skillId && { skillId: context.skillId }),
      ...(context.result && { previousResult: context.result }),
    };

    // Navigate to run creation with pre-filled data
    const params = new URLSearchParams({
      workspaceId,
      goal,
      context: JSON.stringify(initialContext),
    });

    router.push(`/runs/new?${params.toString()}`);
  };

  return (
    <button
      onClick={handleEscalate}
      style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--color-primary)',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
      }}
    >
      Turn into Agent Run
    </button>
  );
}
