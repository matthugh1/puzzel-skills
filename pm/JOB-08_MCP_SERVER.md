# JOB-08: MCP Server

## Objective
Expose the Skills Library to AI agents via the Model Context Protocol (MCP), allowing agents to discover and use approved skills.

---

## Inputs
- Published skills from the database
- User authentication context

## Outputs
- MCP server implementation at `/api/mcp`
- Tool definitions for skill discovery and execution

---

## Implementation

### MCP Endpoints

**1. List Tools**
Returns available skills as MCP tools.

```typescript
// Response format
{
  tools: [
    {
      name: "skill_contract_analyzer",
      description: "Analyzes contracts for potential red flags and risks",
      inputSchema: {
        type: "object",
        properties: {
          document: { type: "string", description: "The contract text to analyze" }
        },
        required: ["document"]
      }
    }
  ]
}
```

**2. Call Tool**
Executes a skill and returns the prompt with user input merged.

```typescript
// Request
{
  name: "skill_contract_analyzer",
  arguments: {
    document: "This agreement is entered into..."
  }
}

// Response
{
  content: [
    {
      type: "text",
      text: "You are a legal contract analyst. Analyze the provided contract...\n\n---\nDocument:\nThis agreement is entered into..."
    }
  ]
}
```

---

## Files to Create

```
src/app/api/mcp/
├── route.ts           # Main MCP handler
├── tools.ts           # Tool definitions
└── handlers/
    ├── list.ts        # List available skills
    └── call.ts        # Execute skill
```

---

## Acceptance Criteria

- [ ] MCP server responds to `tools/list` with published skills
- [ ] MCP server responds to `tools/call` with skill prompt + user input
- [ ] Only PUBLISHED skills are exposed
- [ ] Skills respect visibility settings (ORG/PUBLIC only for MCP)
- [ ] Audit log records skill usage via MCP
- [ ] Error handling for invalid tool names

---

## Security Considerations

- MCP requests should be authenticated (API key or token)
- Rate limiting to prevent abuse
- Audit all skill executions
