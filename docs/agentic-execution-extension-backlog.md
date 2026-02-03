# Agentic Execution Extension - Backlog

This backlog maps the Agentic Execution Extension plan to epics and user stories, with each story referencing which generic builder skills should be used for implementation.

## Epic 1: Database Foundation

### Story 1.1: Add Agentic Execution Database Models
**Description**: As a developer, I need Prisma schema for agentic execution models (AgentRun, RunStep, RunPolicy, RunArtefact, RunApproval, SkillVersionMetadata) so that run state can be persisted.

**Skills to Use**:
- `repo-discovery-and-constraints` - Understand constraints before starting
- `prisma-model-addition` - Add new models following conventions

**Acceptance Criteria**:
- [ ] All 6 models added to schema (AgentRun, RunStep, RunPolicy, RunArtefact, RunApproval, SkillVersionMetadata)
- [ ] No modifications to Skill or SkillVersion models
- [ ] Models follow naming conventions (PascalCase models, snake_case tables)
- [ ] All models have required fields (id, createdAt, updatedAt)
- [ ] Relations properly defined
- [ ] Indexes added for frequently queried fields
- [ ] Schema validated (`npx prisma validate`)

**Constraints**:
- Must NOT modify Skill or SkillVersion models
- Must use separate SkillVersionMetadata table (not add fields to SkillVersion)

---

### Story 1.2: Generate Database Migration
**Description**: As a developer, I need database migrations generated and applied so that the schema matches the code.

**Skills to Use**:
- `db-migration-and-seed-update` - Generate migration and update seed script

**Acceptance Criteria**:
- [ ] Migration generated (`npx prisma migrate dev --name add_agentic_models`)
- [ ] Migration SQL verified (no unexpected DROP/ALTER on prohibited tables)
- [ ] Migration applies successfully
- [ ] Database is in expected state

**Constraints**:
- Migration must not modify Skill or SkillVersion tables

---

### Story 1.3: Add Default RunPolicy Seed Data
**Description**: As a developer, I need seed data for RunPolicy so that default policies exist for testing.

**Skills to Use**:
- `db-migration-and-seed-update` - Update seed script with default policy

**Acceptance Criteria**:
- [ ] Default RunPolicy created in seed script
- [ ] Seed runs successfully (`pnpm db:seed`)
- [ ] Default policy appears in database after seeding

---

## Epic 2: Runtime Engine

### Story 2.1: Create Planning Stub Interface
**Description**: As a system, I need a planning stub so that plans can be generated for MVP testing.

**Skills to Use**:
- `runtime-module-builder` - Create planning module in src/lib/runtime/

**Acceptance Criteria**:
- [ ] PlanningEngine interface defined
- [ ] StubPlanningEngine implementation created
- [ ] Returns plans with pinned skillVersionId (no nulls)
- [ ] Exports planningEngine instance
- [ ] Module follows runtime module patterns

**Constraints**:
- Must pin concrete skillVersionId (no "latest" resolution)
- Must return structured Plan with steps array

---

### Story 2.2: Implement Context Resolver
**Description**: As a system, I need context resolution so that step inputs can reference previous outputs.

**Skills to Use**:
- `runtime-module-builder` - Create context resolver module

**Acceptance Criteria**:
- [ ] resolveContext function implemented
- [ ] Supports $context.* references
- [ ] Supports $step.N.output.raw and $step.N.output.data.* references
- [ ] Supports @previous.output.* references
- [ ] Handles missing references gracefully (returns null)
- [ ] Non-reference strings passed through unchanged

**Constraints**:
- Runtime references distinct from {{variable}} template syntax
- Must handle missing references without errors

---

### Story 2.3: Create Interpreter Layer
**Description**: As a system, I need an interpreter layer so that skill outputs can be transformed and validated.

**Skills to Use**:
- `runtime-module-builder` - Create interpreter module

**Acceptance Criteria**:
- [ ] interpretOutput function implemented
- [ ] Strict JSON parsing enforced (rejects non-JSON text)
- [ ] Schema validation (basic MVP)
- [ ] Returns structured output with artefactType and sensitivity
- [ ] Handles missing metadata gracefully (defaults to text)

**Constraints**:
- JSON outputs must be pure JSON (no surrounding text/markdown)
- Must classify sensitivity (LOW, MEDIUM, HIGH)

---

### Story 2.4: Create Policy Validator
**Description**: As a system, I need a policy validator so that plans and steps can be validated against constraints.

**Skills to Use**:
- `runtime-module-builder` - Create policy validator module

**Acceptance Criteria**:
- [ ] validatePlan function implemented
- [ ] validateStep function implemented
- [ ] Checks maxSteps, maxInitialContextBytes
- [ ] Checks category restrictions (allowed/blocked)
- [ ] Checks capability restrictions (allowed/blocked)
- [ ] Checks tag restrictions (allowed/blocked)
- [ ] Returns structured error messages

**Constraints**:
- Must validate before execution
- Must return detailed error messages for violations

---

### Story 2.5: Implement Lease Manager
**Description**: As a system, I need a lease manager so that distributed execution can prevent split-brain scenarios.

**Skills to Use**:
- `runtime-module-builder` - Create lease manager module

**Acceptance Criteria**:
- [ ] acquireLease function with atomic conditional update
- [ ] refreshLease function
- [ ] releaseLease function
- [ ] markStaleSteps function (for FAILED_STALE)
- [ ] Uses single conditional DB update (prevents split-brain)

**Constraints**:
- Lease acquisition MUST be atomic (single conditional DB update)
- Must use WHERE clause: `leaseExpiresAt IS NULL OR leaseExpiresAt < now()`

---

### Story 2.6: Build Execution Engine
**Description**: As a system, I need an execution engine so that skills can be executed sequentially within runs.

**Skills to Use**:
- `runtime-module-builder` - Create execution engine module

**Acceptance Criteria**:
- [ ] executeRun function implemented
- [ ] Sequential step execution
- [ ] Lease acquisition/refresh/release
- [ ] Cancellation checks before/after steps
- [ ] Policy validation
- [ ] Artefact creation with sensitivity classification
- [ ] Error handling and retries
- [ ] Max duration enforcement

**Constraints**:
- Must check cancellation before creating/executing steps
- Must refresh lease before and after each step
- Must enforce artefact limits
- Must handle FAILED_STALE steps

---

## Epic 3: Backend APIs

### Story 3.1: Extend Audit Logging
**Description**: As an auditor, I need audit logs for agent run lifecycle events.

**Skills to Use**:
- `audit-event-extension` - Add new audit functions

**Acceptance Criteria**:
- [ ] ResourceType extended with 'agent'
- [ ] Audit functions added: agentRunCreated, agentRunCompleted, agentRunFailed, agentRunCancelled
- [ ] Audit functions added: agentStepExecuted, agentStepFailed
- [ ] Audit functions added: agentApprovalRequested, agentApprovalApproved, agentApprovalRejected
- [ ] All functions follow standard pattern
- [ ] Functions can be imported and used

---

### Story 3.2: Add runs:approve Permission
**Description**: As a system, I need runs:approve permission so that approval authorization works.

**Skills to Use**:
- `permission-and-rbac-extension` - Add permission constant and seed data

**Acceptance Criteria**:
- [ ] Permission constant added to PERMISSIONS object
- [ ] Permission seeded in database
- [ ] Permission assigned to approver and admin roles
- [ ] Can be used in checkAuthWithPermission calls

---

### Story 3.3: Create POST /api/runs Endpoint
**Description**: As a user, I need POST /api/runs to create agent runs.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route

**Acceptance Criteria**:
- [ ] Route follows security pattern (CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response)
- [ ] Validates input (goal, initialContext, policyId, inputAllowlist)
- [ ] Checks maxInitialContextBytes
- [ ] Validates inputAllowlist semantics (null = default, [] = allow nothing, populated = explicit)
- [ ] Supports idempotencyKey
- [ ] Creates AgentRun record
- [ ] Triggers planning phase
- [ ] Logs audit event (agentRunCreated)
- [ ] Returns 201 with run data

**Constraints**:
- Must validate initialContext size against policy
- Must enforce inputAllowlist validation

---

### Story 3.4: Create GET /api/runs/:id Endpoint
**Description**: As a user, I need GET /api/runs/:id to view run status.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route

**Acceptance Criteria**:
- [ ] Route follows security pattern
- [ ] Returns run with steps and plan
- [ ] Handles 404 for non-existent runs
- [ ] Returns appropriate status codes

---

### Story 3.5: Create GET /api/runs/:id/artefacts Endpoint
**Description**: As a user, I need GET /api/runs/:id/artefacts to view run artefacts.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route

**Acceptance Criteria**:
- [ ] Route follows security pattern
- [ ] Returns artefacts for run
- [ ] Handles redacted content (if retention expired)
- [ ] Returns appropriate status codes

---

### Story 3.6: Create POST /api/runs/:id/cancel Endpoint
**Description**: As a user, I need POST /api/runs/:id/cancel to cancel running runs.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route

**Acceptance Criteria**:
- [ ] Route follows security pattern
- [ ] Sets run status to CANCELLED
- [ ] Records cancellationReason
- [ ] Logs audit event (agentRunCancelled)
- [ ] Returns appropriate status codes

**Constraints**:
- Cancellation is cooperative (doesn't abort in-flight MCP calls)

---

### Story 3.7: Create POST /api/runs/:id/approve Endpoint
**Description**: As an approver, I need POST /api/runs/:id/approve to approve blocked runs.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route
- `permission-and-rbac-extension` - Verify runs:approve permission usage

**Acceptance Criteria**:
- [ ] Route requires runs:approve permission
- [ ] Prevents self-approval (approvedBy cannot equal requestedBy)
- [ ] Transitions run from BLOCKED to RUNNING
- [ ] Updates RunApproval record
- [ ] Logs audit event (agentApprovalApproved)
- [ ] Returns appropriate status codes

**Constraints**:
- Must check runs:approve permission (not skills:approve)
- Must prevent self-approval

---

### Story 3.8: Create POST /api/runs/:id/reject Endpoint
**Description**: As an approver, I need POST /api/runs/:id/reject to reject blocked runs.

**Skills to Use**:
- `nextjs-api-route-builder` - Create API route

**Acceptance Criteria**:
- [ ] Route requires runs:approve permission
- [ ] Transitions run to CANCELLED
- [ ] Records rejectionReason
- [ ] Updates RunApproval record
- [ ] Logs audit event (agentApprovalRejected)
- [ ] Returns appropriate status codes

---

## Epic 4: UI Pages

### Story 4.1: Create Run List Page
**Description**: As a user, I need a page to list my agent runs.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page

**Acceptance Criteria**:
- [ ] Page follows layout pattern (page-container, page-header, page-content)
- [ ] Uses design system rules (white background, dark text, CSS variables)
- [ ] Fetches runs from API
- [ ] Displays run status, goal, created date
- [ ] Links to run detail page
- [ ] Handles loading and error states

---

### Story 4.2: Create Run Detail Page
**Description**: As a user, I need a page to view run details and steps.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page

**Acceptance Criteria**:
- [ ] Page follows layout pattern
- [ ] Displays run information (goal, status, plan)
- [ ] Lists steps with status and outputs
- [ ] Shows artefacts (if accessible)
- [ ] Handles loading and error states

---

### Story 4.3: Create Run Create Page
**Description**: As a user, I need a page to create new agent runs.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page with form

**Acceptance Criteria**:
- [ ] Page follows layout pattern
- [ ] Form for goal, initialContext, policyId, inputAllowlist
- [ ] Validates input client-side
- [ ] Submits to POST /api/runs
- [ ] Handles success (redirect to run detail)
- [ ] Handles errors (display error message)

---

### Story 4.4: Create Approval Dashboard Page
**Description**: As an approver, I need a page to approve/reject blocked runs.

**Skills to Use**:
- `ui-page-builder` - Create Next.js page

**Acceptance Criteria**:
- [ ] Page follows layout pattern
- [ ] Lists blocked runs requiring approval
- [ ] Shows run details, plan, and artefacts
- [ ] Approve and reject buttons
- [ ] Calls approve/reject API endpoints
- [ ] Handles success and error states

---

## Epic 5: Testing and Governance

### Story 5.1: Create Integration Tests for Execution Engine
**Description**: As a developer, I need integration tests for the execution engine to verify it works correctly.

**Skills to Use**:
- `integration-test-skeleton` - Create test file

**Acceptance Criteria**:
- [ ] Test file created with skeleton tests
- [ ] Tests cover happy path (run execution)
- [ ] Tests cover error cases (policy violations, step failures)
- [ ] Tests cover cancellation
- [ ] Tests cover lease management

---

### Story 5.2: Create Integration Tests for API Routes
**Description**: As a developer, I need integration tests for API routes to verify they work correctly.

**Skills to Use**:
- `integration-test-skeleton` - Create test files

**Acceptance Criteria**:
- [ ] Test files created for each API route
- [ ] Tests cover happy path
- [ ] Tests cover error cases (401, 403, 400, 404, 500)
- [ ] Tests verify audit logging
- [ ] Tests verify permission checks

---

### Story 5.3: Security and Governance Review
**Description**: As a developer, I need to verify all security and governance requirements are met.

**Skills to Use**:
- `security-and-governance-checker` - Review all code changes

**Acceptance Criteria**:
- [ ] All security checklist items verified
- [ ] All governance requirements met
- [ ] No security anti-patterns present
- [ ] Code ready for review

---

## Build Order Recommendation

1. **Database Foundation** (Epic 1)
   - Story 1.1 → Story 1.2 → Story 1.3

2. **Runtime Engine** (Epic 2)
   - Story 2.1 → Story 2.2 → Story 2.3 → Story 2.4 → Story 2.5 → Story 2.6

3. **Backend APIs** (Epic 3)
   - Story 3.1 → Story 3.2 → Story 3.3 → Story 3.4 → Story 3.5 → Story 3.6 → Story 3.7 → Story 3.8

4. **UI Pages** (Epic 4)
   - Story 4.1 → Story 4.2 → Story 4.3 → Story 4.4

5. **Testing and Governance** (Epic 5)
   - Story 5.1 → Story 5.2 → Story 5.3

---

## Notes

- Each story references specific generic builder skills to use
- Stories build on each other (dependencies noted)
- All stories must follow repository constraints (see `docs/repo-contract.md`)
- Security and governance review (Story 5.3) should be done before final submission
