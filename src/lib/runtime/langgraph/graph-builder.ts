/**
 * LangGraph Workflow Graph Builder
 * Converts workflow plan JSON into LangGraph state machine
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { workflowStateAnnotation } from './state';
import type { WorkflowPlan, WorkflowStep } from './config';
import { createSkillNode } from './nodes/skill-node';
import { createBranchNode } from './nodes/branch-node';
import { createMergeNode } from './nodes/merge-node';
import { createIteratorNode } from './nodes/iterator-node';
import { createWaitNode } from './nodes/wait-node';
import { createAppActionNode } from './nodes/app-action-node';
import { createTaskNode } from './nodes/task-node';
import { createDataInputNode } from './nodes/data-input-node';

/**
 * Build LangGraph workflow graph from plan
 * Returns the graph and a list of node names that should be interrupted (for human-in-the-loop)
 */
export function buildWorkflowGraph(plan: WorkflowPlan): {
  graph: StateGraph<typeof workflowStateAnnotation.State>;
  interruptNodes: string[];
} {
  const graph = new StateGraph(workflowStateAnnotation);

  // Build nodes for each step
  const stepNodes = new Map<string, string>(); // stepId -> nodeName
  const interruptNodes: string[] = []; // Nodes that require human-in-the-loop

  for (const step of plan.steps) {
    const nodeName = `step_${step.id}`;
    stepNodes.set(step.id, nodeName);

    // Track nodes that require interruption (human-in-the-loop)
    if (['WAIT', 'TASK', 'DATA_INPUT'].includes(step.type)) {
      interruptNodes.push(nodeName);
    }

    // Create node based on step type
    switch (step.type) {
      case 'SKILL':
        graph.addNode(nodeName, createSkillNode(step));
        break;
      case 'BRANCH':
        graph.addNode(nodeName, createBranchNode(step));
        break;
      case 'MERGE':
        graph.addNode(nodeName, createMergeNode(step));
        break;
      case 'ITERATOR':
        graph.addNode(nodeName, createIteratorNode(step));
        break;
      case 'WAIT':
        graph.addNode(nodeName, createWaitNode(step));
        break;
      case 'APP_ACTION':
        graph.addNode(nodeName, createAppActionNode(step));
        break;
      case 'TASK':
        graph.addNode(nodeName, createTaskNode(step));
        break;
      case 'DATA_INPUT':
        graph.addNode(nodeName, createDataInputNode(step));
        break;
      default:
        throw new Error(`Unknown step type: ${(step as WorkflowStep).type}`);
    }
  }

  // Build edges between steps
  if (plan.steps.length === 0) {
    throw new Error('Workflow plan must have at least one step');
  }

  // Special case: single step workflow
  if (plan.steps.length === 1) {
    const step = plan.steps[0];
    const currentNode = `step_${step.id}`;
    // START -> step -> END
    graph.addEdge(START, currentNode);
    graph.addEdge(currentNode, END);
    return { graph, interruptNodes };
  }

  // Multiple steps: build sequential connections
  // Connect START to first step
  graph.addEdge(START, `step_${plan.steps[0].id}`);

  // Build edges for each step
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const currentNode = `step_${step.id}`;

    // Connect step to next step or END
    if (step.type === 'BRANCH' && step.config.paths) {
      // Conditional edges for branches - handled by branch node
      // The branch node will return the next step ID
      // For now, we'll add a default edge and let the branch node handle routing
      if (step.config.paths.length > 0) {
        const defaultPath = step.config.paths.find((p) => !p.condition) || step.config.paths[0];
        if (defaultPath && stepNodes.has(defaultPath.nextStepId)) {
          graph.addEdge(currentNode, `step_${defaultPath.nextStepId}`);
        } else {
          graph.addEdge(currentNode, END);
        }
      } else {
        graph.addEdge(currentNode, END);
      }
    } else if (step.next && step.next.length > 0) {
      // Multiple next steps (for merge inputs)
      let hasValidNext = false;
      for (const nextStepId of step.next) {
        if (stepNodes.has(nextStepId)) {
          graph.addEdge(currentNode, `step_${nextStepId}`);
          hasValidNext = true;
        }
      }
      // If no valid next steps found, connect to END
      if (!hasValidNext) {
        graph.addEdge(currentNode, END);
      }
    } else if (step.next && step.next.length === 1) {
      // Single next step
      const nextStepId = step.next[0];
      if (stepNodes.has(nextStepId)) {
        graph.addEdge(currentNode, `step_${nextStepId}`);
      } else {
        graph.addEdge(currentNode, END);
      }
    } else {
      // No next step - end of workflow (or last step in sequence)
      // Only add END edge if this is the last step or has no next
      if (i === plan.steps.length - 1 || !step.next) {
        graph.addEdge(currentNode, END);
      }
    }
  }

  return { graph, interruptNodes };
}
