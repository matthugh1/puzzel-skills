# Relay.app-Style Enhancement: Comprehensive Epics and Stories

This document breaks down the relay.app-style enhancement plan into detailed Epics and User Stories, each tagged with appropriate implementation skills. The plan incorporates **LangGraph** as the workflow execution framework for advanced state management, cycles, and human-in-the-loop capabilities.

## Document Structure

Each story includes:
- **Description**: User story format (As a [user], I need [feature] so that [benefit])
- **Skills to Use**: References to implementation skills from `.cursor/skills/` directory
- **Acceptance Criteria**: Checklist of requirements
- **Technical Details**: Implementation patterns, code examples, schemas, and architecture decisions

**Note**: Stories marked with extensive technical details include:
- Code examples and implementation patterns
- Database schema definitions
- API request/response examples
- LangGraph-specific implementation details
- Security considerations
- Error handling patterns

## Architecture Overview: LangGraph Integration

**LangGraph Benefits for Our Use Case:**
- **State Management**: Persistent workflow state with checkpoints
- **Cycles & Branches**: Native support for conditional paths and loops
- **Human-in-the-Loop**: Built-in interrupt mechanism for approvals/tasks
- **Durable Execution**: Pause/resume workflows automatically
- **Streaming**: Real-time step execution updates
- **Subgraphs**: Modular workflow composition
- **Observability**: Integration with LangSmith for tracing

**Integration Strategy:**
- Replace current sequential execution engine with LangGraph state machine
- Maintain backward compatibility with existing AgentRun model
- Use LangGraph's state persistence to store workflow state in database
- Leverage interrupts for approvals, tasks, and data input requests

---

## Epic 1: Workflow System Foundation

**Goal**: Convert one-time agent runs into reusable workflows/playbooks with LangGraph execution

### Story 1.1: Create Workflow Database Models
**Description**: As a developer, I need Prisma schema for Workflow model so that reusable playbooks can be stored and versioned.

**Skills to Use**:
- `repo-discovery-and-constraints` - Understand constraints before starting
- `prisma-model-addition` - Add Workflow model following conventions
- `database-schema-development` - Follow Prisma schema conventions

**Acceptance Criteria**:
- [ ] Workflow model added to schema with all required fields
- [ ] WorkflowTrigger model added (for Phase 2)
- [ ] AgentRun model updated with `workflowId` (nullable)
- [ ] Relations properly defined (Workflow → AgentRun, Workflow → User)
- [ ] Indexes added for frequently queried fields (status, ownerId, category)
- [ ] Schema validated (`npx prisma validate`)
- [ ] No modifications to Skill or SkillVersion models

**Technical Details**:

**Prisma Schema Definition**:
```prisma
enum WorkflowStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum WorkflowVisibility {
  TEAM
  ORG
}

model Workflow {
  id          String            @id @default(cuid())
  name        String
  description String?
  category    String?
  tags        String[]           @default([])
  plan        Json               // Workflow step definition (LangGraph-compatible)
  status      WorkflowStatus     @default(DRAFT)
  visibility  WorkflowVisibility @default(ORG)
  
  ownerId     String
  owner       User               @relation("WorkflowOwner", fields: [ownerId], references: [id])
  
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  
  runs        AgentRun[]
  triggers    WorkflowTrigger[]
  
  @@index([ownerId])
  @@index([status])
  @@index([category])
  @@index([visibility])
  @@map("workflows")
}
```

**Plan JSON Structure** (LangGraph-compatible):
```typescript
interface WorkflowPlan {
  steps: WorkflowStep[];
  metadata?: {
    version: string;
    description?: string;
  };
}

interface WorkflowStep {
  id: string;
  type: 'SKILL' | 'BRANCH' | 'MERGE' | 'ITERATOR' | 'WAIT' | 'APP_ACTION' | 'TASK' | 'DATA_INPUT';
  config: StepConfig;
  next?: string[]; // Array of next step IDs (for branches, multiple paths)
}

interface StepConfig {
  // SKILL step
  skillId?: string;
  skillVersionId?: string;
  inputs?: Record<string, unknown>;
  
  // BRANCH step
  condition?: BranchCondition;
  paths?: BranchPath[];
  
  // MERGE step
  strategy?: 'all' | 'first';
  
  // ITERATOR step
  arraySource?: string; // JSONPath to array in context
  itemVariable?: string; // Variable name for current item
  childSteps?: WorkflowStep[];
  
  // WAIT step
  waitType?: 'duration' | 'until' | 'condition' | 'webhook';
  duration?: number; // seconds
  until?: string; // ISO datetime
  condition?: string; // JSONPath expression
  timeout?: number; // seconds
  
  // APP_ACTION step
  appName?: string;
  actionName?: string;
  actionInputs?: Record<string, unknown>;
  
  // TASK step
  taskTitle?: string;
  taskDescription?: string;
  assignee?: string; // userId or role
  
  // DATA_INPUT step
  inputTitle?: string;
  inputDescription?: string;
  inputSchema?: JsonSchema;
  requestedFrom?: string; // userId
}
```

**Migration Considerations**:
- Add `workflowId` to `AgentRun` as nullable foreign key
- Create indexes on frequently queried fields
- Ensure backward compatibility (existing runs without workflowId work)

---

### Story 1.2: Generate Workflow Migration
**Description**: As a developer, I need database migration for Workflow models so that the schema matches the code.

**Skills to Use**:
- `db-migration-and-seed-update` - Generate migration and update seed script

**Acceptance Criteria**:
- [ ] Migration generated (`npx prisma migrate dev --name add_workflow_models`)
- [ ] Migration SQL verified (no unexpected DROP/ALTER on prohibited tables)
- [ ] Migration applies successfully
- [ ] Seed script updated with sample workflow (optional)

**Constraints**:
- Migration must not modify Skill or SkillVersion tables
- Must be backward compatible (existing AgentRun records work)

---

### Story 1.3: Create Workflow CRUD API Endpoints
**Description**: As a user, I need API endpoints to create, read, update, and delete workflows.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API routes following patterns
- `api-route-development` - Follow standard API route patterns
- `permission-and-rbac-extension` - Add workflow permissions

**Acceptance Criteria**:
- [ ] `POST /api/workflows` - Create workflow (requires `workflows:create`)
- [ ] `GET /api/workflows` - List workflows (filtered by visibility/permissions)
- [ ] `GET /api/workflows/:id` - Get workflow details
- [ ] `PUT /api/workflows/:id` - Update workflow (requires ownership or `workflows:update`)
- [ ] `DELETE /api/workflows/:id` - Archive workflow (soft delete)
- [ ] All routes follow security pattern (CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response)
- [ ] Input validation with Zod schemas
- [ ] Audit logging for create/update/delete operations

**Permissions to Add**:
- `workflows:create`, `workflows:read`, `workflows:update`, `workflows:delete`

**API Request/Response Examples**:

**POST /api/workflows** (Create):
```typescript
// Request
{
  "name": "Customer Onboarding",
  "description": "Automated customer onboarding workflow",
  "category": "onboarding",
  "tags": ["customer", "automation"],
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "type": "SKILL",
        "config": {
          "skillId": "skill_abc123",
          "skillVersionId": "version_xyz789",
          "inputs": {
            "customerEmail": "$context.email"
          }
        },
        "next": ["step_2"]
      }
    ]
  },
  "visibility": "ORG"
}

// Response (201 Created)
{
  "workflow": {
    "id": "wf_abc123",
    "name": "Customer Onboarding",
    "status": "DRAFT",
    "ownerId": "user_123",
    "createdAt": "2026-02-01T10:00:00Z"
  }
}
```

**GET /api/workflows** (List):
```typescript
// Query params: ?status=PUBLISHED&category=onboarding&search=customer
// Response (200 OK)
{
  "workflows": [
    {
      "id": "wf_abc123",
      "name": "Customer Onboarding",
      "description": "Automated customer onboarding workflow",
      "status": "PUBLISHED",
      "category": "onboarding",
      "tags": ["customer", "automation"],
      "owner": {
        "id": "user_123",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "runCount": 42,
      "successRate": 0.95,
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

**Zod Validation Schema**:
```typescript
import { z } from 'zod';

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).max(20).default([]),
  plan: z.object({
    steps: z.array(workflowStepSchema).min(1),
    metadata: z.object({
      version: z.string().optional(),
      description: z.string().optional(),
    }).optional(),
  }),
  visibility: z.enum(['TEAM', 'ORG']).default('ORG'),
});

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['SKILL', 'BRANCH', 'MERGE', 'ITERATOR', 'WAIT', 'APP_ACTION', 'TASK', 'DATA_INPUT']),
  config: z.record(z.unknown()),
  next: z.array(z.string()).optional(),
});
```

---

### Story 1.4: Create Workflow Execution API Endpoint
**Description**: As a user, I need to execute a workflow which creates an AgentRun and triggers LangGraph execution.

**Skills to Use**:
- `nextjs-api-route-builder` - Create execution endpoint
- `runtime-module-builder` - Create LangGraph workflow executor

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/run` - Execute workflow
- [ ] Validates workflow is PUBLISHED
- [ ] Creates AgentRun with `workflowId` set
- [ ] Maps workflow `plan` to AgentRun `plan`
- [ ] Initializes LangGraph state machine
- [ ] Triggers async execution
- [ ] Returns run ID immediately (202 Accepted)
- [ ] Logs audit event

**Technical Details**:

**Workflow Execution Implementation** (`src/app/api/workflows/[id]/run/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { validateCSRFToken } from '@/lib/csrf';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateRequestBody, validationSchemas } from '@/lib/validation';
import { audit } from '@/lib/audit';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  // Authentication & Authorization
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const workflowId = params.id;

    // Load workflow
    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      );
    }

    // Check workflow is published
    if (workflow.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Workflow is not published' },
        { status: 400 }
      );
    }

    // Check visibility permissions
    if (workflow.visibility === 'TEAM' && workflow.ownerId !== user.id) {
      // Check if user is in same team (simplified - would check team membership)
      return NextResponse.json(
        { error: 'Workflow not accessible' },
        { status: 403 }
      );
    }

    // Validate input
    const body = await validateRequestBody(request, validationSchemas.runWorkflow);
    const { initialContext, policyId, inputAllowlist, idempotencyKey } = body;

    // Load policy if provided
    let policy = null;
    if (policyId) {
      policy = await db.runPolicy.findUnique({
        where: { id: policyId },
      });
      if (!policy) {
        return NextResponse.json(
          { error: 'Policy not found' },
          { status: 404 }
        );
      }
    }

    // Validate initialContext size
    const initialContextSize = JSON.stringify(initialContext).length;
    const maxSize = policy?.maxInitialContextBytes ?? 100000;
    if (initialContextSize > maxSize) {
      return NextResponse.json(
        { error: `Initial context size (${initialContextSize} bytes) exceeds policy limit (${maxSize} bytes)` },
        { status: 400 }
      );
    }

    // Create AgentRun with workflow's plan
    const run = await db.agentRun.create({
      data: {
        workflowId: workflow.id,
        userId: user.id,
        goal: workflow.name, // Use workflow name as goal
        initialContext,
        policyId: policy?.id ?? null,
        inputAllowlist: inputAllowlist || null,
        status: 'RUNNING', // Skip planning - use workflow's plan
        plan: workflow.plan, // Use workflow's predefined plan
        idempotencyKey: idempotencyKey || null,
        startedAt: new Date(),
      },
      include: {
        workflow: {
          select: { id: true, name: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Log audit event
    await audit.agentRunCreated(run.id, user.id, {
      goal: run.goal,
      workflowId: workflow.id,
      policyId: run.policyId,
    }, request);

    // Trigger LangGraph execution (async)
    executeWorkflow(run.id).catch((error) => {
      console.error('Workflow execution error:', error);
      // Update run status to FAILED
      db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      }).catch(console.error);
    });

    // Return immediately (202 Accepted for async operations)
    return NextResponse.json(
      { run: { id: run.id, status: run.status } },
      { status: 202 }
    );
  } catch (error) {
    console.error('Run workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to run workflow' },
      { status: 500 }
    );
  }
}
```

**LangGraph Executor** (`src/lib/runtime/langgraph/executor.ts`):
```typescript
import { buildWorkflowGraph } from './graph-builder';
import { DatabaseCheckpointAdapter, loadStateFromRun } from './state';
import { db } from '@/lib/db';
import { acquireLease, releaseLease } from '../../lease-manager';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

export async function executeWorkflow(runId: string): Promise<void> {
  // Acquire lease
  const leaseAcquired = await acquireLease(runId, WORKER_ID, 300);
  if (!leaseAcquired) {
    throw new Error('Could not acquire run lease');
  }

  try {
    // Load run
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      include: { workflow: true },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Check cancellation
    if (run.status === 'CANCELLED') {
      return;
    }

    // Load state from run
    const initialState = loadStateFromRun(run);

    // Build LangGraph workflow
    const graph = buildWorkflowGraph(run.plan as WorkflowPlan);

    // Configure checkpoint adapter
    const checkpointAdapter = new DatabaseCheckpointAdapter();

    // Compile graph with checkpointing
    const compiledGraph = graph.compile({
      checkpointer: checkpointAdapter,
      interruptBefore: ['wait', 'task', 'data_input', 'approval'], // Interrupt before human-in-the-loop steps
    });

    // Execute workflow
    const config = {
      configurable: {
        checkpoint_id: runId, // Use runId as checkpoint ID
      },
    };

    // Stream execution (for real-time updates)
    const stream = await compiledGraph.stream(initialState, config);

    for await (const event of stream) {
      // Update database with state changes
      await syncStateToDatabase(runId, event);
    }
  } finally {
    // Release lease
    await releaseLease(runId, WORKER_ID);
  }
}

async function syncStateToDatabase(
  runId: string,
  event: { [key: string]: unknown }
): Promise<void> {
  // Extract state from event
  const state = event[Object.keys(event)[0]] as WorkflowStateType;

  // Update AgentRun
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: state.status,
      currentStepIndex: state.currentStepIndex,
      metadata: {
        ...state.metadata,
        langgraphState: state,
      },
    },
  });
}
```

---

### Story 1.5: Build Workflow List UI Page
**Description**: As a user, I need a page to browse, search, and filter workflows.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page
- `ui-component-development` - Follow Puzzel Nordic Design System

**Acceptance Criteria**:
- [ ] Page at `/workflows` follows layout pattern
- [ ] Uses design system rules (white background, dark text, CSS variables)
- [ ] Fetches workflows from API
- [ ] Displays workflow name, description, status, owner
- [ ] Search and filter functionality (by category, tags, status)
- [ ] Links to workflow detail and editor pages
- [ ] "Create Workflow" button
- [ ] Handles loading and error states

---

### Story 1.6: Build Workflow Detail UI Page
**Description**: As a user, I need a page to view workflow definition, run history, and activity.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id` follows layout pattern
- [ ] Displays workflow metadata (name, description, status, owner)
- [ ] Shows workflow plan structure (read-only view)
- [ ] Lists recent runs (last 10)
- [ ] Shows run statistics (success rate, avg duration)
- [ ] "Edit" button (if user has permission)
- [ ] "Run" button to execute workflow
- [ ] Handles loading and error states

---

### Story 1.7: Build Basic Workflow Editor UI
**Description**: As a user, I need a basic workflow editor to create and edit workflow definitions (MVP: JSON editor).

**Skills to Use**:
- `ui-page-builder` - Create editor page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/edit` follows layout pattern
- [ ] JSON editor for workflow plan (using Monaco Editor or similar)
- [ ] Form for workflow metadata (name, description, category, tags)
- [ ] Real-time JSON validation
- [ ] Save draft functionality
- [ ] Publish workflow button (changes status to PUBLISHED)
- [ ] Preview workflow structure
- [ ] Handles loading and error states

**Note**: Visual drag-and-drop builder comes in Phase 5

---

## Epic 2: LangGraph Execution Engine Integration

**Goal**: Replace sequential execution engine with LangGraph state machine for advanced workflow capabilities

### Story 2.1: Install and Configure LangGraph
**Description**: As a developer, I need LangGraph installed and configured so that we can use it for workflow execution.

**Skills to Use**:
- `repo-discovery-and-constraints` - Understand current execution engine

**Acceptance Criteria**:
- [ ] `@langchain/langgraph` package installed
- [ ] LangGraph configuration file created
- [ ] State schema defined matching AgentRun structure
- [ ] Checkpoint configuration for persistence
- [ ] Integration with existing database models

**Technical Details**:

**Package Installation**:
```bash
pnpm add @langchain/langgraph @langchain/core
```

**LangGraph Configuration** (`src/lib/runtime/langgraph/config.ts`):
```typescript
import { StateGraph, END, START } from '@langchain/langgraph';
import type { Checkpoint } from '@langchain/langgraph';

// State schema matching AgentRun structure
export interface WorkflowState {
  runId: string;
  status: 'PLANNING' | 'RUNNING' | 'BLOCKED' | 'COMPLETE' | 'FAILED' | 'CANCELLED';
  goal: string;
  initialContext: Record<string, unknown>;
  plan: WorkflowPlan;
  currentStepIndex: number;
  steps: StepState[];
  artefacts: ArtefactState[];
  context: Record<string, unknown>; // Accumulated context from steps
  metadata?: Record<string, unknown>;
}

interface StepState {
  stepId: string;
  stepIndex: number;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputContext: Record<string, unknown>;
  outputContext?: Record<string, unknown>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface ArtefactState {
  id: string;
  stepId: string;
  type: string;
  content: Record<string, unknown>;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Checkpoint configuration
export interface CheckpointConfig {
  checkpointNamespace: string;
  checkpointId: string;
}

// State reducer (for updating state immutably)
export function reducer(state: WorkflowState, update: Partial<WorkflowState>): WorkflowState {
  return { ...state, ...update };
}
```

**Checkpoint Storage Strategy**:
- Option 1: Store in `AgentRun.metadata` JSON field (simpler, less queryable)
- Option 2: Create `WorkflowCheckpoint` table (better for querying, cleanup)
- Recommendation: Start with Option 1, migrate to Option 2 if needed

**Checkpoint Table Schema** (if using Option 2):
```prisma
model WorkflowCheckpoint {
  id          String   @id @default(cuid())
  runId       String
  run         AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  checkpoint  Json     // Full LangGraph checkpoint data
  stepIndex   Int      // Step index when checkpoint created
  createdAt   DateTime @default(now())
  
  @@index([runId])
  @@index([createdAt])
  @@map("workflow_checkpoints")
}
```

---

### Story 2.2: Create LangGraph State Schema
**Description**: As a developer, I need a LangGraph state schema that maps to our AgentRun model.

**Skills to Use**:
- `runtime-module-builder` - Create LangGraph state module

**Acceptance Criteria**:
- [ ] State schema defined with all AgentRun fields
- [ ] Typed state interface for TypeScript
- [ ] State reducer functions for updating state
- [ ] State persistence adapter (saves to database)
- [ ] State loading adapter (loads from database)

**Technical Details**:

**State Schema Implementation** (`src/lib/runtime/langgraph/state.ts`):
```typescript
import { Annotation } from '@langchain/langgraph';
import type { WorkflowState } from './config';

// Define state annotation for LangGraph
export const workflowStateAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  status: Annotation<'PLANNING' | 'RUNNING' | 'BLOCKED' | 'COMPLETE' | 'FAILED' | 'CANCELLED'>(),
  goal: Annotation<string>(),
  initialContext: Annotation<Record<string, unknown>>(),
  plan: Annotation<Record<string, unknown>>(), // WorkflowPlan
  currentStepIndex: Annotation<number>(),
  steps: Annotation<Array<Record<string, unknown>>>(),
  artefacts: Annotation<Array<Record<string, unknown>>>(),
  context: Annotation<Record<string, unknown>>(), // Accumulated context
  metadata: Annotation<Record<string, unknown>>().optional(),
});

export type WorkflowStateType = typeof workflowStateAnnotation.State;

// State persistence adapter
export class DatabaseCheckpointAdapter implements CheckpointAdapter {
  async save(state: WorkflowStateType, checkpointId: string): Promise<void> {
    await db.agentRun.update({
      where: { id: state.runId },
      data: {
        status: state.status,
        currentStepIndex: state.currentStepIndex,
        plan: state.plan,
        metadata: {
          ...state.metadata,
          langgraphState: state, // Store full state in metadata
          checkpointId,
        },
      },
    });
  }

  async load(runId: string): Promise<WorkflowStateType | null> {
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      select: { metadata: true, status: true, currentStepIndex: true, plan: true },
    });
    
    if (!run?.metadata?.langgraphState) {
      return null;
    }
    
    return run.metadata.langgraphState as WorkflowStateType;
  }
}

// State loading adapter (initializes state from AgentRun)
export function loadStateFromRun(run: AgentRun): WorkflowStateType {
  return {
    runId: run.id,
    status: run.status,
    goal: run.goal,
    initialContext: run.initialContext as Record<string, unknown>,
    plan: run.plan as WorkflowPlan,
    currentStepIndex: run.currentStepIndex,
    steps: [], // Loaded separately
    artefacts: [], // Loaded separately
    context: run.initialContext as Record<string, unknown>,
    metadata: run.metadata as Record<string, unknown> | undefined,
  };
}
```

**State Update Pattern**:
- State updates are immutable (LangGraph requirement)
- Each node returns partial state update
- LangGraph merges updates using reducer function
- Database sync happens at checkpoint points

---

### Story 2.3: Build LangGraph Workflow Graph Builder
**Description**: As a developer, I need a function to convert workflow plan JSON into LangGraph state machine.

**Skills to Use**:
- `runtime-module-builder` - Create graph builder module

**Acceptance Criteria**:
- [ ] Function converts workflow plan to LangGraph graph
- [ ] Handles SKILL step types (maps to existing skill execution)
- [ ] Handles BRANCH step types (conditional routing)
- [ ] Handles MERGE step types (path convergence)
- [ ] Handles ITERATOR step types (loop execution)
- [ ] Handles WAIT step types (pause execution)
- [ ] Handles APP_ACTION step types (external integrations)
- [ ] Graph validation (no cycles unless intentional)

**Technical Details**:

**Graph Builder Implementation** (`src/lib/runtime/langgraph/graph-builder.ts`):
```typescript
import { StateGraph, END, START } from '@langchain/langgraph';
import { workflowStateAnnotation } from './state';
import type { WorkflowPlan, WorkflowStep } from '../types';

export function buildWorkflowGraph(plan: WorkflowPlan): StateGraph {
  const graph = new StateGraph(workflowStateAnnotation);
  
  // Build nodes for each step
  const stepNodes = new Map<string, string>(); // stepId -> nodeName
  
  for (const step of plan.steps) {
    const nodeName = `step_${step.id}`;
    stepNodes.set(step.id, nodeName);
    
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
    }
  }
  
  // Build edges between steps
  graph.addEdge(START, `step_${plan.steps[0].id}`); // Start from first step
  
  for (const step of plan.steps) {
    const currentNode = `step_${step.id}`;
    
    if (step.type === 'BRANCH' && step.config.paths) {
      // Conditional edges for branches
      for (let i = 0; i < step.config.paths.length; i++) {
        const path = step.config.paths[i];
        const conditionFn = createConditionFunction(step.config.condition, i);
        graph.addConditionalEdges(
          currentNode,
          conditionFn,
          {
            [path.nextStepId]: `step_${path.nextStepId}`,
            default: END, // Fallback if no condition matches
          }
        );
      }
    } else if (step.next && step.next.length > 0) {
      // Multiple next steps (for merge inputs)
      for (const nextStepId of step.next) {
        graph.addEdge(currentNode, `step_${nextStepId}`);
      }
    } else if (step.next && step.next.length === 1) {
      // Single next step
      graph.addEdge(currentNode, `step_${step.next[0]}`);
    } else {
      // No next step - end of workflow
      graph.addEdge(currentNode, END);
    }
  }
  
  // Set entry point
  graph.setEntryPoint(START);
  
  return graph;
}

// Condition function for branches
function createConditionFunction(
  condition: BranchCondition | undefined,
  pathIndex: number
): (state: WorkflowStateType) => string {
  return (state: WorkflowStateType) => {
    if (!condition) {
      return 'default';
    }
    
    // Evaluate condition based on type
    switch (condition.type) {
      case 'equals':
        return evaluateEquals(condition, state) ? `path_${pathIndex}` : 'default';
      case 'contains':
        return evaluateContains(condition, state) ? `path_${pathIndex}` : 'default';
      case 'ai':
        // AI-based evaluation (async, handled separately)
        return 'default'; // Placeholder
      case 'manual':
        // Manual selection (uses interrupt)
        return 'default'; // Placeholder
      default:
        return 'default';
    }
  };
}
```

**Graph Validation**:
- Check for cycles (unless intentional loops)
- Validate all step IDs referenced in `next` exist
- Ensure at least one path leads to END
- Validate branch paths have conditions or are marked as default

---

### Story 2.4: Implement Skill Step Node in LangGraph
**Description**: As a system, I need skill steps to execute within LangGraph workflow.

**Skills to Use**:
- `runtime-module-builder` - Create skill step node

**Acceptance Criteria**:
- [ ] Skill step node executes skill via MCP handler
- [ ] Uses existing context resolver for input resolution
- [ ] Uses existing interpreter for output processing
- [ ] Creates RunStep record in database
- [ ] Creates RunArtefact records
- [ ] Updates state with step output
- [ ] Handles errors and retries
- [ ] Respects policy validation

**Technical Details**:

**Skill Step Node Implementation** (`src/lib/runtime/langgraph/nodes/skill-node.ts`):
```typescript
import type { WorkflowStateType } from '../state';
import { resolveContext } from '../../context-resolver';
import { interpretOutput } from '../../interpreter';
import { validateStep } from '../../policy-validator';
import { handleCallTool } from '@/app/api/mcp/handlers/call';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

export function createSkillNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { skillId, skillVersionId, inputs } = step.config;
    
    if (!skillId || !skillVersionId) {
      throw new Error('Skill step missing skillId or skillVersionId');
    }
    
    // Load skill and version
    const skill = await db.skill.findUnique({
      where: { id: skillId },
      include: { metadata: true },
    });
    
    const skillVersion = await db.skillVersion.findUnique({
      where: { id: skillVersionId },
    });
    
    if (!skill || !skillVersion) {
      return {
        status: 'FAILED',
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'FAILED',
            inputContext: inputs || {},
            errorMessage: 'Skill or version not found',
            completedAt: new Date(),
          },
        ],
      };
    }
    
    // Resolve input context
    const resolvedInputs = resolveContext(
      inputs || {},
      state.initialContext,
      state.steps.map(s => ({
        stepIndex: s.stepIndex,
        outputContext: s.outputContext,
      }))
    );
    
    // Validate step against policy (if policy exists)
    // ... policy validation logic ...
    
    // Create step record
    const runStep = await db.runStep.create({
      data: {
        runId: state.runId,
        stepIndex: state.currentStepIndex,
        skillId: skill.id,
        skillVersionId: skillVersion.id,
        skillVersionContentHash: createHash('sha256')
          .update(skillVersion.content)
          .digest('hex'),
        status: 'RUNNING',
        inputContext: resolvedInputs,
        startedAt: new Date(),
      },
    });
    
    try {
      // Execute skill via MCP handler
      const skillName = skill.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      const mockRequest = new Request('http://localhost/api/mcp', {
        method: 'POST',
        body: JSON.stringify({
          method: 'tools/call',
          name: skillName,
          arguments: resolvedInputs,
        }),
      });
      
      const run = await db.agentRun.findUnique({
        where: { id: state.runId },
        select: { userId: true },
      });
      
      const mcpResponse = await handleCallTool(
        { name: skillName, arguments: resolvedInputs },
        run!.userId,
        mockRequest
      );
      
      const mcpData = await mcpResponse.json();
      const rawOutput = mcpData.content?.[0]?.text || '';
      
      // Interpret output
      const interpretation = interpretOutput(rawOutput, skill.metadata);
      
      if ('error' in interpretation) {
        await db.runStep.update({
          where: { id: runStep.id },
          data: {
            status: 'FAILED',
            errorMessage: interpretation.error.message,
            completedAt: new Date(),
          },
        });
        
        return {
          steps: [
            ...state.steps,
            {
              stepId: step.id,
              stepIndex: state.currentStepIndex,
              type: 'SKILL',
              status: 'FAILED',
              inputContext: resolvedInputs,
              outputContext: undefined,
              errorMessage: interpretation.error.message,
              completedAt: new Date(),
            },
          ],
        };
      }
      
      const { output } = interpretation;
      
      // Create artefact
      const artefact = await db.runArtefact.create({
        data: {
          stepId: runStep.id,
          runId: state.runId,
          type: output.artefactType,
          content: output.data || { raw: output.raw },
          sensitivity: output.sensitivity,
        },
      });
      
      // Update step
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'SUCCESS',
          outputContext: {
            raw: output.raw,
            data: output.data,
            artefactRefs: [`artefact-${artefact.id}`],
          },
          completedAt: new Date(),
        },
      });
      
      // Update state
      return {
        currentStepIndex: state.currentStepIndex + 1,
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'SUCCESS',
            inputContext: resolvedInputs,
            outputContext: {
              raw: output.raw,
              data: output.data,
            },
            completedAt: new Date(),
          },
        ],
        artefacts: [
          ...state.artefacts,
          {
            id: artefact.id,
            stepId: runStep.id,
            type: output.artefactType,
            content: output.data || { raw: output.raw },
            sensitivity: output.sensitivity,
          },
        ],
        context: {
          ...state.context,
          [`step_${state.currentStepIndex}_output`]: output.data || { raw: output.raw },
        },
      };
    } catch (error) {
      await db.runStep.update({
        where: { id: runStep.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      });
      
      return {
        status: 'FAILED',
        steps: [
          ...state.steps,
          {
            stepId: step.id,
            stepIndex: state.currentStepIndex,
            type: 'SKILL',
            status: 'FAILED',
            inputContext: resolvedInputs,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          },
        ],
      };
    }
  };
}
```

**Error Handling Pattern**:
- Errors caught in try/catch
- Step marked as FAILED in database
- State updated with error information
- Workflow can continue or fail based on configuration

---

### Story 2.5: Implement Branch Step Node in LangGraph
**Description**: As a system, I need branch steps to route workflow execution based on conditions.

**Skills to Use**:
- `runtime-module-builder` - Create branch evaluator node

**Acceptance Criteria**:
- [ ] Branch node evaluates conditions
- [ ] Supports condition types: `if/else`, `switch`, `AI-based`, `manual`
- [ ] Condition evaluation uses context data
- [ ] Routes to correct path based on evaluation
- [ ] Creates RunPath record for tracking
- [ ] Supports AI-based path selection (LLM chooses path)
- [ ] Supports manual path selection (human chooses - uses interrupt)

**Technical Details**:

**Branch Condition Types**:
```typescript
interface BranchCondition {
  type: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'matches' | 'ai' | 'manual';
  field: string; // JSONPath to field in context
  value?: unknown; // Comparison value (not needed for AI/manual)
  operator?: 'and' | 'or'; // For multiple conditions
  conditions?: BranchCondition[]; // Nested conditions
}

interface BranchPath {
  id: string;
  label: string;
  condition?: BranchCondition; // If undefined, this is the default path
  nextStepId: string;
}
```

**Branch Node Implementation** (`src/lib/runtime/langgraph/nodes/branch-node.ts`):
```typescript
import type { WorkflowStateType } from '../state';
import { db } from '@/lib/db';
import { JSONPath } from 'jsonpath-plus'; // or similar library

export function createBranchNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { condition, paths } = step.config;
    
    if (!paths || paths.length === 0) {
      throw new Error('Branch step missing paths');
    }
    
    let selectedPath: BranchPath | null = null;
    
    // Evaluate conditions based on type
    if (condition?.type === 'ai') {
      // AI-based path selection
      selectedPath = await evaluateAIPathSelection(condition, paths, state);
    } else if (condition?.type === 'manual') {
      // Manual path selection - use interrupt
      selectedPath = await requestManualPathSelection(step.id, paths, state);
    } else {
      // Evaluate conditions
      for (const path of paths) {
        if (!path.condition) {
          // Default path (no condition)
          selectedPath = path;
          break;
        }
        
        if (evaluateCondition(path.condition, state)) {
          selectedPath = path;
          break;
        }
      }
    }
    
    if (!selectedPath) {
      // No path matched - use default or fail
      selectedPath = paths.find(p => !p.condition) || paths[0];
    }
    
    // Create RunPath record
    await db.runPath.create({
      data: {
        runId: state.runId,
        stepId: step.id,
        pathIndex: paths.indexOf(selectedPath),
        selectedAt: new Date(),
        selectionType: condition?.type === 'manual' ? 'MANUAL' : 
                       condition?.type === 'ai' ? 'AI' : 'AUTOMATIC',
      },
    });
    
    // Update state - LangGraph will route to selected path
    return {
      context: {
        ...state.context,
        [`branch_${step.id}_selected`]: selectedPath.id,
      },
    };
  };
}

function evaluateCondition(
  condition: BranchCondition,
  state: WorkflowStateType
): boolean {
  const fieldValue = JSONPath({ path: condition.field, json: state.context });
  
  switch (condition.type) {
    case 'equals':
      return fieldValue === condition.value;
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'greaterThan':
      return Number(fieldValue) > Number(condition.value);
    case 'lessThan':
      return Number(fieldValue) < Number(condition.value);
    case 'matches':
      return new RegExp(String(condition.value)).test(String(fieldValue));
    default:
      return false;
  }
}

async function evaluateAIPathSelection(
  condition: BranchCondition,
  paths: BranchPath[],
  state: WorkflowStateType
): Promise<BranchPath> {
  // Call LLM to choose path
  const prompt = `Given the workflow context, choose the appropriate path:
  
Context: ${JSON.stringify(state.context, null, 2)}

Available paths:
${paths.map((p, i) => `${i}: ${p.label}`).join('\n')}

Respond with just the path number (0-${paths.length - 1}).`;
  
  // Call LLM (using existing LLM integration)
  const response = await callLLM(prompt);
  const pathIndex = parseInt(response.trim(), 10);
  
  return paths[pathIndex] || paths[0];
}

async function requestManualPathSelection(
  stepId: string,
  paths: BranchPath[],
  state: WorkflowStateType
): Promise<BranchPath> {
  // Create interrupt for manual selection
  // This pauses workflow execution
  await db.runPath.create({
    data: {
      runId: state.runId,
      stepId: stepId,
      pathIndex: -1, // Pending
      selectionType: 'MANUAL',
    },
  });
  
  // Update run status to BLOCKED
  await db.agentRun.update({
    where: { id: state.runId },
    data: { status: 'BLOCKED' },
  });
  
  // Throw interrupt to pause LangGraph execution
  throw new Interrupt('manual_path_selection', {
    stepId,
    paths: paths.map(p => ({ id: p.id, label: p.label })),
  });
}
```

**Conditional Edge Configuration**:
- LangGraph uses `addConditionalEdges` for branches
- Condition function returns next node name
- Default edge handles unmatched conditions

---

### Story 2.6: Implement Merge Step Node in LangGraph
**Description**: As a system, I need merge steps to combine multiple execution paths back into one.

**Skills to Use**:
- `runtime-module-builder` - Create merge coordinator node

**Acceptance Criteria**:
- [ ] Merge node waits for all incoming paths
- [ ] Supports merge strategies: `all` (wait all), `first` (continue on first)
- [ ] Combines context from merged paths
- [ ] Updates state with merged context
- [ ] Continues execution after merge

**Technical Details**:
- LangGraph join node pattern
- State aggregation logic
- Context merging rules

---

### Story 2.7: Implement Iterator Step Node in LangGraph
**Description**: As a system, I need iterator steps to loop over arrays and execute steps for each item.

**Skills to Use**:
- `runtime-module-builder` - Create iterator executor node

**Acceptance Criteria**:
- [ ] Iterator node extracts array from context
- [ ] Executes child steps for each array item
- [ ] Accumulates results from each iteration
- [ ] Updates context with accumulated results
- [ ] Handles empty arrays gracefully
- [ ] Supports nested iterators

**Technical Details**:
- LangGraph subgraph pattern for iteration
- Loop state management
- Result accumulation logic

---

### Story 2.8: Implement Wait Step Node in LangGraph
**Description**: As a system, I need wait steps to pause workflow execution for time or conditions.

**Skills to Use**:
- `runtime-module-builder` - Create wait manager node

**Acceptance Criteria**:
- [ ] Wait node supports time-based waits (duration, until datetime)
- [ ] Wait node supports condition-based waits (poll until condition met)
- [ ] Wait node supports webhook-based waits (pause until webhook received)
- [ ] State persisted during wait (checkpoint)
- [ ] Workflow resumes automatically after wait condition met
- [ ] Timeout handling (fail if wait exceeds timeout)

**Technical Details**:

**Wait Step Node Implementation** (`src/lib/runtime/langgraph/nodes/wait-node.ts`):
```typescript
import type { WorkflowStateType } from '../state';
import { db } from '@/lib/db';

export function createWaitNode(step: WorkflowStep) {
  return async (state: WorkflowStateType): Promise<Partial<WorkflowStateType>> => {
    const { waitType, duration, until, condition, timeout } = step.config;
    
    // Calculate wait end time
    let waitUntil: Date;
    
    switch (waitType) {
      case 'duration':
        waitUntil = new Date(Date.now() + (duration || 0) * 1000);
        break;
      case 'until':
        waitUntil = new Date(until as string);
        break;
      case 'condition':
        // Poll-based wait - will be handled by background worker
        waitUntil = new Date(Date.now() + (timeout || 3600) * 1000); // Default 1 hour timeout
        break;
      case 'webhook':
        // Webhook-based wait - will be handled by webhook receiver
        waitUntil = new Date(Date.now() + (timeout || 86400) * 1000); // Default 24 hour timeout
        break;
      default:
        throw new Error(`Unknown wait type: ${waitType}`);
    }
    
    // Check if wait condition already met
    if (waitType === 'condition') {
      const conditionMet = await evaluateWaitCondition(condition as string, state);
      if (conditionMet) {
        // Condition already met - continue immediately
        return {};
      }
    }
    
    // Create wait record
    await db.runWait.create({
      data: {
        runId: state.runId,
        stepId: step.id,
        waitType,
        waitUntil,
        condition: condition as string | null,
        status: 'WAITING',
      },
    });
    
    // Update run status to WAITING (if not already)
    await db.agentRun.update({
      where: { id: state.runId },
      data: { status: 'WAITING' },
    });
    
    // Throw interrupt to pause execution
    throw new Interrupt('wait', {
      stepId: step.id,
      waitType,
      waitUntil: waitUntil.toISOString(),
    });
  };
}

async function evaluateWaitCondition(
  condition: string,
  state: WorkflowStateType
): Promise<boolean> {
  // Evaluate JSONPath condition
  // Example: "$.step_0.output.data.status === 'completed'"
  try {
    const result = evaluateExpression(condition, state.context);
    return Boolean(result);
  } catch (error) {
    console.error('Wait condition evaluation error:', error);
    return false;
  }
}
```

**Wait Condition Checker** (`src/lib/workers/wait-checker.ts`):
```typescript
import { db } from '@/lib/db';
import { resumeWorkflow } from '@/lib/runtime/langgraph/executor';

// Run every 30 seconds
export function startWaitChecker(): void {
  setInterval(async () => {
    await checkWaitConditions();
  }, 30000);
}

async function checkWaitConditions(): Promise<void> {
  // Find active waits
  const waits = await db.runWait.findMany({
    where: {
      status: 'WAITING',
      waitUntil: { gte: new Date() }, // Not expired
    },
    include: {
      run: true,
    },
  });

  for (const wait of waits) {
    let shouldResume = false;

    switch (wait.waitType) {
      case 'duration':
      case 'until':
        // Time-based wait - check if time has passed
        if (new Date() >= wait.waitUntil) {
          shouldResume = true;
        }
        break;

      case 'condition':
        // Condition-based wait - evaluate condition
        const run = await db.agentRun.findUnique({
          where: { id: wait.runId },
          include: { steps: true },
        });

        if (run && wait.condition) {
          const conditionMet = await evaluateWaitCondition(wait.condition, run);
          if (conditionMet) {
            shouldResume = true;
          }
        }
        break;

      case 'webhook':
        // Webhook-based wait - check if webhook received
        const webhookReceived = await db.webhookWait.findFirst({
          where: {
            waitId: wait.id,
            received: true,
          },
        });

        if (webhookReceived) {
          shouldResume = true;
        }
        break;
    }

    // Check timeout
    if (new Date() >= wait.waitUntil) {
      // Timeout reached
      await db.runWait.update({
        where: { id: wait.id },
        data: { status: 'TIMEOUT' },
      });

      await db.agentRun.update({
        where: { id: wait.runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });

      continue;
    }

    if (shouldResume) {
      // Resume workflow
      await db.runWait.update({
        where: { id: wait.id },
        data: { status: 'COMPLETE', completedAt: new Date() },
      });

      await resumeWorkflow(wait.runId, wait.stepId);
    }
  }
}
```

**Webhook Wait Resume** (`src/app/api/webhooks/wait/[waitId]/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resumeWorkflow } from '@/lib/runtime/langgraph/executor';

export async function POST(
  request: NextRequest,
  { params }: { params: { waitId: string } }
) {
  const wait = await db.runWait.findUnique({
    where: { id: params.waitId },
    include: { run: true },
  });

  if (!wait || wait.status !== 'WAITING') {
    return NextResponse.json(
      { error: 'Wait not found or not waiting' },
      { status: 404 }
    );
  }

  if (wait.waitType !== 'webhook') {
    return NextResponse.json(
      { error: 'Wait is not webhook-based' },
      { status: 400 }
    );
  }

  // Parse webhook payload
  const payload = await request.json();

  // Store webhook data
  await db.webhookWait.create({
    data: {
      waitId: wait.id,
      payload,
      received: true,
      receivedAt: new Date(),
    },
  });

  // Mark wait as complete
  await db.runWait.update({
    where: { id: wait.id },
    data: { status: 'COMPLETE', completedAt: new Date() },
  });

  // Resume workflow
  await resumeWorkflow(wait.runId, wait.stepId);

  return NextResponse.json({ success: true });
}
```

---

### Story 2.9: Implement LangGraph Checkpoint Persistence
**Description**: As a system, I need LangGraph checkpoints to persist workflow state to database.

**Skills to Use**:
- `runtime-module-builder` - Create checkpoint adapter
- `database-schema-development` - Add checkpoint storage if needed

**Acceptance Criteria**:
- [ ] Checkpoint adapter saves state to database
- [ ] Checkpoint adapter loads state from database
- [ ] Checkpoints created at key points (after each step, before waits)
- [ ] Workflow can resume from checkpoint
- [ ] Checkpoint cleanup (old checkpoints removed)

**Technical Details**:
- Use LangGraph's checkpoint interface
- Store checkpoints in database (new table or extend AgentRun)
- Checkpoint includes full state snapshot

---

### Story 2.10: Implement LangGraph Streaming Updates
**Description**: As a user, I need real-time updates as workflow executes.

**Skills to Use**:
- `runtime-module-builder` - Create streaming adapter
- `api-route-development` - Create streaming endpoint

**Acceptance Criteria**:
- [ ] LangGraph execution streams state updates
- [ ] `GET /api/runs/:id/stream` endpoint streams updates
- [ ] Updates include step completion, status changes
- [ ] Client receives updates via Server-Sent Events (SSE)
- [ ] UI updates in real-time

**Technical Details**:

**Streaming Endpoint Implementation** (`src/app/api/runs/[id]/stream/route.ts`):
```typescript
import { NextRequest } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';
import { createReadableStream } from '@/lib/runtime/langgraph/streaming';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  const runId = params.id;

  // Verify user has access to run
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { userId: true },
  });

  if (!run || (run.userId !== user.id && !user.roles.includes('admin'))) {
    return new Response('Unauthorized', { status: 403 });
  }

  // Create SSE stream
  const stream = createReadableStream(runId);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Streaming Implementation** (`src/lib/runtime/langgraph/streaming.ts`):
```typescript
import { db } from '@/lib/db';

export function createReadableStream(runId: string): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      // Send initial state
      const run = await db.agentRun.findUnique({
        where: { id: runId },
        include: { steps: { orderBy: { stepIndex: 'asc' } } },
      });

      if (run) {
        controller.enqueue(`data: ${JSON.stringify({
          type: 'initial',
          run: {
            id: run.id,
            status: run.status,
            currentStepIndex: run.currentStepIndex,
            steps: run.steps,
          },
        })}\n\n`);
      }

      // Poll for updates
      const interval = setInterval(async () => {
        const updatedRun = await db.agentRun.findUnique({
          where: { id: runId },
          include: {
            steps: {
              orderBy: { stepIndex: 'asc' },
              where: {
                stepIndex: { gte: run?.currentStepIndex || 0 },
              },
            },
          },
        });

        if (updatedRun) {
          // Send step updates
          const newSteps = updatedRun.steps.filter(
            s => !run?.steps.some(rs => rs.id === s.id)
          );

          for (const step of newSteps) {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'step_update',
              step: {
                id: step.id,
                stepIndex: step.stepIndex,
                status: step.status,
                outputContext: step.outputContext,
              },
            })}\n\n`);
          }

          // Send status updates
          if (updatedRun.status !== run?.status) {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'status_update',
              status: updatedRun.status,
            })}\n\n`);
          }

          // Send completion
          if (updatedRun.status === 'COMPLETE' || updatedRun.status === 'FAILED') {
            controller.enqueue(`data: ${JSON.stringify({
              type: 'complete',
              status: updatedRun.status,
            })}\n\n`);
            clearInterval(interval);
            controller.close();
          }
        }
      }, 1000); // Poll every second

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
}
```

**Client-Side Usage**:
```typescript
// React component
useEffect(() => {
  const eventSource = new EventSource(`/api/runs/${runId}/stream`);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'initial':
        setRun(data.run);
        break;
      case 'step_update':
        setSteps(prev => [...prev, data.step]);
        break;
      case 'status_update':
        setStatus(data.status);
        break;
      case 'complete':
        setStatus(data.status);
        eventSource.close();
        break;
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}, [runId]);
```

---

## Epic 3: Trigger System

**Goal**: Enable event-based automation with multiple trigger types

### Story 3.1: Create Trigger Database Models
**Description**: As a developer, I need Prisma schema for WorkflowTrigger and WebhookEndpoint models.

**Skills to Use**:
- `prisma-model-addition` - Add trigger models
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] WorkflowTrigger model added with all fields
- [ ] WebhookEndpoint model added with all fields
- [ ] Relations defined (WorkflowTrigger → Workflow, WebhookEndpoint → Workflow)
- [ ] Indexes added for performance
- [ ] Schema validated

**Model Fields**:
- WorkflowTrigger: `id`, `workflowId`, `triggerType` enum, `config` JSON, `status` enum, `lastTriggeredAt`, `errorMessage`, `createdAt`, `updatedAt`
- WebhookEndpoint: `id`, `workflowId`, `path` (unique), `secret`, `headers` JSON, `createdAt`

---

### Story 3.2: Create Webhook Receiver Endpoint
**Description**: As a system, I need a webhook receiver endpoint that triggers workflows.

**Skills to Use**:
- `nextjs-api-route-builder` - Create webhook endpoint
- `api-route-development` - Follow patterns (no auth for public webhook)

**Acceptance Criteria**:
- [ ] `POST /api/webhooks/:path` - Receive webhook
- [ ] Validates webhook path exists
- [ ] Optionally verifies webhook signature (if secret configured)
- [ ] Maps webhook payload to `initialContext`
- [ ] Creates AgentRun with workflowId
- [ ] Triggers LangGraph execution
- [ ] Returns 200 OK immediately (async execution)
- [ ] Handles invalid webhooks (400 Bad Request)

**Security**:

**Webhook Path Generation**:
```typescript
import { randomBytes } from 'crypto';

function generateWebhookPath(): string {
  // Generate cryptographically secure random path
  return `wh_${randomBytes(16).toString('hex')}`;
}
```

**Webhook Signature Verification** (HMAC SHA256):
```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  // Use timing-safe comparison
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Webhook Receiver Implementation** (`src/app/api/webhooks/[path]/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string } }
) {
  const webhookPath = params.path;
  
  // Find webhook endpoint
  const endpoint = await db.webhookEndpoint.findUnique({
    where: { path: webhookPath },
    include: { workflow: true },
  });
  
  if (!endpoint) {
    return NextResponse.json(
      { error: 'Webhook not found' },
      { status: 404 }
    );
  }
  
  if (endpoint.workflow.status !== 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Workflow not published' },
      { status: 400 }
    );
  }
  
  // Rate limiting (per webhook path)
  const rateLimitKey = `webhook:${webhookPath}`;
  const rateLimitResponse = rateLimit(request, {
    limit: 100,
    window: 60, // 100 requests per minute
  }, rateLimitKey);
  
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  // Verify signature if secret configured
  if (endpoint.secret) {
    const signature = request.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }
    
    const body = await request.text();
    if (!verifyWebhookSignature(body, signature, endpoint.secret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
  }
  
  // Parse webhook payload
  const payload = await request.json();
  
  // Map payload to initialContext (configurable mapping)
  const initialContext = mapWebhookPayloadToContext(
    payload,
    endpoint.workflow.triggerConfig?.payloadMapping
  );
  
  // Create AgentRun
  const run = await db.agentRun.create({
    data: {
      workflowId: endpoint.workflowId,
      userId: endpoint.workflow.ownerId, // Use workflow owner
      goal: `Webhook triggered: ${webhookPath}`,
      initialContext,
      status: 'RUNNING', // Skip planning for workflows
      plan: endpoint.workflow.plan, // Use workflow's plan
    },
  });
  
  // Trigger execution (async)
  executeWorkflow(run.id).catch((error) => {
    console.error('Webhook execution error:', error);
  });
  
  // Update trigger last triggered time
  await db.workflowTrigger.update({
    where: { workflowId: endpoint.workflowId },
    data: { lastTriggeredAt: new Date() },
  });
  
  return NextResponse.json(
    { runId: run.id, status: 'triggered' },
    { status: 202 }
  );
}

function mapWebhookPayloadToContext(
  payload: unknown,
  mapping?: Record<string, string>
): Record<string, unknown> {
  if (!mapping) {
    // Default: use entire payload as context
    return { payload };
  }
  
  // Map fields according to mapping config
  const context: Record<string, unknown> = {};
  for (const [contextKey, payloadPath] of Object.entries(mapping)) {
    context[contextKey] = JSONPath({ path: payloadPath, json: payload });
  }
  
  return context;
}
```

**Rate Limiting Strategy**:
- Per-webhook-path rate limiting
- Configurable limits (default: 100 req/min)
- Redis-based rate limiting for distributed systems

---

### Story 3.3: Create Webhook Trigger Management API
**Description**: As a user, I need API endpoints to create, list, update, and delete webhook triggers.

**Skills to Use**:
- `nextjs-api-route-builder` - Create trigger management endpoints
- `api-route-development` - Follow security patterns

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/triggers` - Create trigger
- [ ] `GET /api/workflows/:id/triggers` - List triggers
- [ ] `PUT /api/workflows/:id/triggers/:triggerId` - Update trigger
- [ ] `DELETE /api/workflows/:id/triggers/:triggerId` - Delete trigger
- [ ] Generates unique webhook path
- [ ] Generates webhook secret (optional)
- [ ] All routes follow security pattern
- [ ] Audit logging

---

### Story 3.4: Build Scheduled Trigger Worker
**Description**: As a system, I need a background worker that checks scheduled triggers and executes workflows.

**Skills to Use**:
- `runtime-module-builder` - Create scheduler worker

**Acceptance Criteria**:
- [ ] Worker checks scheduled triggers periodically (every minute)
- [ ] Evaluates cron expressions
- [ ] Creates AgentRun when schedule matches
- [ ] Triggers LangGraph execution
- [ ] Updates `lastTriggeredAt` timestamp
- [ ] Handles errors gracefully
- [ ] Can run as separate process or Next.js API route

**Technical Details**:

**Scheduler Worker Implementation** (`src/lib/workers/scheduler.ts`):
```typescript
import cron from 'node-cron';
import { db } from '@/lib/db';
import { executeWorkflow } from '@/lib/runtime/langgraph/executor';

// Run every minute
const SCHEDULE_CHECK_INTERVAL = '* * * * *'; // Cron: every minute

export function startScheduler(): void {
  cron.schedule(SCHEDULE_CHECK_INTERVAL, async () => {
    await checkAndTriggerScheduledWorkflows();
  });
}

async function checkAndTriggerScheduledWorkflows(): Promise<void> {
  try {
    // Find active scheduled triggers
    const triggers = await db.workflowTrigger.findMany({
      where: {
        triggerType: 'SCHEDULED',
        status: 'ACTIVE',
      },
      include: {
        workflow: {
          where: {
            status: 'PUBLISHED',
          },
        },
      },
    });

    const now = new Date();

    for (const trigger of triggers) {
      if (!trigger.workflow) continue;

      const config = trigger.config as {
        cronExpression: string;
        timezone?: string;
      };

      // Check if trigger should fire now
      if (shouldTriggerNow(config.cronExpression, trigger.lastTriggeredAt, now)) {
        try {
          // Create AgentRun
          const run = await db.agentRun.create({
            data: {
              workflowId: trigger.workflowId,
              userId: trigger.workflow.ownerId,
              goal: `Scheduled: ${trigger.workflow.name}`,
              initialContext: config.initialContext || {},
              status: 'RUNNING',
              plan: trigger.workflow.plan,
            },
          });

          // Trigger execution
          executeWorkflow(run.id).catch((error) => {
            console.error(`Scheduled trigger execution error for ${trigger.id}:`, error);
            // Update trigger status to ERROR
            db.workflowTrigger.update({
              where: { id: trigger.id },
              data: {
                status: 'ERROR',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
              },
            }).catch(console.error);
          });

          // Update last triggered time
          await db.workflowTrigger.update({
            where: { id: trigger.id },
            data: {
              lastTriggeredAt: now,
              status: 'ACTIVE', // Reset error status if it was in error
              errorMessage: null,
            },
          });
        } catch (error) {
          console.error(`Error triggering scheduled workflow ${trigger.id}:`, error);
          await db.workflowTrigger.update({
            where: { id: trigger.id },
            data: {
              status: 'ERROR',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  }
}

function shouldTriggerNow(
  cronExpression: string,
  lastTriggeredAt: Date | null,
  now: Date
): boolean {
  // Parse cron expression and check if it matches current time
  // Use node-cron's parser or similar library
  const cronTime = cron.parseExpression(cronExpression, {
    tz: 'UTC', // Or use configured timezone
  });

  // Get next scheduled time
  const nextTime = cronTime.next().toDate();

  // Check if next time is within the current minute
  const timeDiff = nextTime.getTime() - now.getTime();
  return timeDiff >= 0 && timeDiff < 60000; // Within 1 minute
}
```

**Alternative: Vercel Cron Integration** (if using Vercel):
```typescript
// src/app/api/cron/scheduled-triggers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkAndTriggerScheduledWorkflows } from '@/lib/workers/scheduler';

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await checkAndTriggerScheduledWorkflows();

  return NextResponse.json({ success: true });
}
```

**Cron Expression Support**:
- Preset schedules: `@daily`, `@hourly`, `@weekly`, `@monthly`
- Standard cron: `0 9 * * *` (9 AM daily)
- Timezone support: `America/New_York`
- Validation: Use `cron-validator` package

---

### Story 3.5: Create Scheduled Trigger Management API
**Description**: As a user, I need API endpoints to create and manage scheduled triggers.

**Skills to Use**:
- `nextjs-api-route-builder` - Create scheduled trigger endpoints
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/triggers` - Create scheduled trigger
- [ ] Validates cron expression
- [ ] Supports preset schedules (`@daily`, `@hourly`, `@weekly`)
- [ ] Supports custom cron expressions
- [ ] Updates trigger status (ACTIVE, PAUSED)
- [ ] All routes follow security pattern

---

### Story 3.6: Build Trigger Management UI
**Description**: As a user, I need a UI to view and manage workflow triggers.

**Skills to Use**:
- `ui-page-builder` - Create trigger management page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/triggers` shows all triggers
- [ ] Displays trigger type, status, last triggered time
- [ ] "Add Trigger" button with trigger type selector
- [ ] Webhook trigger: shows webhook URL, copy button
- [ ] Scheduled trigger: shows cron expression, next run time
- [ ] Enable/disable trigger toggle
- [ ] Delete trigger button
- [ ] Handles loading and error states

---

## Epic 4: Advanced Flow Control

**Goal**: Add branching, merging, iterators, and wait steps to workflows (partially covered in Epic 2, but UI/API needed)

### Story 4.1: Update RunStep Model for Flow Control
**Description**: As a developer, I need RunStep model extended to support flow control step types.

**Skills to Use**:
- `prisma-model-addition` - Update RunStep model
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] RunStep model updated with `stepType` enum
- [ ] RunStep model updated with `branchConfig`, `waitConfig`, `iteratorConfig` JSON fields
- [ ] RunPath model created (tracks branch path selection)
- [ ] Migration generated and applied
- [ ] No breaking changes to existing RunStep records

**Step Types**:
- `SKILL`, `BRANCH`, `MERGE`, `ITERATOR`, `WAIT`, `APP_ACTION`, `TASK`, `DATA_INPUT`

---

### Story 4.2: Create Branch Condition Evaluator
**Description**: As a system, I need a function to evaluate branch conditions and select paths.

**Skills to Use**:
- `runtime-module-builder` - Create branch evaluator

**Acceptance Criteria**:
- [ ] Evaluates condition expressions (JSONPath, simple comparisons)
- [ ] Supports condition types: `equals`, `contains`, `greaterThan`, `lessThan`, `matches` (regex)
- [ ] Supports AI-based evaluation (LLM decides path)
- [ ] Supports manual evaluation (human chooses - uses interrupt)
- [ ] Returns selected path index
- [ ] Handles errors gracefully

**Technical Details**:
- Condition evaluator function
- AI evaluation calls LLM with context
- Manual evaluation uses LangGraph interrupt

---

### Story 4.3: Create Wait Condition Checker
**Description**: As a system, I need a function to check if wait conditions are met.

**Skills to Use**:
- `runtime-module-builder` - Create wait condition checker

**Acceptance Criteria**:
- [ ] Checks time-based wait conditions (duration elapsed, datetime reached)
- [ ] Checks condition-based waits (polls context until condition met)
- [ ] Checks webhook-based waits (webhook received)
- [ ] Returns boolean (condition met or not)
- [ ] Handles timeout (condition not met within timeout period)

**Technical Details**:
- Background scheduler checks wait conditions
- Polling interval configurable
- Timeout handling

---

### Story 4.4: Create Iterator Context Manager
**Description**: As a system, I need a function to manage iterator context (current item, accumulated results).

**Skills to Use**:
- `runtime-module-builder` - Create iterator context manager

**Acceptance Criteria**:
- [ ] Extracts array from context
- [ ] Manages current iteration index
- [ ] Manages current item context
- [ ] Accumulates results from iterations
- [ ] Updates context with accumulated results after loop
- [ ] Handles empty arrays
- [ ] Supports nested iterators

**Technical Details**:
- Iterator state management
- Context scoping (item context vs loop context)

---

## Epic 5: App Integrations Foundation

**Goal**: Build foundation for external app integrations

### Story 5.1: Create Integration Database Models
**Description**: As a developer, I need Prisma schema for AppIntegration and AppAction models.

**Skills to Use**:
- `prisma-model-addition` - Add integration models
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] AppIntegration model added (stores OAuth tokens, API keys)
- [ ] AppAction model added (defines available actions)
- [ ] Relations defined
- [ ] Credentials stored encrypted
- [ ] Schema validated

**Model Fields**:
- AppIntegration: `id`, `appName`, `userId`, `credentials` JSON (encrypted), `status` enum, `lastSyncAt`, `createdAt`, `updatedAt`
- AppAction: `id`, `appName`, `actionName`, `description`, `inputSchema` JSON, `outputSchema` JSON, `requiresAuth` Boolean

---

### Story 5.2: Create Integration Adapter Base Interface
**Description**: As a developer, I need a base interface for all app integrations.

**Skills to Use**:
- `runtime-module-builder` - Create base integration interface

**Acceptance Criteria**:
- [ ] Base integration interface defined
- [ ] Methods: `connect()`, `disconnect()`, `getActions()`, `executeAction()`
- [ ] Error handling interface
- [ ] Credential management interface
- [ ] TypeScript types for all methods

---

### Story 5.3: Implement Gmail Integration Adapter
**Description**: As a developer, I need a Gmail integration adapter for sending and reading emails.

**Skills to Use**:
- `runtime-module-builder` - Create Gmail adapter
- `security-best-practices` - Secure credential storage

**Acceptance Criteria**:
- [ ] Gmail adapter implements base interface
- [ ] OAuth 2.0 flow for Gmail
- [ ] Actions: `send_email`, `read_emails`, `get_email`
- [ ] Credentials stored encrypted
- [ ] Error handling for API failures
- [ ] Rate limiting awareness

**Dependencies**:
- `googleapis` package
- Gmail API credentials

**Gmail Adapter Implementation** (`src/lib/integrations/gmail.ts`):
```typescript
import { google } from 'googleapis';
import { BaseIntegrationAdapter } from './base';
import type { IntegrationCredentials, ActionInput, ActionOutput } from './types';

export class GmailAdapter extends BaseIntegrationAdapter {
  private oauth2Client: any;

  async connect(credentials: IntegrationCredentials): Promise<void> {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/integrations/gmail/callback`
    );

    // Set credentials
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate,
    });

    // Refresh token if expired
    if (credentials.expiryDate && credentials.expiryDate < Date.now()) {
      const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
      // Update stored credentials
      await this.updateCredentials(newCredentials);
    }
  }

  async disconnect(): Promise<void> {
    // Revoke OAuth token
    await this.oauth2Client.revokeCredentials();
    this.oauth2Client = null;
  }

  async getActions(): Promise<ActionDefinition[]> {
    return [
      {
        name: 'send_email',
        description: 'Send an email via Gmail',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body (HTML or plain text)' },
            cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
            bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
          },
          required: ['to', 'subject', 'body'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            threadId: { type: 'string' },
          },
        },
      },
      {
        name: 'read_emails',
        description: 'Read emails from inbox',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Gmail search query' },
            maxResults: { type: 'number', description: 'Maximum number of results', default: 10 },
          },
        },
        outputSchema: {
          type: 'object',
          properties: {
            emails: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  subject: { type: 'string' },
                  from: { type: 'string' },
                  snippet: { type: 'string' },
                  date: { type: 'string' },
                },
              },
            },
          },
        },
      },
    ];
  }

  async executeAction(actionName: string, inputs: ActionInput): Promise<ActionOutput> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    switch (actionName) {
      case 'send_email':
        return await this.sendEmail(gmail, inputs);
      case 'read_emails':
        return await this.readEmails(gmail, inputs);
      default:
        throw new Error(`Unknown action: ${actionName}`);
    }
  }

  private async sendEmail(gmail: any, inputs: ActionInput): Promise<ActionOutput> {
    const { to, subject, body, cc, bcc } = inputs;

    // Create email message
    const message = [
      `To: ${to}`,
      cc ? `Cc: ${cc.join(', ')}` : '',
      bcc ? `Bcc: ${bcc.join(', ')}` : '',
      `Subject: ${subject}`,
      '',
      body,
    ]
      .filter(Boolean)
      .join('\n');

    // Encode message
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      messageId: response.data.id,
      threadId: response.data.threadId,
    };
  }

  private async readEmails(gmail: any, inputs: ActionInput): Promise<ActionOutput> {
    const { query = '', maxResults = 10 } = inputs;

    // List messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messageIds = listResponse.data.messages?.map(m => m.id!) || [];

    // Get message details
    const emails = await Promise.all(
      messageIds.map(async (id) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = message.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name === name)?.value || '';

        return {
          id: message.data.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: message.data.snippet || '',
        };
      })
    );

    return { emails };
  }
}
```

**OAuth Flow Implementation** (`src/app/api/integrations/gmail/connect/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  // Authentication
  const authResult = await checkAuthWithPermission(request, PERMISSIONS.WORKFLOWS_CREATE);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/gmail/callback`
  );

  // Generate OAuth URL
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: JSON.stringify({ userId: user.id }), // Include user ID in state
    prompt: 'consent', // Force consent screen to get refresh token
  });

  // Store OAuth state in session or database (for verification in callback)
  await db.appIntegration.upsert({
    where: {
      userId_appName: {
        userId: user.id,
        appName: 'gmail',
      },
    },
    create: {
      userId: user.id,
      appName: 'gmail',
      status: 'CONNECTING', // Temporary status
      credentials: {
        oauthState: authUrl.split('state=')[1]?.split('&')[0], // Extract state
      },
    },
    update: {
      status: 'CONNECTING',
      credentials: {
        oauthState: authUrl.split('state=')[1]?.split('&')[0],
      },
    },
  });

  return NextResponse.json({ authUrl });
}
```

**OAuth Callback Handler** (`src/app/api/integrations/gmail/callback/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption'; // Credential encryption

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=invalid_request`);
  }

  try {
    const { userId } = JSON.parse(state);

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/integrations/gmail/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Encrypt credentials before storing
    const encryptedCredentials = encrypt(JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    }));

    // Store credentials
    await db.appIntegration.upsert({
      where: {
        userId_appName: {
          userId,
          appName: 'gmail',
        },
      },
      create: {
        userId,
        appName: 'gmail',
        status: 'CONNECTED',
        credentials: encryptedCredentials,
        lastSyncAt: new Date(),
      },
      update: {
        status: 'CONNECTED',
        credentials: encryptedCredentials,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?success=gmail_connected`);
  } catch (error) {
    console.error('Gmail OAuth callback error:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/integrations?error=oauth_failed`);
  }
}
```

---

### Story 5.4: Implement Slack Integration Adapter
**Description**: As a developer, I need a Slack integration adapter for sending messages and creating channels.

**Skills to Use**:
- `runtime-module-builder` - Create Slack adapter
- `security-best-practices` - Secure credential storage

**Acceptance Criteria**:
- [ ] Slack adapter implements base interface
- [ ] OAuth 2.0 flow for Slack
- [ ] Actions: `send_message`, `create_channel`, `list_channels`
- [ ] Credentials stored encrypted
- [ ] Error handling for API failures
- [ ] Rate limiting awareness

**Dependencies**:
- `@slack/web-api` package
- Slack app credentials

---

### Story 5.5: Create Integration OAuth Flow API
**Description**: As a user, I need to connect external apps via OAuth.

**Skills to Use**:
- `nextjs-api-route-builder` - Create OAuth endpoints
- `api-route-development` - Follow security patterns
- `authentication-security` - Secure OAuth flow

**Acceptance Criteria**:
- [ ] `POST /api/integrations/:app/connect` - Initiate OAuth
- [ ] `GET /api/integrations/:app/callback` - OAuth callback handler
- [ ] `DELETE /api/integrations/:app` - Disconnect app
- [ ] Stores credentials encrypted
- [ ] Handles OAuth errors
- [ ] All routes follow security pattern

---

### Story 5.6: Create Integration Management API
**Description**: As a user, I need API endpoints to list and manage integrations.

**Skills to Use**:
- `nextjs-api-route-builder` - Create integration endpoints
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/integrations` - List available integrations
- [ ] `GET /api/integrations/connected` - List user's connected apps
- [ ] `GET /api/integrations/:app/actions` - List available actions for app
- [ ] All routes follow security pattern
- [ ] Returns action schemas for workflow builder

---

### Story 5.7: Implement App Action Step Node in LangGraph
**Description**: As a system, I need app action steps to execute within LangGraph workflow.

**Skills to Use**:
- `runtime-module-builder` - Create app action node

**Acceptance Criteria**:
- [ ] App action node loads integration adapter
- [ ] Executes action with resolved inputs
- [ ] Handles authentication (loads user's credentials)
- [ ] Creates RunStep record
- [ ] Updates state with action output
- [ ] Handles errors and retries
- [ ] Respects rate limits

**Technical Details**:
- Node function calls integration adapter
- Credentials loaded from AppIntegration
- Output added to context

---

### Story 5.8: Build Integration Management UI
**Description**: As a user, I need a UI to connect and manage external app integrations.

**Skills to Use**:
- `ui-page-builder` - Create integration management page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/integrations` shows available integrations
- [ ] Shows connected apps with status
- [ ] "Connect" button for each integration
- [ ] OAuth flow handled in UI
- [ ] "Disconnect" button for connected apps
- [ ] Shows last sync time
- [ ] Handles loading and error states

---

## Epic 6: Visual Workflow Builder

**Goal**: Create drag-and-drop workflow editor

### Story 6.1: Install and Configure React Flow
**Description**: As a developer, I need React Flow installed and configured for the visual workflow builder.

**Skills to Use**:
- `repo-discovery-and-constraints` - Understand UI patterns

**Acceptance Criteria**:
- [ ] `reactflow` package installed
- [ ] React Flow canvas component created
- [ ] Basic canvas renders
- [ ] Canvas configuration (zoom, pan, minimap)

**Dependencies**:
- `reactflow` package

---

### Story 6.2: Create Workflow Canvas Component
**Description**: As a developer, I need a workflow canvas component that displays workflow steps as nodes.

**Skills to Use**:
- `ui-component-development` - Create React component
- `code-style-conventions` - Follow TypeScript patterns

**Acceptance Criteria**:
- [ ] Canvas component renders workflow as graph
- [ ] Nodes represent workflow steps
- [ ] Edges represent flow between steps
- [ ] Zoom and pan functionality
- [ ] Minimap for navigation
- [ ] Follows design system

---

### Story 6.3: Create Skill Step Node Component
**Description**: As a developer, I need a node component for skill steps in the workflow canvas.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] Skill node displays skill name
- [ ] Node is draggable
- [ ] Node has input/output handles
- [ ] Node can be selected and edited
- [ ] Node shows status (if run in progress)
- [ ] Follows design system

---

### Story 6.4: Create Branch Node Component
**Description**: As a developer, I need a node component for branch steps.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] Branch node displays condition
- [ ] Node has multiple output handles (one per path)
- [ ] Node shows path labels
- [ ] Node can be edited (condition, paths)
- [ ] Follows design system

---

### Story 6.5: Create Merge Node Component
**Description**: As a developer, I need a node component for merge steps.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] Merge node displays merge strategy
- [ ] Node has multiple input handles (one per path)
- [ ] Node has single output handle
- [ ] Node can be edited (merge strategy)
- [ ] Follows design system

---

### Story 6.6: Create Iterator Node Component
**Description**: As a developer, I need a node component for iterator steps.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] Iterator node displays array source
- [ ] Node shows nested child steps (subgraph)
- [ ] Node can be expanded/collapsed
- [ ] Node can be edited (array source, child steps)
- [ ] Follows design system

---

### Story 6.7: Create Wait Node Component
**Description**: As a developer, I need a node component for wait steps.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] Wait node displays wait type and duration/condition
- [ ] Node can be edited (wait type, duration, condition)
- [ ] Follows design system

---

### Story 6.8: Create App Action Node Component
**Description**: As a developer, I need a node component for app action steps.

**Skills to Use**:
- `ui-component-development` - Create node component

**Acceptance Criteria**:
- [ ] App action node displays app name and action name
- [ ] Node can be edited (app, action, inputs)
- [ ] Node shows connection status
- [ ] Follows design system

---

### Story 6.9: Create Property Panel Component
**Description**: As a developer, I need a property panel to edit selected node configuration.

**Skills to Use**:
- `ui-component-development` - Create property panel component

**Acceptance Criteria**:
- [ ] Property panel shows when node selected
- [ ] Panel displays node-specific configuration form
- [ ] Form fields based on node type
- [ ] Changes update node configuration
- [ ] Validation feedback
- [ ] Follows design system

---

### Story 6.10: Implement Workflow Canvas Save/Load
**Description**: As a developer, I need canvas state to save to and load from workflow JSON.

**Skills to Use**:
- `ui-component-development` - Add save/load logic
- `code-style-conventions` - Follow TypeScript patterns

**Acceptance Criteria**:
- [ ] Canvas state serializes to workflow plan JSON
- [ ] Workflow plan JSON deserializes to canvas state
- [ ] Save button updates workflow via API
- [ ] Auto-save functionality (optional)
- [ ] Handles validation errors

---

### Story 6.11: Implement Node Drag and Drop
**Description**: As a user, I need to drag nodes from palette onto canvas.

**Skills to Use**:
- `ui-component-development` - Add drag and drop

**Acceptance Criteria**:
- [ ] Node palette with all step types
- [ ] Nodes can be dragged from palette
- [ ] Nodes can be repositioned on canvas
- [ ] Nodes can be deleted
- [ ] Follows design system

---

### Story 6.12: Implement Edge Creation
**Description**: As a user, I need to connect nodes with edges to define workflow flow.

**Skills to Use**:
- `ui-component-development` - Add edge creation

**Acceptance Criteria**:
- [ ] Edges can be created by dragging from output handle to input handle
- [ ] Edges can be deleted
- [ ] Edge validation (no cycles unless intentional)
- [ ] Visual feedback during edge creation
- [ ] Follows design system

---

## Epic 7: Batch Processing

**Goal**: Process multiple items in parallel

### Story 7.1: Create Batch Run Database Models
**Description**: As a developer, I need Prisma schema for BatchRun model.

**Skills to Use**:
- `prisma-model-addition` - Add BatchRun model
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] BatchRun model added
- [ ] AgentRun model updated with `batchId` and `batchIndex`
- [ ] Relations defined
- [ ] Migration generated and applied

---

### Story 7.2: Create Batch Execution API Endpoint
**Description**: As a user, I need to execute a workflow with multiple initial contexts.

**Skills to Use**:
- `nextjs-api-route-builder` - Create batch endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/batch-run` - Execute batch
- [ ] Accepts array of `initialContext` objects
- [ ] Creates BatchRun record
- [ ] Creates multiple AgentRun records with same `batchId`
- [ ] Executes runs in parallel (with concurrency limit)
- [ ] Returns batch ID immediately
- [ ] All routes follow security pattern

---

### Story 7.3: Implement Batch Execution Logic
**Description**: As a system, I need to execute multiple runs in parallel with concurrency control.

**Skills to Use**:
- `runtime-module-builder` - Create batch executor

**Acceptance Criteria**:
- [ ] Batch executor creates runs for each item
- [ ] Executes runs with concurrency limit (configurable)
- [ ] Tracks batch progress (completed, failed counts)
- [ ] Updates BatchRun status
- [ ] Handles errors gracefully (continues with other items)
- [ ] Updates batch status when all items complete

---

### Story 7.4: Build Batch Progress UI Page
**Description**: As a user, I need a page to view batch execution progress.

**Skills to Use**:
- `ui-page-builder` - Create batch page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/batches/:id` shows batch progress
- [ ] Displays total items, completed, failed counts
- [ ] Lists individual runs with status
- [ ] Real-time updates (polling or SSE)
- [ ] Links to individual run detail pages
- [ ] Handles loading and error states

---

## Epic 8: Enhanced Human-in-the-Loop

**Goal**: Expand beyond approvals to data input, tasks, manual path selection

### Story 8.1: Create Human-in-the-Loop Database Models
**Description**: As a developer, I need Prisma schema for RunTask and DataInputRequest models.

**Skills to Use**:
- `prisma-model-addition` - Add human-in-the-loop models
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] RunTask model added
- [ ] DataInputRequest model added
- [ ] RunPath model updated with `selectionType` and `selectedBy`
- [ ] Relations defined
- [ ] Migration generated and applied

---

### Story 8.2: Implement Task Step Node in LangGraph
**Description**: As a system, I need task steps to pause workflow and wait for human completion.

**Skills to Use**:
- `runtime-module-builder` - Create task step node

**Acceptance Criteria**:
- [ ] Task step node creates RunTask record
- [ ] Workflow pauses (LangGraph interrupt)
- [ ] Task assigned to user
- [ ] Workflow resumes when task completed
- [ ] Task result added to context
- [ ] Handles task timeout

**Technical Details**:
- Uses LangGraph interrupt mechanism
- Task completion API resumes workflow

---

### Story 8.3: Implement Data Input Step Node in LangGraph
**Description**: As a system, I need data input steps to request form input from users.

**Skills to Use**:
- `runtime-module-builder` - Create data input step node

**Acceptance Criteria**:
- [ ] Data input step node creates DataInputRequest record
- [ ] Workflow pauses (LangGraph interrupt)
- [ ] Form schema defines input fields
- [ ] Request sent to user (email/Slack)
- [ ] Workflow resumes when input submitted
- [ ] Input added to context
- [ ] Handles input timeout

---

### Story 8.4: Implement Manual Path Selection
**Description**: As a system, I need branch steps to pause and wait for human path selection.

**Skills to Use**:
- `runtime-module-builder` - Update branch node

**Acceptance Criteria**:
- [ ] Branch step with manual selection creates RunPath record
- [ ] Workflow pauses (LangGraph interrupt)
- [ ] Path options sent to user
- [ ] User selects path via API
- [ ] Workflow resumes with selected path
- [ ] Selected path recorded

---

### Story 8.5: Create Task Management API
**Description**: As a user, I need API endpoints to view and complete tasks.

**Skills to Use**:
- `nextjs-api-route-builder` - Create task endpoints
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/runs/:id/tasks` - List tasks for run
- [ ] `GET /api/tasks` - List user's tasks
- [ ] `POST /api/tasks/:id/complete` - Complete task
- [ ] Task completion resumes workflow
- [ ] All routes follow security pattern

---

### Story 8.6: Create Data Input Management API
**Description**: As a user, I need API endpoints to view and submit data input requests.

**Skills to Use**:
- `nextjs-api-route-builder` - Create data input endpoints
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/runs/:id/data-inputs` - List data input requests
- [ ] `GET /api/data-inputs` - List user's data input requests
- [ ] `POST /api/data-inputs/:id/submit` - Submit data input
- [ ] Input submission resumes workflow
- [ ] All routes follow security pattern

---

### Story 8.7: Create Manual Path Selection API
**Description**: As a user, I need API endpoint to manually select branch path.

**Skills to Use**:
- `nextjs-api-route-builder` - Create path selection endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `POST /api/runs/:id/paths/:pathId/select` - Select path
- [ ] Validates path exists and is pending
- [ ] Updates RunPath record
- [ ] Resumes workflow with selected path
- [ ] Route follows security pattern

---

### Story 8.8: Build User Inbox UI Page
**Description**: As a user, I need a unified inbox for tasks, data inputs, approvals, and path selections.

**Skills to Use**:
- `ui-page-builder` - Create inbox page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/inbox` shows all pending items
- [ ] Groups items by type (tasks, data inputs, approvals, path selections)
- [ ] Shows item details and context
- [ ] Action buttons (complete, submit, approve, select)
- [ ] Real-time updates
- [ ] Handles loading and error states

---

### Story 8.9: Create Task Step Component for Workflow Builder
**Description**: As a developer, I need a task step component for the visual workflow builder.

**Skills to Use**:
- `ui-component-development` - Create task step component

**Acceptance Criteria**:
- [ ] Task step node displays in canvas
- [ ] Property panel for task configuration (title, description, assignee)
- [ ] Node can be added to workflow
- [ ] Follows design system

---

### Story 8.10: Create Data Input Step Component for Workflow Builder
**Description**: As a developer, I need a data input step component for the visual workflow builder.

**Skills to Use**:
- `ui-component-development` - Create data input step component

**Acceptance Criteria**:
- [ ] Data input step node displays in canvas
- [ ] Property panel for form schema configuration
- [ ] Node can be added to workflow
- [ ] Follows design system

---

## Epic 9: Collaboration Features

**Goal**: Enable team collaboration on workflows

### Story 9.1: Create Workflow Sharing Database Model
**Description**: As a developer, I need Prisma schema for WorkflowShare model.

**Skills to Use**:
- `prisma-model-addition` - Add WorkflowShare model
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] WorkflowShare model added
- [ ] Relations defined (WorkflowShare → Workflow, WorkflowShare → User)
- [ ] Migration generated and applied

---

### Story 9.2: Create Workflow Sharing API
**Description**: As a user, I need API endpoints to share workflows with team members.

**Skills to Use**:
- `nextjs-api-route-builder` - Create sharing endpoints
- `api-route-development` - Follow patterns
- `permission-and-rbac-extension` - Add sharing permissions

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/share` - Share workflow
- [ ] `DELETE /api/workflows/:id/share/:userId` - Unshare
- [ ] `GET /api/workflows/:id/shared-with` - List shared users
- [ ] Supports VIEWER and EDITOR permissions
- [ ] All routes follow security pattern
- [ ] Audit logging

---

### Story 9.3: Implement Workflow Permission Checks
**Description**: As a system, I need to check workflow permissions before allowing access.

**Skills to Use**:
- `permission-and-rbac-extension` - Extend permission checks
- `runtime-module-builder` - Create permission checker

**Acceptance Criteria**:
- [ ] Permission checker validates workflow access
- [ ] Checks ownership, sharing, visibility
- [ ] VIEWER permission: read-only access
- [ ] EDITOR permission: can modify workflow
- [ ] Used in all workflow API endpoints

---

### Story 9.4: Extend Audit Logging for Workflow Changes
**Description**: As an auditor, I need audit logs for workflow modifications.

**Skills to Use**:
- `audit-event-extension` - Add workflow audit events

**Acceptance Criteria**:
- [ ] Audit events: `workflow.created`, `workflow.updated`, `workflow.deleted`
- [ ] Audit events: `workflow.shared`, `workflow.unshared`
- [ ] All events include user and workflow ID
- [ ] Events follow audit pattern

---

### Story 9.5: Build Workflow Sharing UI
**Description**: As a user, I need a UI to share workflows with team members.

**Skills to Use**:
- `ui-page-builder` - Create sharing UI
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Sharing dialog/modal component
- [ ] User search/select functionality
- [ ] Permission selector (VIEWER, EDITOR)
- [ ] List of shared users with permissions
- [ ] Remove sharing button
- [ ] Follows design system

---

### Story 9.6: Create Workflow Edit History API
**Description**: As a user, I need to see who changed a workflow and when.

**Skills to Use**:
- `nextjs-api-route-builder` - Create history endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/workflows/:id/history` - Get edit history
- [ ] Returns list of changes with user, timestamp, changes
- [ ] Uses AuditLog table
- [ ] Route follows security pattern

---

### Story 9.7: Build Workflow Edit History UI
**Description**: As a user, I need a UI to view workflow edit history.

**Skills to Use**:
- `ui-page-builder` - Create history page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/history` shows edit history
- [ ] Displays changes chronologically
- [ ] Shows user, timestamp, and changes made
- [ ] Follows design system

---

## Epic 10: Organization & Views

**Goal**: Better organization and visibility into workflows/runs

### Story 10.1: Create Folder Database Model
**Description**: As a developer, I need Prisma schema for Folder model.

**Skills to Use**:
- `prisma-model-addition` - Add Folder model
- `database-schema-development` - Follow conventions

**Acceptance Criteria**:
- [ ] Folder model added (supports nested folders)
- [ ] Workflow model updated with `folderId` and `archivedAt`
- [ ] Relations defined
- [ ] Migration generated and applied

---

### Story 10.2: Create Folder Management API
**Description**: As a user, I need API endpoints to create and manage folders.

**Skills to Use**:
- `nextjs-api-route-builder` - Create folder endpoints
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `POST /api/folders` - Create folder
- [ ] `GET /api/folders` - List folders (tree structure)
- [ ] `PUT /api/folders/:id` - Update folder
- [ ] `DELETE /api/folders/:id` - Delete folder
- [ ] Supports nested folders
- [ ] All routes follow security pattern

---

### Story 10.3: Build Folder Navigation UI
**Description**: As a user, I need a folder tree sidebar to organize workflows.

**Skills to Use**:
- `ui-component-development` - Create folder tree component
- `ui-page-builder` - Integrate into workflow pages

**Acceptance Criteria**:
- [ ] Folder tree component shows nested folders
- [ ] Expand/collapse folders
- [ ] Drag-and-drop workflows into folders
- [ ] Create/rename/delete folders
- [ ] Follows design system

---

### Story 10.4: Create Workflow Archive Functionality
**Description**: As a user, I need to archive old workflows.

**Skills to Use**:
- `nextjs-api-route-builder` - Add archive endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `POST /api/workflows/:id/archive` - Archive workflow
- [ ] `POST /api/workflows/:id/unarchive` - Unarchive workflow
- [ ] Archived workflows hidden from default list
- [ ] Archive filter in UI
- [ ] Routes follow security pattern

---

### Story 10.5: Create Workflow Activity Log API
**Description**: As a user, I need to see activity log for a workflow.

**Skills to Use**:
- `nextjs-api-route-builder` - Create activity log endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/workflows/:id/activity` - Get activity log
- [ ] Returns trigger events, run starts/completions, errors
- [ ] Uses AuditLog table
- [ ] Route follows security pattern

---

### Story 10.6: Build Workflow Activity Log UI
**Description**: As a user, I need a UI to view workflow activity log.

**Skills to Use**:
- `ui-page-builder` - Create activity log page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/activity` shows activity log
- [ ] Displays events chronologically
- [ ] Filters by event type
- [ ] Links to related runs
- [ ] Follows design system

---

### Story 10.7: Create Workflow Analytics API
**Description**: As a user, I need analytics data for workflow performance.

**Skills to Use**:
- `nextjs-api-route-builder` - Create analytics endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/workflows/:id/analytics` - Get analytics
- [ ] Returns: success rate, avg duration, total runs, error rate
- [ ] Returns: run count over time (time series)
- [ ] Route follows security pattern

---

### Story 10.8: Build Workflow Analytics Dashboard UI
**Description**: As a user, I need a UI to view workflow analytics.

**Skills to Use**:
- `ui-page-builder` - Create analytics page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/analytics` shows analytics
- [ ] Displays key metrics (success rate, avg duration)
- [ ] Shows charts (run count over time, success/failure breakdown)
- [ ] Follows design system

---

### Story 10.9: Create Workflow Data View API
**Description**: As a user, I need to see all data referenced in a workflow.

**Skills to Use**:
- `nextjs-api-route-builder` - Create data view endpoint
- `api-route-development` - Follow patterns

**Acceptance Criteria**:
- [ ] `GET /api/workflows/:id/data-view` - Get data view
- [ ] Returns all context variables, step outputs referenced
- [ ] Shows data flow through workflow
- [ ] Route follows security pattern

---

### Story 10.10: Build Workflow Data View UI
**Description**: As a user, I need a UI to view workflow data references.

**Skills to Use**:
- `ui-page-builder` - Create data view page
- `ui-component-development` - Follow design system

**Acceptance Criteria**:
- [ ] Page at `/workflows/:id/data` shows data view
- [ ] Displays all context variables
- [ ] Shows data flow between steps
- [ ] Follows design system

---

## Epic 11: Testing and Governance

**Goal**: Ensure quality and security

### Story 11.1: Create Integration Tests for LangGraph Execution
**Description**: As a developer, I need integration tests for LangGraph workflow execution.

**Skills to Use**:
- `integration-test-skeleton` - Create test file

**Acceptance Criteria**:
- [ ] Test file created with skeleton tests
- [ ] Tests cover: skill step execution, branch evaluation, merge coordination, iterator loops, wait steps
- [ ] Tests cover: checkpoint persistence, resume from checkpoint
- [ ] Tests cover: error handling, retries
- [ ] Tests use test database

---

### Story 11.2: Create Integration Tests for Workflow APIs
**Description**: As a developer, I need integration tests for workflow API endpoints.

**Skills to Use**:
- `integration-test-skeleton` - Create test files

**Acceptance Criteria**:
- [ ] Test files created for each API route
- [ ] Tests cover: CRUD operations, execution, triggers
- [ ] Tests cover: error cases (401, 403, 400, 404, 500)
- [ ] Tests verify: audit logging, permission checks
- [ ] Tests use test database

---

### Story 11.3: Create Integration Tests for Trigger System
**Description**: As a developer, I need integration tests for webhook and scheduled triggers.

**Skills to Use**:
- `integration-test-skeleton` - Create test files

**Acceptance Criteria**:
- [ ] Tests cover: webhook receiver, webhook trigger creation
- [ ] Tests cover: scheduled trigger execution
- [ ] Tests cover: trigger error handling
- [ ] Tests use test database

---

### Story 11.4: Security and Governance Review
**Description**: As a developer, I need to verify all security and governance requirements are met.

**Skills to Use**:
- `security-and-governance-checker` - Review all code changes

**Acceptance Criteria**:
- [ ] All security checklist items verified
- [ ] All governance requirements met
- [ ] No security anti-patterns present
- [ ] OAuth flows secure
- [ ] Credentials encrypted
- [ ] Code ready for review

---

## Implementation Order

### Phase 1: Foundation (Weeks 1-2)
1. Epic 1: Workflow System Foundation (Stories 1.1-1.7)
2. Epic 2: LangGraph Execution Engine Integration (Stories 2.1-2.10)

### Phase 2: Triggers (Weeks 3-4)
3. Epic 3: Trigger System (Stories 3.1-3.6)

### Phase 3: Flow Control (Weeks 5-6)
4. Epic 4: Advanced Flow Control (Stories 4.1-4.4)

### Phase 4: Integrations (Weeks 7-8)
5. Epic 5: App Integrations Foundation (Stories 5.1-5.8)

### Phase 5: Visual Builder (Weeks 9-10)
6. Epic 6: Visual Workflow Builder (Stories 6.1-6.12)

### Phase 6: Batch & Human-in-the-Loop (Weeks 11-12)
7. Epic 7: Batch Processing (Stories 7.1-7.4)
8. Epic 8: Enhanced Human-in-the-Loop (Stories 8.1-8.10)

### Phase 7: Collaboration & Organization (Weeks 13-14)
9. Epic 9: Collaboration Features (Stories 9.1-9.7)
10. Epic 10: Organization & Views (Stories 10.1-10.10)

### Phase 8: Testing (Week 15)
11. Epic 11: Testing and Governance (Stories 11.1-11.4)

---

## Notes

- **LangGraph Integration**: Epic 2 replaces the current sequential execution engine with LangGraph state machine. This enables advanced features like cycles, interrupts, and durable execution.

- **Backward Compatibility**: All changes maintain backward compatibility. Existing AgentRun records continue to work. Workflows are optional - users can still create ad-hoc runs.

- **Skill Tags**: Each story references specific skills from `.cursor/skills/` directory. Follow skill instructions when implementing.

- **Dependencies**: Stories within an epic may have dependencies. Check story dependencies before starting.

- **Security**: All API routes must follow the security pattern: CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response.

- **Testing**: Integration tests should be created alongside implementation, not after.

---

## Success Metrics

1. **Adoption**: % of runs created from workflows vs ad-hoc
2. **Automation**: % of runs triggered automatically vs manually
3. **Efficiency**: Average time to create workflow vs one-time run
4. **Reliability**: Workflow success rate vs ad-hoc runs
5. **Engagement**: Active workflows per user, runs per workflow
6. **Collaboration**: % of workflows shared, average collaborators per workflow
