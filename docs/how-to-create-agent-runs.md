# How to Create Agent Runs

This guide explains how to create and manage agent runs in the Skills Library application.

## Overview

An **agent run** is a multi-step execution session where the system:
1. **Plans** a sequence of skills to accomplish your goal
2. **Executes** those skills sequentially
3. **Tracks** progress, outputs, and artefacts
4. **Manages** approvals if required by policy

## Step-by-Step: Creating an Agent Run

### 1. Navigate to Create Run Page

Go to `/runs/new` or click "New Run" from the runs list page (`/runs`).

### 2. Fill Out the Form

#### Goal (Required)
Describe what you want the agent to accomplish. This is a natural language description.

**Example:**
```
Analyze the contract in ticket #12345 and identify any red flags or unfavorable terms.
```

#### Initial Context (Required - JSON)
Provide initial context as a JSON object. This data will be available to all steps via `$context.*` references.

**Example:**
```json
{
  "ticketId": "12345",
  "ticketUrl": "https://jira.example.com/ticket/12345",
  "repo": "legal-docs",
  "branch": "main",
  "filePaths": ["contracts/service-agreement.pdf"],
  "mode": "analysis",
  "labels": ["urgent", "legal-review"]
}
```

**Context Reference Syntax:**
- In skill inputs, you can reference context fields using `$context.<fieldName>`
- Example: `$context.ticketId` → `"12345"`

### 3. Submit the Form

Click "Create Run" to submit. The system will:
- Validate your input
- Check initial context size against policy limits
- Create the run record
- Start the planning phase (asynchronously)

### 4. View Run Status

You'll be redirected to `/runs/<run-id>` where you can see:
- **Status**: PLANNING → RUNNING → COMPLETE (or FAILED/CANCELLED)
- **Plan**: The generated sequence of steps
- **Steps**: Execution progress for each step
- **Artefacts**: Outputs and evidence from each step

## What Happens Behind the Scenes

### Phase 1: Planning (Status: PLANNING)

When you create a run, it starts in `PLANNING` status:

1. **Planning Engine** generates a plan:
   - Finds available PUBLISHED skills
   - Creates a sequence of steps to accomplish your goal
   - Pins concrete `skillVersionId` (no "latest" resolution)

2. **Policy Validation**:
   - Checks plan against RunPolicy constraints:
     - Max steps allowed
     - Initial context size limit
     - Category restrictions
     - Capability restrictions
     - Tag restrictions

3. **Approval Check**:
   - If policy requires approval → Status becomes `BLOCKED`
   - If no approval needed → Status becomes `RUNNING`

### Phase 2: Execution (Status: RUNNING)

If approved (or no approval needed), execution begins:

1. **For each step in the plan**:
   - **Resolve Inputs**: Resolve runtime references:
     - `$context.*` → initial context fields
     - `$step.N.output.*` → previous step outputs
     - `@previous.output.*` → previous step output
   
   - **Validate Step**: Check step against policy
   
   - **Execute Skill**: Call the skill via MCP handler
   
   - **Interpret Output**: Parse and validate skill output:
     - Text outputs → stored as-is
     - JSON outputs → strict JSON parsing, schema validation
   
   - **Create Artefact**: Store output with sensitivity classification
   
   - **Update Step**: Mark step as SUCCESS or FAILED

2. **After all steps**:
   - Status becomes `COMPLETE`
   - All artefacts available for review

### Phase 3: Completion (Status: COMPLETE/FAILED/CANCELLED)

- **COMPLETE**: All steps executed successfully
- **FAILED**: Step failed and no retries left, or policy violation
- **CANCELLED**: User cancelled or approval rejected

## Runtime References

When creating skill inputs, you can reference:

### Initial Context
```json
{
  "ticketId": "$context.ticketId",
  "repo": "$context.repo"
}
```

### Previous Step Outputs
```json
{
  "analysis": "$step.0.output.raw",
  "score": "$step.0.output.data.score",
  "previousResult": "@previous.output.raw"
}
```

**Note**: Runtime references (`$context.*`, `$step.*`, `@previous.*`) are distinct from skill prompt template variables (`{{variable}}`).

## Approval Workflow

If a run requires approval (policy has `requiresApproval: true`):

1. **Run Status**: Changes to `BLOCKED`
2. **Approval Record**: Created in database
3. **Approver Action**: 
   - Go to `/runs/approvals`
   - Review the plan and context
   - Click "Approve" or "Reject"
4. **After Approval**:
   - Status changes to `RUNNING`
   - Execution begins automatically
5. **After Rejection**:
   - Status changes to `CANCELLED`
   - Run stops

## Managing Runs

### View All Runs
Navigate to `/runs` to see:
- All your runs (or all runs if admin)
- Status, goal, creation date
- Click any run to view details

### View Run Details
Navigate to `/runs/<run-id>` to see:
- Full run information
- Generated plan
- Step-by-step execution progress
- Step outputs and errors
- Artefacts

### Cancel a Run
From the run detail page or via API:
- Only works if run is PLANNING or RUNNING
- Sets status to CANCELLED
- Stops further execution (cooperative cancellation)

### View Artefacts
Navigate to `/runs/<run-id>/artefacts` or use API:
- See all outputs from execution
- Artefacts may be redacted if retention expired
- Classified by sensitivity (LOW, MEDIUM, HIGH)

## Example Workflow

### Scenario: Contract Analysis

1. **Create Run**:
   ```
   Goal: "Analyze contract in ticket #12345 for red flags"
   
   Initial Context:
   {
     "ticketId": "12345",
     "ticketUrl": "https://jira.example.com/ticket/12345",
     "filePath": "contracts/service-agreement.pdf"
   }
   ```

2. **Planning Phase**:
   - System finds "Contract Red Flags Analyzer" skill
   - Creates plan: Execute contract analyzer with ticket context
   - Validates against policy (passes)
   - No approval required → Status: RUNNING

3. **Execution Phase**:
   - Step 1: Execute "Contract Red Flags Analyzer"
     - Input: `{ "ticketId": "$context.ticketId", "filePath": "$context.filePath" }`
     - Output: Analysis with score, findings, recommendations
     - Artefact created: PROMPT_OUTPUT, sensitivity: LOW
   - Status: COMPLETE

4. **Review Results**:
   - View run detail page
   - See analysis output in step 1
   - Download or view artefact

## API Usage

You can also create runs programmatically:

```typescript
import { runsApi } from '@/lib/api-client';

const run = await runsApi.create({
  goal: "Analyze contract for red flags",
  initialContext: {
    ticketId: "12345",
    filePath: "contracts/service-agreement.pdf"
  },
  // Optional:
  policyId: "policy-id", // Use specific policy
  inputAllowlist: ["ticketId", "filePath"], // Restrict inputs
  idempotencyKey: "unique-key" // Prevent duplicates
});
```

## Policies

Runs use **RunPolicy** to enforce constraints:

- **Max Steps**: Maximum number of steps allowed
- **Max Initial Context Bytes**: Size limit for initial context
- **Category Restrictions**: Block or allow specific skill categories
- **Capability Restrictions**: Block or allow specific capabilities
- **Requires Approval**: Whether run needs human approval before execution

Default policy is used if none specified. Policies can be created via database or admin interface (future enhancement).

## Troubleshooting

### Run Stuck in PLANNING
- Check if planning engine found available skills
- Verify skills are PUBLISHED and visible
- Check server logs for errors

### Run Failed
- Check step error messages in run detail page
- Verify policy constraints weren't violated
- Check if skill execution failed

### Run Blocked
- Check if policy requires approval
- Go to `/runs/approvals` to approve/reject
- Verify you have `runs:approve` permission

### No Skills Available
- Ensure skills are PUBLISHED
- Ensure skills have PUBLISHED versions
- Check skill visibility (ORG vs TEAM)

## Next Steps

- View your runs: `/runs`
- Create a new run: `/runs/new`
- Approve blocked runs: `/runs/approvals` (if you have permission)
- View run details: `/runs/<run-id>`
