/**
 * Node Types Configuration for React Flow
 * Defined in separate file to ensure stable reference
 */

import { NodeTypes } from 'reactflow';
import { SkillNode } from './nodes/SkillNode';
import { BranchNode } from './nodes/BranchNode';
import { MergeNode } from './nodes/MergeNode';
import { IteratorNode } from './nodes/IteratorNode';
import { WaitNode } from './nodes/WaitNode';
import { AppActionNode } from './nodes/AppActionNode';
import { TaskNode } from './nodes/TaskNode';
import { DataInputNode } from './nodes/DataInputNode';

// Export as a const to ensure stable reference
// React Flow may show warnings during Fast Refresh in development,
// but this won't affect production builds
export const workflowNodeTypes: NodeTypes = {
  SKILL: SkillNode,
  BRANCH: BranchNode,
  MERGE: MergeNode,
  ITERATOR: IteratorNode,
  WAIT: WaitNode,
  APP_ACTION: AppActionNode,
  TASK: TaskNode,
  DATA_INPUT: DataInputNode,
} as const;
