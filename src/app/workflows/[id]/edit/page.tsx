'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workflowsApi } from '@/lib/api-client';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { NodePalette } from '@/components/workflows/NodePalette';
import { PropertyPanel } from '@/components/workflows/PropertyPanel';
import { TestRunner } from '@/components/workflows/TestRunner';
import type { WorkflowStep, WorkflowPlan } from '@/lib/runtime/langgraph/config';
import { Node } from 'reactflow';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  plan: WorkflowPlan;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility: 'TEAM' | 'ORG';
}

export default function EditWorkflowPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [plan, setPlan] = useState<WorkflowPlan>({ steps: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [showTestRunner, setShowTestRunner] = useState(false);

  const loadWorkflow = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await workflowsApi.getById(id);
      const wf = response.workflow as Workflow;
      console.log('Loaded workflow:', wf);
      console.log('Workflow plan:', wf.plan);
      console.log('Plan steps:', wf.plan?.steps);
      setWorkflow(wf);
      // Ensure plan has the correct structure
      const loadedPlan = wf.plan || { steps: [] };
      // If plan is a string (JSON), parse it
      const parsedPlan = typeof loadedPlan === 'string' 
        ? JSON.parse(loadedPlan) 
        : loadedPlan;
      setPlan(parsedPlan);
      console.log('Parsed plan:', parsedPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
      console.error('Error loading workflow:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const handlePlanChange = useCallback((updatedPlan: WorkflowPlan) => {
    setPlan(updatedPlan);
  }, []);

  const handleAddNode = useCallback(
    (step: WorkflowStep) => {
      const updatedPlan: WorkflowPlan = {
        ...plan,
        steps: [...plan.steps, step],
      };
      setPlan(updatedPlan);
    },
    [plan]
  );

  const handleNodeSelect = useCallback(
    (nodeId: string | null) => {
      setSelectedNodeId(nodeId);
      if (nodeId) {
        const step = plan.steps.find((s) => s.id === nodeId);
        setSelectedStep(step || null);
      } else {
        setSelectedStep(null);
      }
    },
    [plan]
  );

  const handleStepUpdate = useCallback(
    (updatedStep: WorkflowStep) => {
      const updatedPlan: WorkflowPlan = {
        ...plan,
        steps: plan.steps.map((s) => (s.id === updatedStep.id ? updatedStep : s)),
      };
      setPlan(updatedPlan);
      setSelectedStep(updatedStep);
    },
    [plan]
  );

  const handleSave = async () => {
    if (!workflow || workflow.status === 'PUBLISHED') {
      alert('Cannot edit published workflow');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await workflowsApi.update(workflow.id, {
        plan,
      });
      router.push(`/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workflow');
      console.error('Error saving workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading workflow...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">Workflow not found</p>
      </div>
    );
  }

  if (workflow.status === 'PUBLISHED') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div
          style={{
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-lg)',
          }}
        >
          <p
            style={{
              color: 'var(--color-warning-text)',
              marginBottom: 'var(--spacing-md)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-body)',
            }}
          >
            This workflow is published and cannot be edited. Please unpublish it first to make changes.
          </p>
          <button
            onClick={async () => {
              try {
                await workflowsApi.unpublish(workflow.id);
                await loadWorkflow(); // Reload to get updated status
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Failed to unpublish workflow');
              }
            }}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              background: 'var(--color-warning)',
              color: 'var(--color-on-primary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-warning-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--color-warning)';
            }}
          >
            Unpublish Workflow
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                marginBottom: 'var(--spacing-xs)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {workflow.name}
            </h1>
            {workflow.description && (
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {workflow.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={() => setShowTestRunner(true)}
              disabled={plan.steps.length === 0}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                cursor: plan.steps.length === 0 ? 'not-allowed' : 'pointer',
                opacity: plan.steps.length === 0 ? 0.5 : 1,
              }}
            >
              Test Workflow
            </button>
            <button
              onClick={() => router.push(`/workflows/${workflow.id}`)}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
        {error && (
          <div
            style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-danger-text)',
              fontSize: '0.875rem',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Node Palette */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <WorkflowCanvas
            plan={plan}
            onPlanChange={handlePlanChange}
            onNodeSelect={handleNodeSelect}
            readOnly={false}
          />
        </div>

        {/* Property Panel */}
        <PropertyPanel selectedStep={selectedStep} onUpdate={handleStepUpdate} />
      </div>

      {/* Test Runner Modal */}
      {showTestRunner && workflow && (
        <TestRunner
          workflowId={workflow.id}
          plan={plan}
          usePlanOverride={true}
          onClose={() => setShowTestRunner(false)}
        />
      )}
    </div>
  );
}
