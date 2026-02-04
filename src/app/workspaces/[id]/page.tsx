'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workspacesApi } from '@/lib/api-client';
import { ChatInterface } from '@/components/workspaces/ChatInterface';
import { SkillsSidebar } from '@/components/workspaces/SkillsSidebar';
import { ToolsSidebar } from '@/components/workspaces/ToolsSidebar';
import { IntegrationsSidebar } from '@/components/workspaces/IntegrationsSidebar';
import { EscalateToAgentButton } from '@/components/workspaces/EscalateToAgentButton';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  isActive: boolean;
}


export default function WorkspaceCanvasPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<{ id: string; name: string } | null>(null);
  const [selectedTool, setSelectedTool] = useState<{ id: string; name: string } | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<{ appName: string; actionName: string } | null>(null);
  const [escalateContext, setEscalateContext] = useState<{
    skillId?: string;
    toolId?: string;
    result?: unknown;
    goal?: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadWorkspace();
    }
  }, [id]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await workspacesApi.getById(id);
      setWorkspace(response.workspace as Workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace');
      console.error('Error loading workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkillSelect = (skill: { id: string; name: string }) => {
    setSelectedSkill(skill);
  };

  const handleSkillDeselect = () => {
    setSelectedSkill(null);
  };

  const handleToolSelect = (tool: { id: string; name: string }) => {
    setSelectedTool(tool);
  };

  const handleToolDeselect = () => {
    setSelectedTool(null);
  };

  const handleIntegrationActionSelect = (appName: string, actionName: string) => {
    setSelectedIntegration({ appName, actionName });
  };

  const handleIntegrationActionDeselect = () => {
    setSelectedIntegration(null);
  };

  const handleEscalate = (context: { skillId?: string; toolId?: string; result?: unknown }) => {
    setEscalateContext({
      ...context,
      goal: context.skillId
        ? `Continue and expand on skill execution`
        : 'Continue and expand on this task',
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'var(--spacing-2xl)',
            color: 'var(--color-text-secondary)',
          }}
        >
          Loading workspace...
        </div>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="page-container">
        <div
          style={{
            padding: 'var(--spacing-lg)',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-lg)',
          }}
        >
          <strong>Error:</strong> {error || 'Workspace not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="page-header" style={{ flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <button
              onClick={() => router.back()}
              style={{
                padding: 'var(--spacing-sm)',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
              }}
            >
              ← Back
            </button>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                margin: 0,
                fontFamily: 'var(--font-display)',
                color: 'var(--color-text)',
              }}
            >
              {workspace.name}
            </h1>
            {workspace.isActive && (
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  background: 'var(--color-success-bg)',
                  color: 'var(--color-success-text)',
                }}
              >
                Active
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="page-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Integrations */}
        <IntegrationsSidebar
          workspaceId={id}
          selectedIntegration={selectedIntegration}
          onIntegrationActionSelect={handleIntegrationActionSelect}
          onIntegrationActionDeselect={handleIntegrationActionDeselect}
        />

        {/* Left-Center Sidebar - Skills */}
        <SkillsSidebar workspaceId={id} onSkillSelect={handleSkillSelect} />

        {/* Center - Chat Interface */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatInterface
            workspaceId={id}
            selectedSkill={selectedSkill}
            selectedTool={selectedTool}
            selectedIntegration={selectedIntegration}
            onSkillDeselect={handleSkillDeselect}
            onToolDeselect={handleToolDeselect}
            onIntegrationActionDeselect={handleIntegrationActionDeselect}
            onEscalate={handleEscalate}
          />
        </div>

        {/* Right Sidebar - Tools */}
        <ToolsSidebar
          selectedTool={selectedTool}
          onToolSelect={handleToolSelect}
          onToolDeselect={handleToolDeselect}
        />
      </main>

      {/* Escalation Modal */}
      {escalateContext && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEscalateContext(null)}
        >
          <div
            style={{
              background: 'var(--color-background)',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginTop: 0,
                marginBottom: 'var(--spacing-md)',
                color: 'var(--color-text)',
              }}
            >
              Turn into Agent Run
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              Create an agent run to continue and expand on this execution.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEscalateContext(null)}
                style={{
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <EscalateToAgentButton workspaceId={id} context={escalateContext} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
