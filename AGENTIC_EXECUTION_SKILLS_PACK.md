# Agentic Execution Extension - Skills Pack

## Repository Discovery Summary

### What Already Exists (Can Be Reused)
- **Prisma schema**: `Skill` and `SkillVersion` models exist with lifecycle (DRAFT → PENDING_APPROVAL → PUBLISHED)
- **MCP execution**: `/api/mcp` handler with `tools/list` and `tools/call` - returns merged prompt text synchronously
- **Auth & RBAC**: JWT-based auth with `checkAuthWithPermission()`, permission pattern `skills:*`, roles (viewer, creator, approver, admin)
- **Audit logging**: `audit` service with pattern `audit.skillCreated()`, `audit.mcpSkillExecuted()`, etc. - uses `AuditLog` table
- **API route patterns**: Next.js App Router with `checkAuthWithPermission()`, `NextResponse.json()`, error handling
- **Transaction handling**: `db.$transaction()` pattern for atomic operations
- **Frontend**: Next.js App Router with React components, TailwindCSS, Puzzel Design System
- **Input sanitization**: `sanitizeInput()` and `mergePromptWithInput()` in `src/app/api/mcp/tools.ts`
- **Variable extraction**: `extractVariables()` parses `{{variable}}` syntax from prompt content

### What Exists But Must Be Extended
- **Audit logging**: Add new actions (`agent.run.created`, `agent.run.completed`, `agent.run.failed`, `agent.run.cancelled`, `agent.step.executed`, `agent.step.failed`, `agent.approval.requested`, `agent.approval.approved`, `agent.approval.rejected`)
- **Permissions**: Add `runs:approve` permission (separate from `skills:approve`)
- **MCP handler**: No changes to execution, but runtime will call it internally

### What Does NOT Exist (Must Build New)
- **Database models**: `AgentRun`, `RunStep`, `RunPolicy`, `RunArtefact`, `RunApproval`, `SkillVersionMetadata`
- **Runtime engine**: Sequential execution engine with lease/locking mechanism
- **Planning stub**: Interface that returns hardcoded plans (MVP)
- **Context resolution**: Runtime reference syntax (`$context.*`, `$step.N.output.*`, `@previous.*`)
- **Interpreter layer**: JSON parsing, schema validation, artefact type classification
- **Policy framework**: Validation against RunPolicy constraints
- **Approval workflow**: RunApproval model and approval endpoints
- **API routes**: `/api/runs/*` endpoints for run management
- **UI pages**: Run creation, status viewing, approval dashboard
- **Worker/queue**: No existing pattern - runtime executes synchronously in API route (MVP)

### Hard Constraints from Codebase
- **NO schema changes** to `Skill` or `SkillVersion` tables (strict requirement)
- **Atomic lease acquisition**: Must use single conditional DB update (`UPDATE ... WHERE leaseExpiresAt IS NULL OR leaseExpiresAt < now()`)
- **Transaction pattern**: Use `db.$transaction()` for multi-step DB operations
- **Permission pattern**: Use `checkAuthWithPermission(request, PERMISSIONS.X)` in API routes
- **Audit pattern**: Use `audit.actionName(resourceId, userId, metadata, request)`
- **Error handling**: Return `NextResponse.json({ error: '...' }, { status: XXX })`
- **Naming**: Tables use snake_case via `@@map()`, models PascalCase, fields camelCase
- **MCP execution**: Remains synchronous, stateless, returns merged prompt text

---

# A) SKILLS OVERVIEW TABLE

| Skill Name | Category | Purpose | Inputs | OutputContract | Capabilities | Dependencies | Done When |
|------------|----------|---------|---------|----------------|--------------|--------------|-----------|
| **create-agentic-schema** | DB | Create Prisma schema for AgentRun, RunStep, RunPolicy, RunArtefact, RunApproval, SkillVersionMetadata models | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | Schema file updated, migration ready |
| **create-run-policy-model** | DB | Create RunPolicy Prisma model with all policy fields | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | RunPolicy model added to schema |
| **create-agent-run-model** | DB | Create AgentRun Prisma model with lease fields | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | AgentRun model added to schema |
| **create-run-step-model** | DB | Create RunStep Prisma model with skillVersionId reference | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | RunStep model added to schema |
| **create-run-artefact-model** | DB | Create RunArtefact model with sensitivity and retention fields | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | RunArtefact model added to schema |
| **create-run-approval-model** | DB | Create RunApproval model for human handoff | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | RunApproval model added to schema |
| **create-skill-version-metadata-model** | DB | Create SkillVersionMetadata model keyed by skillVersionId | `{{schemaPath}}` | text | ["code-generation", "database-schema"] | Prisma schema exists | SkillVersionMetadata model added to schema |
| **create-prisma-migration** | DB | Generate and apply Prisma migration for agentic models | `{{migrationName}}` | text | ["code-generation", "database-migration"] | Schema changes complete | Migration file created, applied to DB |
| **extend-audit-logging** | Backend | Extend audit service with agent run lifecycle events | `{{auditFilePath}}` | text | ["code-generation", "file-modification"] | Audit service exists | New audit functions added |
| **add-runs-approve-permission** | Backend | Add runs:approve permission constant and seed data | `{{permissionsFilePath}}`, `{{seedFilePath}}` | text | ["code-generation", "file-modification"] | Permissions system exists | Permission added, seed updated |
| **create-planning-stub** | Runtime | Create planning stub interface that returns hardcoded plans | `{{planningFilePath}}` | text | ["code-generation"] | None | Planning stub implemented |
| **create-context-resolver** | Runtime | Implement runtime reference resolution ($context.*, $step.N.output.*, @previous.*) | `{{resolverFilePath}}` | text | ["code-generation"] | RunStep model exists | Context resolver implemented |
| **create-interpreter-layer** | Runtime | Implement interpreter with strict JSON parsing and schema validation | `{{interpreterFilePath}}` | text | ["code-generation"] | SkillVersionMetadata exists | Interpreter implemented |
| **create-policy-validator** | Policy | Create policy validation system for plan and step validation | `{{validatorFilePath}}` | text | ["code-generation"] | RunPolicy model exists | Policy validator implemented |
| **create-lease-manager** | Runtime | Implement atomic lease acquisition, refresh, and release | `{{leaseFilePath}}` | text | ["code-generation"] | AgentRun model exists | Lease manager implemented |
| **create-execution-engine** | Runtime | Build sequential execution engine that orchestrates skill execution | `{{engineFilePath}}` | text | ["code-generation"] | Context resolver, interpreter, lease manager exist | Execution engine implemented |
| **create-run-api-create** | Backend | Create POST /api/runs endpoint for run creation | `{{apiRoutePath}}` | text | ["code-generation"] | Execution engine exists | API endpoint implemented |
| **create-run-api-get** | Backend | Create GET /api/runs/:id endpoint for run status | `{{apiRoutePath}}` | text | ["code-generation"] | AgentRun model exists | API endpoint implemented |
| **create-run-api-artefacts** | Backend | Create GET /api/runs/:id/artefacts endpoint | `{{apiRoutePath}}` | text | ["code-generation"] | RunArtefact model exists | API endpoint implemented |
| **create-run-api-cancel** | Backend | Create POST /api/runs/:id/cancel endpoint | `{{apiRoutePath}}` | text | ["code-generation"] | Execution engine exists | API endpoint implemented |
| **create-run-api-approve** | Backend | Create POST /api/runs/:id/approve endpoint | `{{apiRoutePath}}` | text | ["code-generation"] | RunApproval model exists | API endpoint implemented |
| **create-run-api-reject** | Backend | Create POST /api/runs/:id/reject endpoint | `{{apiRoutePath}}` | text | ["code-generation"] | RunApproval model exists | API endpoint implemented |
| **create-run-list-ui** | UI | Create UI page for listing agent runs | `{{pagePath}}` | text | ["code-generation", "ui-development"] | Run API exists | UI page implemented |
| **create-run-detail-ui** | UI | Create UI page for viewing run details and steps | `{{pagePath}}` | text | ["code-generation", "ui-development"] | Run API exists | UI page implemented |
| **create-run-create-ui** | UI | Create UI page for creating new agent runs | `{{pagePath}}` | text | ["code-generation", "ui-development"] | Run API exists | UI page implemented |
| **create-approval-dashboard-ui** | UI | Create UI page for approving/rejecting blocked runs | `{{pagePath}}` | text | ["code-generation", "ui-development"] | Approval API exists | UI page implemented |

---

# B) SKILL DEFINITIONS (FULL)

## Skill: create-agentic-schema

**Category**: DB  
**Purpose**: Create Prisma schema for all agentic execution models  
**Inputs**: `{{schemaPath}}` (path to prisma/schema.prisma)  
**OutputContract**: text  
**Capabilities**: ["code-generation", "database-schema"]

### Instructions

You are adding new database models to the existing Prisma schema for agentic execution. The existing `Skill` and `SkillVersion` models MUST NOT be modified.

**CRITICAL CONSTRAINTS**:
- Do NOT modify `Skill` or `SkillVersion` models
- Use existing naming conventions: snake_case for `@@map()`, PascalCase for models, camelCase for fields
- Follow existing enum patterns (e.g., `SkillStatus`, `VersionStatus`)
- Use `@id @default(cuid())` for all IDs
- Include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt` where appropriate
- Use proper relations with `onDelete: Cascade` where appropriate

**Add these models to the schema**:

1. **RunPolicy** - Policy constraints for agent runs
2. **AgentRun** - Multi-step agentic execution session
3. **RunStep** - Single skill execution within a run
4. **RunArtefact** - Captured outputs and evidence
5. **RunApproval** - Human approval records
6. **SkillVersionMetadata** - Agentic metadata for skill versions

**Model Specifications**:

**RunPolicy**:
```prisma
enum RunStatus {
  PLANNING
  RUNNING
  BLOCKED
  COMPLETE
  FAILED
  CANCELLED
}

enum StepStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  FAILED_STALE
  SKIPPED
}

enum ArtefactType {
  PROMPT_OUTPUT
  FILE_DIFF
  CODE_CHANGE
  DECISION_LOG
  ERROR
  EXECUTOR_OUTPUT
  TOOL_REQUEST
}

enum Sensitivity {
  LOW
  MEDIUM
  HIGH
}

model RunPolicy {
  id                    String   @id @default(cuid())
  name                  String
  description           String?
  maxSteps              Int
  maxRetriesPerStep     Int      @default(3)
  maxDurationSeconds    Int
  requiresApproval      Boolean  @default(false)
  allowedCategories     String[]
  blockedCategories     String[]
  allowedCapabilities    String[]
  blockedCapabilities    String[]
  allowedTags           String[]
  blockedTags           String[]
  maxDiffBudget         Int?
  maxArtefactsPerRun    Int      @default(100)
  maxInitialContextBytes Int     @default(100000)
  environmentRestrictions Json?
  governanceRules       Json?
  
  createdById           String
  createdBy             User     @relation("PolicyCreator", fields: [createdById], references: [id])
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  runs                  AgentRun[]
  
  @@map("run_policies")
}
```

**AgentRun**:
```prisma
model AgentRun {
  id                      String      @id @default(cuid())
  userId                  String
  user                    User        @relation("RunInitiator", fields: [userId], references: [id])
  status                  RunStatus   @default(PLANNING)
  goal                    String
  initialContext          Json
  initialContextRedacted Boolean     @default(false)
  inputAllowlist          String[]?
  policyId                String?
  policy                  RunPolicy?  @relation(fields: [policyId], references: [id])
  plan                    Json?
  planContentHash         String?
  currentStepIndex        Int         @default(0)
  blockedReason           String?
  idempotencyKey          String?     @unique
  leaseOwner              String?
  leaseExpiresAt          DateTime?
  maxDurationSeconds      Int?
  startedAt               DateTime?
  completedAt             DateTime?
  failedAt                DateTime?
  cancelledAt             DateTime?
  cancellationReason      String?
  metadata                 Json?
  
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt
  
  steps                   RunStep[]
  artefacts               RunArtefact[]
  approvals               RunApproval[]
  
  @@index([userId])
  @@index([status])
  @@index([idempotencyKey])
  @@index([leaseOwner])
  @@map("agent_runs")
}
```

**RunStep**:
```prisma
model RunStep {
  id                      String        @id @default(cuid())
  runId                   String
  run                     AgentRun      @relation(fields: [runId], references: [id], onDelete: Cascade)
  stepIndex               Int
  skillId                 String
  skillVersionId          String
  skillVersion            SkillVersion  @relation(fields: [skillVersionId], references: [id])
  skillVersionContentHash String
  status                  StepStatus    @default(PENDING)
  inputContext            Json
  outputContext           Json?
  errorMessage            String?
  retryCount              Int           @default(0)
  idempotencyKey          String?
  startedAt               DateTime?
  completedAt             DateTime?
  
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
  
  artefacts               RunArtefact[]
  
  @@index([runId])
  @@index([skillVersionId])
  @@unique([runId, stepIndex])
  @@map("run_steps")
}
```

**RunArtefact**:
```prisma
model RunArtefact {
  id                  String        @id @default(cuid())
  stepId               String
  step                 RunStep       @relation(fields: [stepId], references: [id], onDelete: Cascade)
  runId                String
  run                  AgentRun      @relation(fields: [runId], references: [id], onDelete: Cascade)
  type                 ArtefactType
  content              Json
  contentRedacted      Boolean       @default(false)
  sensitivity          Sensitivity
  retentionExpiresAt   DateTime?
  metadata             Json?
  
  createdAt            DateTime      @default(now())
  
  @@index([runId])
  @@index([stepId])
  @@index([type])
  @@index([sensitivity])
  @@map("run_artefacts")
}
```

**RunApproval**:
```prisma
model RunApproval {
  id              String    @id @default(cuid())
  runId           String
  run             AgentRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  requestedAt     DateTime  @default(now())
  requestedBy     String
  requestedByUser User      @relation("ApprovalRequester", fields: [requestedBy], references: [id])
  approvedAt      DateTime?
  approvedBy       String?
  approvedByUser   User?     @relation("ApprovalApprover", fields: [approvedBy], references: [id])
  rejectedAt      DateTime?
  reason          String?
  rejectionReason String?
  
  @@index([runId])
  @@map("run_approvals")
}
```

**SkillVersionMetadata**:
```prisma
model SkillVersionMetadata {
  id              String         @id @default(cuid())
  skillVersionId  String         @unique
  skillVersion    SkillVersion   @relation(fields: [skillVersionId], references: [id], onDelete: Cascade)
  outputContract  Json?
  capabilities     String[]
  preferredInputs String[]?
  maxRetries       Int?
  timeoutSeconds  Int?
  requiresApproval Boolean       @default(false)
  executorConfig   Json?
  
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  @@map("skill_version_metadata")
}
```

**Update User model relations**:
Add these relations to the existing `User` model:
```prisma
model User {
  // ... existing fields ...
  
  // Add these relations:
  initiatedRuns      AgentRun[]        @relation("RunInitiator")
  createdPolicies    RunPolicy[]       @relation("PolicyCreator")
  requestedApprovals RunApproval[]     @relation("ApprovalRequester")
  approvedRuns       RunApproval[]      @relation("ApprovalApprover")
}
```

**Update SkillVersion model relations**:
Add this relation to the existing `SkillVersion` model:
```prisma
model SkillVersion {
  // ... existing fields ...
  
  // Add this relation:
  metadata SkillVersionMetadata?
}
```

**Verification Steps**:
1. Read the existing schema file at `{{schemaPath}}`
2. Add all enum definitions before the models
3. Add all model definitions
4. Update `User` and `SkillVersion` models with new relations
5. Verify no changes were made to `Skill` or `SkillVersion` core fields
6. Run `npx prisma format` to validate syntax
7. Run `npx prisma validate` to check for errors

**Output**:
- Show the complete new sections added to the schema
- List any relations added to existing models
- Confirm no modifications to `Skill` or `SkillVersion` core structure

---

## Skill: extend-audit-logging

**Category**: Backend  
**Purpose**: Extend audit service with agent run lifecycle events  
**Inputs**: `{{auditFilePath}}` (path to src/lib/audit.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation", "file-modification"]

### Instructions

Extend the existing audit service to support agent run lifecycle events. Follow the existing pattern: `audit.actionName(resourceId, userId, metadata?, request?)`.

**Add these new audit functions to the `audit` object**:

1. `agentRunCreated(runId, userId, metadata?, request?)` - Logs `agent.run.created`
2. `agentRunCompleted(runId, userId, metadata?, request?)` - Logs `agent.run.completed`
3. `agentRunFailed(runId, userId, metadata?, request?)` - Logs `agent.run.failed`
4. `agentRunCancelled(runId, userId, metadata?, request?)` - Logs `agent.run.cancelled`
5. `agentStepExecuted(stepId, userId, metadata?, request?)` - Logs `agent.step.executed`
6. `agentStepFailed(stepId, userId, metadata?, request?)` - Logs `agent.step.failed`
7. `agentApprovalRequested(approvalId, userId, metadata?, request?)` - Logs `agent.approval.requested`
8. `agentApprovalApproved(approvalId, userId, metadata?, request?)` - Logs `agent.approval.approved`
9. `agentApprovalRejected(approvalId, userId, metadata?, request?)` - Logs `agent.approval.rejected`

**Update ResourceType**:
Add `'agent'` to the `ResourceType` union type.

**Pattern to Follow**:
```typescript
agentRunCreated: (runId: string, userId: string, metadata?: Record<string, unknown>, request?: Request) =>
  logAudit({
    action: 'agent.run.created',
    resourceType: 'agent',
    resourceId: runId,
    userId,
    details: metadata,
    ipAddress: request ? getIpAddress(request) : undefined,
    userAgent: request ? getUserAgent(request) : undefined,
  }),
```

**Verification**:
- All functions follow the same pattern as existing audit functions
- ResourceType includes 'agent'
- Functions are added to the `audit` export object

---

## Skill: add-runs-approve-permission

**Category**: Backend  
**Purpose**: Add runs:approve permission constant and seed data  
**Inputs**: `{{permissionsFilePath}}` (src/lib/permissions.ts), `{{seedFilePath}}` (prisma/seed.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation", "file-modification"]

### Instructions

Add the `runs:approve` permission to the permissions system. This is separate from `skills:approve`.

**In `{{permissionsFilePath}}`**:
Add to `PERMISSIONS` object:
```typescript
RUNS_APPROVE: 'runs:approve',
```

**In `{{seedFilePath}}`**:
Add permission creation in seed script:
```typescript
const runsApprovePermission = await prisma.permission.upsert({
  where: { name: 'runs:approve' },
  update: {},
  create: {
    name: 'runs:approve',
    description: 'Approve or reject agent runs',
  },
});
```

Assign to approver and admin roles (find existing role assignment code and add this permission).

**Verification**:
- Permission constant added to PERMISSIONS
- Permission seeded in database
- Permission assigned to approver and admin roles

---

## Skill: create-planning-stub

**Category**: Runtime  
**Purpose**: Create planning stub interface that returns hardcoded plans  
**Inputs**: `{{planningFilePath}}` (src/lib/runtime/planning.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create a planning stub interface for MVP. The stub returns hardcoded plans based on goal patterns. In production, this would be replaced with LLM-based planning.

**Create file `{{planningFilePath}}`**:

```typescript
/**
 * Planning Engine Stub
 * Returns hardcoded plans for MVP testing
 * Future: Replace with LLM-based planning
 */

import type { Skill, SkillVersion } from '@prisma/client';

export interface PlanStep {
  skillId: string;
  skillVersionId: string; // REQUIRED - must pin concrete version
  inputs: Record<string, unknown>;
  description: string;
}

export interface Plan {
  steps: PlanStep[];
  estimatedSteps: number;
  reasoning?: string;
}

export interface PlanningEngine {
  plan(
    goal: string,
    context: Record<string, unknown>,
    availableSkills: Array<Skill & { versions: SkillVersion[] }>
  ): Promise<Plan>;
}

/**
 * MVP Planning Stub
 * Returns hardcoded plans based on goal patterns
 */
export class StubPlanningEngine implements PlanningEngine {
  async plan(
    goal: string,
    context: Record<string, unknown>,
    availableSkills: Array<Skill & { versions: SkillVersion[] }>
  ): Promise<Plan> {
    // For MVP, return a simple plan with first available skill
    // In production, this would use LLM to generate a plan
    
    if (availableSkills.length === 0) {
      throw new Error('No available skills for planning');
    }

    // Find first PUBLISHED skill with PUBLISHED version
    const skill = availableSkills.find((s) => {
      return s.status === 'PUBLISHED' && 
             s.visibility === 'ORG' &&
             s.versions.some((v) => v.status === 'PUBLISHED');
    });

    if (!skill) {
      throw new Error('No published skills available');
    }

    const publishedVersion = skill.versions.find((v) => v.status === 'PUBLISHED');
    if (!publishedVersion) {
      throw new Error('No published version found');
    }

    // Return simple single-step plan
    return {
      steps: [
        {
          skillId: skill.id,
          skillVersionId: publishedVersion.id, // Pin concrete version
          inputs: context, // Pass context as inputs
          description: `Execute ${skill.name} to accomplish: ${goal}`,
        },
      ],
      estimatedSteps: 1,
      reasoning: 'MVP stub: Single-step plan using first available skill',
    };
  }
}

export const planningEngine: PlanningEngine = new StubPlanningEngine();
```

**Verification**:
- File created with PlanningEngine interface
- StubPlanningEngine implements interface
- Returns plans with pinned skillVersionId (no nulls)
- Exports planningEngine instance

---

## Skill: create-context-resolver

**Category**: Runtime  
**Purpose**: Implement runtime reference resolution ($context.*, $step.N.output.*, @previous.*)  
**Inputs**: `{{resolverFilePath}}` (src/lib/runtime/context-resolver.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create a context resolver that resolves runtime references distinct from `{{variable}}` template syntax. Runtime references are resolved at execution time from previous step outputs and initial context.

**Create file `{{resolverFilePath}}`**:

```typescript
/**
 * Context Resolver
 * Resolves runtime references ($context.*, $step.N.output.*, @previous.*)
 * Distinct from {{variable}} template syntax used in skill prompts
 */

import type { RunStep } from '@prisma/client';

export interface ResolvedContext {
  [key: string]: unknown;
}

/**
 * Resolve runtime references in input context
 * 
 * Reference syntax:
 * - $context.<field> → initialContext[field]
 * - $step.N.output.raw → RunStep[N].outputContext.raw
 * - $step.N.output.data.<field> → RunStep[N].outputContext.data[field]
 * - @previous.output.raw → previous step's outputContext.raw
 * - @previous.output.data.<field> → previous step's outputContext.data[field]
 */
export function resolveContext(
  inputContext: Record<string, unknown>,
  initialContext: Record<string, unknown>,
  previousSteps: Array<Pick<RunStep, 'outputContext' | 'stepIndex'>>
): ResolvedContext {
  const resolved: ResolvedContext = {};

  for (const [key, value] of Object.entries(inputContext)) {
    if (typeof value === 'string') {
      resolved[key] = resolveReference(value, initialContext, previousSteps);
    } else {
      resolved[key] = value; // Non-string values passed through
    }
  }

  return resolved;
}

/**
 * Resolve a single reference string
 */
function resolveReference(
  value: string,
  initialContext: Record<string, unknown>,
  previousSteps: Array<Pick<RunStep, 'outputContext' | 'stepIndex'>>
): unknown {
  // $context.<field>
  const contextMatch = value.match(/^\$context\.(\w+)$/);
  if (contextMatch) {
    const field = contextMatch[1];
    return initialContext[field] ?? null;
  }

  // $step.N.output.raw
  const stepRawMatch = value.match(/^\$step\.(\d+)\.output\.raw$/);
  if (stepRawMatch) {
    const stepIndex = parseInt(stepRawMatch[1], 10);
    const step = previousSteps.find((s) => s.stepIndex === stepIndex);
    if (step?.outputContext && typeof step.outputContext === 'object') {
      const outputCtx = step.outputContext as { raw?: string };
      return outputCtx.raw ?? null;
    }
    return null;
  }

  // $step.N.output.data.<field>
  const stepDataMatch = value.match(/^\$step\.(\d+)\.output\.data\.(\w+)$/);
  if (stepDataMatch) {
    const stepIndex = parseInt(stepDataMatch[1], 10);
    const field = stepDataMatch[2];
    const step = previousSteps.find((s) => s.stepIndex === stepIndex);
    if (step?.outputContext && typeof step.outputContext === 'object') {
      const outputCtx = step.outputContext as { data?: Record<string, unknown> };
      return outputCtx.data?.[field] ?? null;
    }
    return null;
  }

  // @previous.output.raw
  if (value === '@previous.output.raw') {
    const previousStep = previousSteps[previousSteps.length - 1];
    if (previousStep?.outputContext && typeof previousStep.outputContext === 'object') {
      const outputCtx = previousStep.outputContext as { raw?: string };
      return outputCtx.raw ?? null;
    }
    return null;
  }

  // @previous.output.data.<field>
  const previousDataMatch = value.match(/^@previous\.output\.data\.(\w+)$/);
  if (previousDataMatch) {
    const field = previousDataMatch[1];
    const previousStep = previousSteps[previousSteps.length - 1];
    if (previousStep?.outputContext && typeof previousStep.outputContext === 'object') {
      const outputCtx = previousStep.outputContext as { data?: Record<string, unknown> };
      return outputCtx.data?.[field] ?? null;
    }
    return null;
  }

  // Not a reference, return as-is
  return value;
}
```

**Verification**:
- File created with resolveContext function
- All reference patterns supported
- Handles missing references gracefully (returns null)
- Non-reference strings passed through unchanged

---

## Skill: create-interpreter-layer

**Category**: Runtime  
**Purpose**: Implement interpreter with strict JSON parsing and schema validation  
**Inputs**: `{{interpreterFilePath}}` (src/lib/runtime/interpreter.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create an interpreter layer that transforms skill outputs based on `outputContract` metadata. For JSON outputs, enforce strict JSON-only parsing (no surrounding text/markdown).

**Create file `{{interpreterFilePath}}`**:

```typescript
/**
 * Interpreter Layer
 * Transforms skill outputs based on outputContract metadata
 * Enforces strict JSON parsing for JSON outputs
 */

import type { SkillVersionMetadata } from '@prisma/client';

export interface InterpretedOutput {
  raw: string | null;
  data: Record<string, unknown> | null;
  artefactType: 'PROMPT_OUTPUT' | 'EXECUTOR_OUTPUT' | 'TOOL_REQUEST';
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface InterpretationError {
  message: string;
  code: 'INVALID_JSON' | 'SCHEMA_VALIDATION_FAILED' | 'PARSE_ERROR';
}

/**
 * Interpret skill output based on metadata
 */
export function interpretOutput(
  rawOutput: string,
  metadata: SkillVersionMetadata | null
): { output: InterpretedOutput } | { error: InterpretationError } {
  // Default: text output
  if (!metadata || !metadata.outputContract) {
    return {
      output: {
        raw: rawOutput,
        data: null,
        artefactType: 'PROMPT_OUTPUT',
        sensitivity: 'LOW',
      },
    };
  }

  const contract = metadata.outputContract as {
    type?: 'text' | 'json';
    schema?: Record<string, unknown>;
  };

  // Text output
  if (contract.type === 'text' || !contract.type) {
    return {
      output: {
        raw: rawOutput,
        data: null,
        artefactType: 'PROMPT_OUTPUT',
        sensitivity: 'LOW',
      },
    };
  }

  // JSON output - strict parsing required
  if (contract.type === 'json') {
    // Strip whitespace but require entire output to be JSON
    const trimmed = rawOutput.trim();
    
    // Check if output contains non-JSON text (markdown, prose, etc.)
    // Simple heuristic: if it doesn't start with { or [, it's likely not pure JSON
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return {
        error: {
          message: 'Output must be valid JSON only (no surrounding text or markdown)',
          code: 'INVALID_JSON',
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      return {
        error: {
          message: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'PARSE_ERROR',
        },
      };
    }

    // Basic schema validation (MVP: check if it's an object)
    if (contract.schema && typeof parsed === 'object' && parsed !== null) {
      // MVP: Basic validation - in production, use ajv or similar
      // For now, just ensure it's an object
      const parsedObj = parsed as Record<string, unknown>;
      
      // Check if schema indicates TOOL_REQUEST structure
      const isToolRequest = contract.schema.properties?.tool !== undefined;
      
      return {
        output: {
          raw: null, // Structured output, no raw text
          data: parsedObj,
          artefactType: isToolRequest ? 'TOOL_REQUEST' : 'EXECUTOR_OUTPUT',
          sensitivity: isToolRequest ? 'HIGH' : 'MEDIUM',
        },
      };
    }

    return {
      output: {
        raw: null,
        data: parsed as Record<string, unknown>,
        artefactType: 'EXECUTOR_OUTPUT',
        sensitivity: 'MEDIUM',
      },
    };
  }

  // Unknown contract type
  return {
    output: {
      raw: rawOutput,
      data: null,
      artefactType: 'PROMPT_OUTPUT',
      sensitivity: 'LOW',
    },
  };
}
```

**Verification**:
- File created with interpretOutput function
- Strict JSON parsing enforced (rejects non-JSON text)
- Returns structured output with artefactType and sensitivity
- Handles missing metadata gracefully (defaults to text)

---

## Skill: create-policy-validator

**Category**: Policy  
**Purpose**: Create policy validation system for plan and step validation  
**Inputs**: `{{validatorFilePath}}` (src/lib/runtime/policy-validator.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create a policy validator that validates plans and steps against RunPolicy constraints.

**Create file `{{validatorFilePath}}`**:

```typescript
/**
 * Policy Validator
 * Validates plans and steps against RunPolicy constraints
 */

import type { RunPolicy, Skill, SkillVersionMetadata } from '@prisma/client';

export interface ValidationError {
  code: string;
  message: string;
}

export interface PlanStep {
  skillId: string;
  skillVersionId: string;
  inputs: Record<string, unknown>;
}

/**
 * Validate plan against policy
 */
export function validatePlan(
  plan: { steps: PlanStep[] },
  policy: RunPolicy,
  skills: Array<Skill & { metadata?: SkillVersionMetadata | null }>,
  initialContextSizeBytes: number
): { valid: true } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Check maxSteps
  if (plan.steps.length > policy.maxSteps) {
    errors.push({
      code: 'MAX_STEPS_EXCEEDED',
      message: `Plan has ${plan.steps.length} steps, but policy allows maximum ${policy.maxSteps}`,
    });
  }

  // Check maxInitialContextBytes
  if (initialContextSizeBytes > policy.maxInitialContextBytes) {
    errors.push({
      code: 'INITIAL_CONTEXT_TOO_LARGE',
      message: `Initial context size (${initialContextSizeBytes} bytes) exceeds policy limit (${policy.maxInitialContextBytes} bytes)`,
    });
  }

  // Validate each step
  for (const [index, step] of plan.steps.entries()) {
    const skill = skills.find((s) => s.id === step.skillId);
    if (!skill) {
      errors.push({
        code: 'SKILL_NOT_FOUND',
        message: `Step ${index}: Skill ${step.skillId} not found`,
      });
      continue;
    }

    // Check category restrictions
    if (skill.category) {
      if (policy.blockedCategories.includes(skill.category)) {
        errors.push({
          code: 'BLOCKED_CATEGORY',
          message: `Step ${index}: Category "${skill.category}" is blocked by policy`,
        });
      }
      if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(skill.category)) {
        errors.push({
          code: 'CATEGORY_NOT_ALLOWED',
          message: `Step ${index}: Category "${skill.category}" is not in allowed list`,
        });
      }
    }

    // Check tag restrictions
    for (const tag of skill.tags) {
      if (policy.blockedTags.includes(tag)) {
        errors.push({
          code: 'BLOCKED_TAG',
          message: `Step ${index}: Tag "${tag}" is blocked by policy`,
        });
      }
      if (policy.allowedTags.length > 0 && !policy.allowedTags.includes(tag)) {
        errors.push({
          code: 'TAG_NOT_ALLOWED',
          message: `Step ${index}: Tag "${tag}" is not in allowed list`,
        });
      }
    }

    // Check capability restrictions (from metadata)
    if (skill.metadata?.capabilities) {
      for (const capability of skill.metadata.capabilities) {
        if (policy.blockedCapabilities.includes(capability)) {
          errors.push({
            code: 'BLOCKED_CAPABILITY',
            message: `Step ${index}: Capability "${capability}" is blocked by policy`,
          });
        }
        if (policy.allowedCapabilities.length > 0 && !policy.allowedCapabilities.includes(capability)) {
          errors.push({
            code: 'CAPABILITY_NOT_ALLOWED',
            message: `Step ${index}: Capability "${capability}" is not in allowed list`,
          });
        }
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/**
 * Validate step against policy (for runtime checks)
 */
export function validateStep(
  skill: Skill & { metadata?: SkillVersionMetadata | null },
  policy: RunPolicy,
  stepIndex: number
): { valid: true } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // Check category
  if (skill.category) {
    if (policy.blockedCategories.includes(skill.category)) {
      errors.push({
        code: 'BLOCKED_CATEGORY',
        message: `Step ${stepIndex}: Category "${skill.category}" is blocked`,
      });
    }
    if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(skill.category)) {
      errors.push({
        code: 'CATEGORY_NOT_ALLOWED',
        message: `Step ${stepIndex}: Category "${skill.category}" not allowed`,
      });
    }
  }

  // Check tags
  for (const tag of skill.tags) {
    if (policy.blockedTags.includes(tag)) {
      errors.push({
        code: 'BLOCKED_TAG',
        message: `Step ${stepIndex}: Tag "${tag}" is blocked`,
      });
    }
  }

  // Check capabilities
  if (skill.metadata?.capabilities) {
    for (const capability of skill.metadata.capabilities) {
      if (policy.blockedCapabilities.includes(capability)) {
        errors.push({
          code: 'BLOCKED_CAPABILITY',
          message: `Step ${stepIndex}: Capability "${capability}" is blocked`,
        });
      }
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
```

**Verification**:
- File created with validatePlan and validateStep functions
- All policy constraints checked
- Returns structured error messages
- Handles missing metadata gracefully

---

---

## Skill: create-lease-manager

**Category**: Runtime  
**Purpose**: Implement atomic lease acquisition, refresh, and release  
**Inputs**: `{{leaseFilePath}}` (src/lib/runtime/lease-manager.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create a lease manager that implements atomic lease acquisition using a single conditional DB update. This prevents split-brain scenarios where multiple workers think they own a run.

**Create file `{{leaseFilePath}}`**:

```typescript
/**
 * Lease Manager
 * Manages run-level leases for distributed execution
 * Uses atomic conditional updates to prevent split-brain
 */

import { db } from '@/lib/db';

const LEASE_TTL_SECONDS = 300; // 5 minutes default

/**
 * Acquire run lease atomically
 * Returns true if lease acquired, false if already held
 */
export async function acquireLease(
  runId: string,
  workerId: string,
  ttlSeconds: number = LEASE_TTL_SECONDS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Atomic conditional update: only acquire if lease is expired or null
  const result = await db.agentRun.updateMany({
    where: {
      id: runId,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      leaseOwner: workerId,
      leaseExpiresAt: expiresAt,
    },
  });

  // If 0 rows updated, lease was not acquired (already held)
  return result.count > 0;
}

/**
 * Refresh lease expiration time
 */
export async function refreshLease(
  runId: string,
  workerId: string,
  ttlSeconds: number = LEASE_TTL_SECONDS
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  // Only refresh if we own the lease
  const result = await db.agentRun.updateMany({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
    data: {
      leaseExpiresAt: expiresAt,
    },
  });

  return result.count > 0;
}

/**
 * Release lease
 */
export async function releaseLease(
  runId: string,
  workerId: string
): Promise<void> {
  await db.agentRun.updateMany({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
    data: {
      leaseOwner: null,
      leaseExpiresAt: null,
    },
  });
}

/**
 * Check if lease is expired
 */
export async function isLeaseExpired(runId: string): Promise<boolean> {
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { leaseExpiresAt: true },
  });

  if (!run || !run.leaseExpiresAt) {
    return true; // No lease = expired
  }

  return run.leaseExpiresAt < new Date();
}

/**
 * Mark stale steps as FAILED_STALE
 * Only callable by current lease owner
 */
export async function markStaleSteps(
  runId: string,
  workerId: string
): Promise<void> {
  // Verify we own the lease
  const run = await db.agentRun.findUnique({
    where: {
      id: runId,
      leaseOwner: workerId,
    },
  });

  if (!run) {
    throw new Error('Cannot mark stale steps: lease not owned');
  }

  // Mark RUNNING steps as FAILED_STALE
  await db.runStep.updateMany({
    where: {
      runId,
      status: 'RUNNING',
    },
    data: {
      status: 'FAILED_STALE',
    },
  });
}
```

**Verification**:
- File created with atomic lease acquisition
- Uses `updateMany` with conditional WHERE clause
- Returns boolean indicating success
- Includes refresh, release, and stale step marking

---

## Skill: create-execution-engine

**Category**: Runtime  
**Purpose**: Build sequential execution engine that orchestrates skill execution  
**Inputs**: `{{engineFilePath}}` (src/lib/runtime/execution-engine.ts)  
**OutputContract**: text  
**Capabilities**: ["code-generation"]

### Instructions

Create the core execution engine that orchestrates sequential skill execution, handles retries, enforces timeouts, and manages run state.

**Create file `{{engineFilePath}}`**:

```typescript
/**
 * Execution Engine
 * Orchestrates sequential skill execution within agent runs
 */

import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { resolveContext } from './context-resolver';
import { interpretOutput } from './interpreter';
import { validateStep } from './policy-validator';
import { acquireLease, refreshLease, releaseLease, markStaleSteps } from './lease-manager';
import { handleCallTool } from '@/app/api/mcp/handlers/call';
import type { AgentRun, RunStep, RunPolicy, SkillVersionMetadata } from '@prisma/client';

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const LEASE_TTL_SECONDS = 300;

/**
 * Execute a single agent run
 */
export async function executeRun(runId: string): Promise<void> {
  // Acquire lease
  const leaseAcquired = await acquireLease(runId, WORKER_ID, LEASE_TTL_SECONDS);
  if (!leaseAcquired) {
    throw new Error('Could not acquire run lease');
  }

  try {
    // Load run with relations
    const run = await db.agentRun.findUnique({
      where: { id: runId },
      include: {
        policy: true,
        steps: {
          orderBy: { stepIndex: 'asc' },
        },
      },
    });

    if (!run) {
      throw new Error('Run not found');
    }

    // Check cancellation
    if (run.status === 'CANCELLED') {
      return; // Stop execution
    }

    // Check if blocked
    if (run.status === 'BLOCKED') {
      return; // Wait for approval
    }

    // Check max duration
    if (run.maxDurationSeconds && run.startedAt) {
      const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
      if (elapsed > run.maxDurationSeconds) {
        await db.agentRun.update({
          where: { id: runId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'max_duration_exceeded',
          },
        });
        return;
      }
    }

    // Execute planning if needed
    if (run.status === 'PLANNING') {
      await executePlanning(run);
      // Reload run after planning
      const updatedRun = await db.agentRun.findUnique({
        where: { id: runId },
        include: { policy: true },
      });
      if (!updatedRun || updatedRun.status !== 'RUNNING') {
        return;
      }
    }

    // Execute steps sequentially
    if (run.status === 'RUNNING' && run.plan) {
      await executeSteps(runId, run.plan as { steps: Array<{ skillId: string; skillVersionId: string; inputs: Record<string, unknown> }> }, run.policy);
    }
  } finally {
    // Release lease
    await releaseLease(runId, WORKER_ID);
  }
}

/**
 * Execute planning phase
 */
async function executePlanning(run: AgentRun & { policy: RunPolicy | null }): Promise<void> {
  // Import planning engine
  const { planningEngine } = await import('./planning');
  
  // Load available skills
  const skills = await db.skill.findMany({
    where: {
      status: 'PUBLISHED',
      visibility: 'ORG',
    },
    include: {
      versions: {
        where: { status: 'PUBLISHED' },
        orderBy: { version: 'desc' },
        take: 1,
      },
      metadata: true,
    },
  });

  const initialContext = run.initialContext as Record<string, unknown>;
  
  // Generate plan
  const plan = await planningEngine.plan(run.goal, initialContext, skills);
  
  // Calculate plan hash
  const planContentHash = createHash('sha256')
    .update(JSON.stringify(plan))
    .digest('hex');

  // Validate plan against policy
  if (run.policy) {
    const { validatePlan } = await import('./policy-validator');
    const initialContextSize = JSON.stringify(initialContext).length;
    const validation = validatePlan(plan, run.policy, skills, initialContextSize);
    
    if (!validation.valid) {
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          blockedReason: validation.errors.map((e) => e.message).join('; '),
        },
      });
      return;
    }
  }

  // Check if approval required
  const requiresApproval = run.policy?.requiresApproval ?? false;
  
  // Update run with plan
  await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: requiresApproval ? 'BLOCKED' : 'RUNNING',
      plan,
      planContentHash,
      startedAt: run.startedAt || new Date(),
      blockedReason: requiresApproval ? 'approval_required' : null,
    },
  });

  // Create approval record if needed
  if (requiresApproval) {
    await db.runApproval.create({
      data: {
        runId: run.id,
        requestedBy: run.userId,
        reason: 'Policy requires approval before execution',
      },
    });
  }
}

/**
 * Execute steps sequentially
 */
async function executeSteps(
  runId: string,
  plan: { steps: Array<{ skillId: string; skillVersionId: string; inputs: Record<string, unknown> }> },
  policy: RunPolicy | null
): Promise<void> {
  // Load run and previous steps
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    include: {
      steps: {
        orderBy: { stepIndex: 'asc' },
      },
    },
  });

  if (!run) {
    throw new Error('Run not found');
  }

  const initialContext = run.initialContext as Record<string, unknown>;

  for (const [index, planStep] of plan.steps.entries()) {
    // Check cancellation before each step
    const currentRun = await db.agentRun.findUnique({
      where: { id: runId },
      select: { status: currentStepIndex: true },
    });
    
    if (currentRun?.status === 'CANCELLED') {
      return; // Stop execution
    }

    if (currentRun?.status === 'BLOCKED') {
      return; // Wait for approval
    }

    // Skip if step already completed
    if (index < (currentRun?.currentStepIndex ?? 0)) {
      continue;
    }

    // Refresh lease before step
    await refreshLease(runId, WORKER_ID, LEASE_TTL_SECONDS);

    // Execute step
    const stepResult = await executeStep(
      runId,
      index,
      planStep,
      initialContext,
      run.steps.filter((s) => s.stepIndex < index),
      policy
    );

    // Refresh lease after step
    await refreshLease(runId, WORKER_ID, LEASE_TTL_SECONDS);

    // Check cancellation after step
    const afterRun = await db.agentRun.findUnique({
      where: { id: runId },
      select: { status: true },
    });
    
    if (afterRun?.status === 'CANCELLED') {
      return; // Stop execution
    }

    // If step failed and no retries left, fail run
    if (stepResult.status === 'FAILED' && !stepResult.retryable) {
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });
      return;
    }

    // If step succeeded, increment currentStepIndex
    if (stepResult.status === 'SUCCESS') {
      await db.agentRun.update({
        where: { id: runId },
        data: {
          currentStepIndex: index + 1,
        },
      });
    }
  }

  // All steps completed
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: 'COMPLETE',
      completedAt: new Date(),
    },
  });
}

/**
 * Execute a single step
 */
async function executeStep(
  runId: string,
  stepIndex: number,
  planStep: { skillId: string; skillVersionId: string; inputs: Record<string, unknown> },
  initialContext: Record<string, unknown>,
  previousSteps: RunStep[],
  policy: RunPolicy | null
): Promise<{ status: 'SUCCESS' | 'FAILED'; retryable: boolean }> {
  // Load skill and version
  const skill = await db.skill.findUnique({
    where: { id: planStep.skillId },
    include: {
      metadata: true,
    },
  });

  const skillVersion = await db.skillVersion.findUnique({
    where: { id: planStep.skillVersionId },
  });

  if (!skill || !skillVersion) {
    throw new Error('Skill or version not found');
  }

  // Validate step against policy
  if (policy) {
    const validation = validateStep(skill, policy, stepIndex);
    if (!validation.valid) {
      await db.runStep.create({
        data: {
          runId,
          stepIndex,
          skillId: skill.id,
          skillVersionId: skillVersion.id,
          skillVersionContentHash: createHash('sha256').update(skillVersion.content).digest('hex'),
          status: 'FAILED',
          inputContext: planStep.inputs,
          errorMessage: validation.errors.map((e) => e.message).join('; '),
        },
      });
      return { status: 'FAILED', retryable: false };
    }
  }

  // Resolve input context
  const resolvedInputs = resolveContext(planStep.inputs, initialContext, previousSteps);

  // Check input allowlist
  const run = await db.agentRun.findUnique({
    where: { id: runId },
    select: { inputAllowlist: true },
  });

  if (run?.inputAllowlist !== null) {
    const allowedFields = run.inputAllowlist.length === 0 
      ? [] // Empty array = allow nothing
      : run.inputAllowlist; // Populated = explicit allowlist
    
    // System default allowlist (if null, use default)
    const systemDefault = ['ticketId', 'ticketUrl', 'repo', 'branch', 'filePaths', 'mode', 'labels'];
    const effectiveAllowlist = run.inputAllowlist === null ? systemDefault : allowedFields;
    
    // Filter inputs
    const filteredInputs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(resolvedInputs)) {
      if (effectiveAllowlist.includes(key)) {
        filteredInputs[key] = value;
      }
    }
    Object.assign(resolvedInputs, filteredInputs);
  }

  // Create step record
  const step = await db.runStep.create({
    data: {
      runId,
      stepIndex,
      skillId: skill.id,
      skillVersionId: skillVersion.id,
      skillVersionContentHash: createHash('sha256').update(skillVersion.content).digest('hex'),
      status: 'RUNNING',
      inputContext: resolvedInputs,
      startedAt: new Date(),
    },
  });

  try {
    // Execute skill via MCP handler
    const skillName = skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    
    // Create mock request for MCP handler
    const mockRequest = new Request('http://localhost/api/mcp', {
      method: 'POST',
      body: JSON.stringify({
        method: 'tools/call',
        name: skillName,
        arguments: resolvedInputs,
      }),
    });

    // Get user from run
    const runUser = await db.agentRun.findUnique({
      where: { id: runId },
      select: { userId: true },
    });

    if (!runUser) {
      throw new Error('Run user not found');
    }

    // Call MCP handler (returns NextResponse)
    const mcpResponse = await handleCallTool(
      { name: skillName, arguments: resolvedInputs },
      runUser.userId,
      mockRequest
    );

    const mcpData = await mcpResponse.json();
    const rawOutput = mcpData.content?.[0]?.text || '';

    // Interpret output
    const interpretation = interpretOutput(rawOutput, skill.metadata);
    
    if ('error' in interpretation) {
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          errorMessage: interpretation.error.message,
          completedAt: new Date(),
        },
      });
      return { status: 'FAILED', retryable: false };
    }

    const { output } = interpretation;

    // Check artefact limit
    const artefactCount = await db.runArtefact.count({
      where: { runId },
    });

    if (policy && artefactCount >= policy.maxArtefactsPerRun) {
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: 'FAILED',
          errorMessage: 'artefact_limit_exceeded',
          completedAt: new Date(),
        },
      });
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
        },
      });
      return { status: 'FAILED', retryable: false };
    }

    // Create artefact
    const artefact = await db.runArtefact.create({
      data: {
        stepId: step.id,
        runId,
        type: output.artefactType,
        content: output.data || { raw: output.raw },
        sensitivity: output.sensitivity,
        retentionExpiresAt: calculateRetentionExpiresAt(output.sensitivity),
      },
    });

    // Update step with output
    await db.runStep.update({
      where: { id: step.id },
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

    return { status: 'SUCCESS', retryable: false };
  } catch (error) {
    await db.runStep.update({
      where: { id: step.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
    return { status: 'FAILED', retryable: true }; // Network errors are retryable
  }
}

/**
 * Calculate retention expiration date based on sensitivity
 */
function calculateRetentionExpiresAt(sensitivity: 'LOW' | 'MEDIUM' | 'HIGH'): Date {
  const now = new Date();
  const days = sensitivity === 'LOW' ? 90 : sensitivity === 'MEDIUM' ? 60 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
```

**Verification**:
- File created with executeRun function
- Implements sequential step execution
- Handles lease acquisition/refresh/release
- Checks cancellation before/after steps
- Enforces policy validation
- Creates artefacts with sensitivity classification
- Handles errors and retries

---

# C) PROJECT BREAKDOWN

## Epics and User Stories

### Epic 1: Database Foundation
- **Story 1.1**: As a developer, I need Prisma schema for agentic execution models so that run state can be persisted
- **Story 1.2**: As a developer, I need database migrations applied so that the schema matches the code
- **Story 1.3**: As a developer, I need seed data for RunPolicy so that default policies exist

### Epic 2: Runtime Engine
- **Story 2.1**: As a system, I need a planning stub so that plans can be generated for MVP testing
- **Story 2.2**: As a system, I need context resolution so that step inputs can reference previous outputs
- **Story 2.3**: As a system, I need an interpreter layer so that skill outputs can be transformed and validated
- **Story 2.4**: As a system, I need a policy validator so that plans and steps can be validated against constraints
- **Story 2.5**: As a system, I need a lease manager so that distributed execution can prevent split-brain scenarios
- **Story 2.6**: As a system, I need an execution engine so that skills can be executed sequentially within runs

### Epic 3: Backend APIs
- **Story 3.1**: As a user, I need POST /api/runs to create agent runs
- **Story 3.2**: As a user, I need GET /api/runs/:id to view run status
- **Story 3.3**: As a user, I need GET /api/runs/:id/artefacts to view run artefacts
- **Story 3.4**: As a user, I need POST /api/runs/:id/cancel to cancel running runs
- **Story 3.5**: As an approver, I need POST /api/runs/:id/approve to approve blocked runs
- **Story 3.6**: As an approver, I need POST /api/runs/:id/reject to reject blocked runs

### Epic 4: Audit and Permissions
- **Story 4.1**: As an auditor, I need audit logs for agent run lifecycle events
- **Story 4.2**: As a system, I need runs:approve permission so that approval authorization works

### Epic 5: UI Pages
- **Story 5.1**: As a user, I need a page to create agent runs
- **Story 5.2**: As a user, I need a page to view run details and steps
- **Story 5.3**: As a user, I need a page to list my agent runs
- **Story 5.4**: As an approver, I need a page to approve/reject blocked runs

## Recommended Build Order (Bootstrap Path)

### Phase 1: Database Foundation (Week 1)
1. Create Prisma schema for all models (use `create-agentic-schema` skill)
2. Generate and apply migration (`create-prisma-migration`)
3. Update seed script to create default RunPolicy
4. Verify schema with `prisma validate` and `prisma studio`

### Phase 2: Core Runtime (Week 2)
1. Create planning stub (`create-planning-stub`)
2. Create context resolver (`create-context-resolver`)
3. Create interpreter layer (`create-interpreter-layer`)
4. Create policy validator (`create-policy-validator`)
5. Create lease manager (`create-lease-manager`)
6. Create execution engine (`create-execution-engine`)

### Phase 3: Backend APIs (Week 3)
1. Extend audit logging (`extend-audit-logging`)
2. Add runs:approve permission (`add-runs-approve-permission`)
3. Create POST /api/runs (`create-run-api-create`)
4. Create GET /api/runs/:id (`create-run-api-get`)
5. Create GET /api/runs/:id/artefacts (`create-run-api-artefacts`)
6. Create POST /api/runs/:id/cancel (`create-run-api-cancel`)
7. Create POST /api/runs/:id/approve (`create-run-api-approve`)
8. Create POST /api/runs/:id/reject (`create-run-api-reject`)

### Phase 4: UI Pages (Week 4)
1. Create run list page (`create-run-list-ui`)
2. Create run detail page (`create-run-detail-ui`)
3. Create run create page (`create-run-create-ui`)
4. Create approval dashboard (`create-approval-dashboard-ui`)

### Phase 5: Testing and Ops (Week 5)
1. Write integration tests for execution engine
2. Write API route tests
3. Set up monitoring for run execution
4. Document run creation and approval workflows

---

# D) REFERENCE IMPLEMENTATION NOTES

## Prisma Model Definitions

See Skill `create-agentic-schema` for complete model definitions. Key points:
- All models use `@id @default(cuid())` for IDs
- Relations use `onDelete: Cascade` where appropriate
- Indexes added for frequently queried fields
- Enums defined before models

## REST Endpoint Specifications

### POST /api/runs
**Request**:
```json
{
  "goal": "Create a PR to fix the bug described in ticket #123",
  "initialContext": {
    "ticketId": "123",
    "ticketDescription": "Button click handler throws null reference error"
  },
  "policyId": "policy-abc-123",
  "inputAllowlist": null,
  "idempotencyKey": "run-xyz-789"
}
```

**Response** (201 Created):
```json
{
  "run": {
    "id": "run-abc-123",
    "status": "PLANNING",
    "goal": "Create a PR to fix the bug described in ticket #123",
    "currentStepIndex": 0,
    "createdAt": "2026-02-01T10:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid request (missing goal, invalid initialContext size)
- 403: Insufficient permissions
- 409: Idempotency key conflict (returns existing run)

### GET /api/runs/:id
**Response** (200 OK):
```json
{
  "run": {
    "id": "run-abc-123",
    "status": "RUNNING",
    "goal": "Create a PR to fix the bug described in ticket #123",
    "currentStepIndex": 2,
    "plan": {
      "steps": [
        {
          "skillId": "skill-123",
          "skillVersionId": "version-456",
          "description": "Analyze code"
        }
      ]
    },
    "steps": [
      {
        "id": "step-001",
        "stepIndex": 0,
        "status": "SUCCESS",
        "skillId": "skill-123",
        "skillVersionId": "version-456"
      }
    ],
    "createdAt": "2026-02-01T10:00:00Z",
    "startedAt": "2026-02-01T10:00:01Z"
  }
}
```

### GET /api/runs/:id/artefacts
**Response** (200 OK):
```json
{
  "artefacts": [
    {
      "id": "artefact-001",
      "type": "PROMPT_OUTPUT",
      "sensitivity": "LOW",
      "content": {
        "raw": "Analysis result..."
      },
      "createdAt": "2026-02-01T10:00:05Z"
    }
  ]
}
```

### POST /api/runs/:id/cancel
**Request**:
```json
{
  "reason": "User requested cancellation"
}
```

**Response** (200 OK):
```json
{
  "run": {
    "id": "run-abc-123",
    "status": "CANCELLED",
    "cancelledAt": "2026-02-01T10:05:00Z"
  }
}
```

### POST /api/runs/:id/approve
**Request**:
```json
{
  "comments": "Approved - plan looks good"
}
```

**Response** (200 OK):
```json
{
  "run": {
    "id": "run-abc-123",
    "status": "RUNNING",
    "approval": {
      "id": "approval-001",
      "approvedAt": "2026-02-01T10:06:00Z"
    }
  }
}
```

**Errors**:
- 403: Insufficient permissions (requires runs:approve)
- 403: Self-approval not allowed
- 400: Run not in BLOCKED status

### POST /api/runs/:id/reject
**Request**:
```json
{
  "reason": "Plan violates policy constraints"
}
```

**Response** (200 OK):
```json
{
  "run": {
    "id": "run-abc-123",
    "status": "CANCELLED",
    "rejectedAt": "2026-02-01T10:07:00Z"
  }
}
```

## Runtime Pseudocode

### Plan Validation
```
function validatePlan(plan, policy, skills, initialContextSize):
  errors = []
  
  if plan.steps.length > policy.maxSteps:
    errors.append("MAX_STEPS_EXCEEDED")
  
  if initialContextSize > policy.maxInitialContextBytes:
    errors.append("INITIAL_CONTEXT_TOO_LARGE")
  
  for each step in plan.steps:
    skill = findSkill(step.skillId)
    if skill.category in policy.blockedCategories:
      errors.append("BLOCKED_CATEGORY")
    if skill.metadata.capabilities intersect policy.blockedCapabilities:
      errors.append("BLOCKED_CAPABILITY")
  
  return errors.length === 0
```

### Lease Acquire
```
function acquireLease(runId, workerId):
  result = UPDATE agent_runs
    SET leaseOwner = workerId, leaseExpiresAt = NOW() + TTL
    WHERE id = runId
      AND (leaseExpiresAt IS NULL OR leaseExpiresAt < NOW())
  
  return result.rowsAffected > 0
```

### Step Loop
```
function executeSteps(run, plan):
  for each step in plan.steps:
    // Check cancellation BEFORE step
    if run.status === CANCELLED:
      return
    
    // Refresh lease
    refreshLease(run.id, workerId)
    
    // Execute step
    result = executeStep(step)
    
    // Refresh lease AFTER step
    refreshLease(run.id, workerId)
    
    // Check cancellation AFTER step
    if run.status === CANCELLED:
      return
    
    if result.status === FAILED and not result.retryable:
      markRunFailed(run.id)
      return
    
    if result.status === SUCCESS:
      incrementStepIndex(run.id)
```

### Interpreter Strict JSON Parsing
```
function interpretOutput(rawOutput, metadata):
  if metadata.outputContract.type === "json":
    trimmed = rawOutput.trim()
    
    // Reject if doesn't start with { or [
    if not (trimmed.startsWith("{") or trimmed.startsWith("[")):
      return error("Output must be valid JSON only")
    
    try:
      parsed = JSON.parse(trimmed)
    catch:
      return error("JSON parse failed")
    
    // Validate schema if provided
    if metadata.outputContract.schema:
      validateSchema(parsed, metadata.outputContract.schema)
    
    return { data: parsed, artefactType: "EXECUTOR_OUTPUT" }
  
  return { raw: rawOutput, artefactType: "PROMPT_OUTPUT" }
```

### Artefact Limit Check
```
function checkArtefactLimit(runId, policy):
  count = COUNT run_artefacts WHERE runId = runId
  
  if count >= policy.maxArtefactsPerRun:
    markStepFailed(stepId, "artefact_limit_exceeded")
    markRunFailed(runId, "artefact_limit_exceeded")
    return false
  
  return true
```

### Idempotency Behaviour
```
function createRun(data):
  if data.idempotencyKey:
    existing = FIND agent_runs WHERE idempotencyKey = data.idempotencyKey
    if existing:
      return existing
  
  return CREATE agent_run(data)
```

### FAILED_STALE Takeover
```
function takeoverStaleRun(runId, workerId):
  // Acquire lease (atomic)
  if acquireLease(runId, workerId):
    // Mark RUNNING steps as FAILED_STALE
    UPDATE run_steps
      SET status = 'FAILED_STALE'
      WHERE runId = runId AND status = 'RUNNING'
    
    // Continue execution from current step
    executeSteps(runId)
```

---

**END OF SKILLS PACK**
