'use client';

/**
 * Workflow Canvas Component
 * Visual workflow builder using ReactFlow
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowStep, WorkflowPlan } from '@/lib/runtime/langgraph/config';
import { workflowNodeTypes } from './nodeTypes';

interface WorkflowCanvasProps {
  plan: WorkflowPlan;
  onPlanChange: (plan: WorkflowPlan) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  readOnly?: boolean;
}

/**
 * Convert workflow plan to ReactFlow nodes and edges
 */
function planToFlow(plan: WorkflowPlan): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  plan.steps.forEach((step, index) => {
    // Create node - ensure type is valid
    if (!workflowNodeTypes[step.type]) {
      console.warn(`Unknown node type: ${step.type}, skipping`);
      return;
    }
    
    const node: Node = {
      id: step.id,
      type: step.type,
      position: {
        x: (index % 4) * 250,
        y: Math.floor(index / 4) * 150,
      },
      data: {
        label: getStepLabel(step),
        step,
        onUpdate: (updatedStep: WorkflowStep) => {
          // This will be handled by parent component
        },
      },
    };

    nodes.push(node);

    // Create edges from next array
    if (step.next && step.next.length > 0) {
      step.next.forEach((nextStepId, pathIndex) => {
        edges.push({
          id: `e${step.id}-${nextStepId}-${pathIndex}`,
          source: step.id,
          target: nextStepId,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          label: step.type === 'BRANCH' ? getBranchPathLabel(step, pathIndex) : undefined,
        });
      });
    }
  });

  return { nodes, edges };
}

/**
 * Convert ReactFlow nodes and edges to workflow plan
 */
function flowToPlan(nodes: Node[], edges: Edge[]): WorkflowPlan {
  const steps: WorkflowStep[] = nodes.map((node) => {
    const step = node.data.step as WorkflowStep;
    
    // Find all outgoing edges
    const outgoingEdges = edges.filter((edge) => edge.source === node.id);
    const next = outgoingEdges.map((edge) => edge.target);

    return {
      ...step,
      next: next.length > 0 ? next : undefined,
    };
  });

  return {
    steps,
    metadata: {
      version: '1.0',
    },
  };
}

function getStepLabel(step: WorkflowStep): string {
  switch (step.type) {
    case 'SKILL':
      return step.config.skillId ? `Skill: ${step.config.skillId}` : 'Skill Step';
    case 'BRANCH':
      return 'Branch';
    case 'MERGE':
      return `Merge (${step.config.mergeStrategy || 'FIRST'})`;
    case 'ITERATOR':
      return 'Iterator';
    case 'WAIT':
      return `Wait (${step.config.waitType || 'DURATION'})`;
    case 'APP_ACTION':
      return step.config.appId && step.config.actionId
        ? `${step.config.appId}: ${step.config.actionId}`
        : 'App Action';
    default:
      return step.type;
  }
}

function getBranchPathLabel(step: WorkflowStep, pathIndex: number): string {
  if (step.type !== 'BRANCH' || !step.config.paths) {
    return '';
  }
  const path = step.config.paths[pathIndex];
  return path ? path.condition : '';
}

export function WorkflowCanvas({ plan, onPlanChange, onNodeSelect, readOnly = false }: WorkflowCanvasProps) {
  // Debug logging
  useEffect(() => {
    console.log('WorkflowCanvas - Plan received:', plan);
    console.log('WorkflowCanvas - Plan steps:', plan?.steps);
    console.log('WorkflowCanvas - Steps count:', plan?.steps?.length);
  }, [plan]);

  // Initialize with empty arrays, then update when plan loads
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const prevPlanRef = useRef<WorkflowPlan | null>(null);

  // Debug nodes and edges
  useEffect(() => {
    console.log('WorkflowCanvas - Current nodes:', nodes);
    console.log('WorkflowCanvas - Current edges:', edges);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      // Update plan when edges change
      const updatedPlan = flowToPlan(nodes, addEdge(params, edges));
      onPlanChange(updatedPlan);
    },
    [nodes, edges, setEdges, onPlanChange]
  );

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      // Update plan when nodes are deleted
      const remainingNodes = nodes.filter((node) => !deleted.some((d) => d.id === node.id));
      const remainingEdges = edges.filter(
        (edge) => !deleted.some((d) => d.id === edge.source || d.id === edge.target)
      );
      const updatedPlan = flowToPlan(remainingNodes, remainingEdges);
      onPlanChange(updatedPlan);
    },
    [nodes, edges, onPlanChange]
  );

  const onNodeUpdate = useCallback(
    (nodeId: string, updatedStep: WorkflowStep) => {
      const updatedNodes = nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              step: updatedStep,
              label: getStepLabel(updatedStep),
            },
          };
        }
        return node;
      });
      setNodes(updatedNodes);
      const updatedPlan = flowToPlan(updatedNodes, edges);
      onPlanChange(updatedPlan);
    },
    [nodes, edges, setNodes, onPlanChange]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Update nodes when plan changes externally
  useEffect(() => {
    // Always update if plan exists and has steps, or if it's different from previous
    const prevPlanSteps = prevPlanRef.current?.steps || [];
    const currentPlanSteps = plan?.steps || [];
    const planChanged = 
      !prevPlanRef.current ||
      JSON.stringify(prevPlanSteps) !== JSON.stringify(currentPlanSteps);
    
    if (planChanged && plan) {
      console.log('Plan changed, updating nodes/edges');
      console.log('Plan steps:', plan.steps);
      const newFlow = planToFlow(plan);
      console.log('New flow nodes:', newFlow.nodes);
      console.log('New flow edges:', newFlow.edges);
      setNodes(newFlow.nodes);
      setEdges(newFlow.edges);
      prevPlanRef.current = plan;
    }
  }, [plan, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={workflowNodeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={readOnly ? null : 'Delete'}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
