# Tools System

The Skills Library includes a **Tools Registry** system that allows you to create reusable, code-based tools that can be executed by skills without requiring LLM calls.

## Overview

**Tools** are reusable functions that perform specific operations (like generating documents, processing files, etc.). They are separate from **Skills** (which are LLM prompts), but skills can reference tools via metadata.

## Architecture

```
┌─────────────┐
│   Skills    │  ← LLM prompts (stored in database)
└──────┬──────┘
       │ references
       ▼
┌─────────────┐
│   Tools     │  ← Code functions (registered at runtime)
└─────────────┘
```

## Available Tools

### Document Generator (`document-generator`)

Converts text/markdown content into Word documents (.docx).

**Input Schema:**
- `content` (required): Text or markdown content to convert
- `title` (optional): Document title
- `fileName` (optional): Output filename (defaults to generated name)
- `author` (optional): Document author
- `description` (optional): Document description

**Output:**
- Returns a file reference (`__file__:runId/filename.docx`) that can be used in subsequent workflow steps

## Using Tools with Skills

To use a tool with a skill, set the skill's metadata to reference the tool:

```json
{
  "toolId": "document-generator"
}
```

### Example: Word Document Generator Skill

**Skill Definition:**
- **Name**: `Word Document Generator`
- **Description**: `Converts text content into a Word document`
- **Content**: `Convert the provided content into a Word document format.`
- **Metadata**:
  ```json
  {
    "toolId": "document-generator",
    "preferredInputs": ["content"]
  }
  ```

**Usage in Workflow:**
```
Step 1: Contract Analyzer → outputs analysis text
Step 2: Word Document Generator → 
  Input: content = $step.0.output.raw
  Output: file reference to generated .docx file
```

## Creating New Tools

### 1. Define the Tool

Create a new file in `src/lib/tools/`:

```typescript
import type { Tool } from './types';

export const myTool: Tool = {
  id: 'my-tool-id',
  name: 'My Tool Name',
  description: 'What this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      inputField: {
        type: 'string',
        description: 'Input description',
        required: true,
      },
    },
    required: ['inputField'],
  },
  executor: async (args, context) => {
    const { inputField } = args;
    
    // Your tool logic here
    const result = await doSomething(inputField);
    
    return {
      success: true,
      output: result, // String output (can be file reference, JSON, etc.)
      metadata: {
        // Optional metadata
      },
    };
  },
};
```

### 2. Register the Tool

Add it to `src/lib/tools/index.ts`:

```typescript
import { myTool } from './my-tool';

toolsRegistry.register(myTool);
```

### 3. Use in Skills

Create a skill with metadata referencing your tool:

```json
{
  "toolId": "my-tool-id"
}
```

## Tool Execution Flow

1. Skill is executed via MCP handler
2. Handler checks if skill has `toolId` in metadata
3. If tool exists, execute tool instead of LLM
4. Tool receives arguments and context (runId, stepIndex, etc.)
5. Tool returns result (success/failure + output)
6. Result is returned as skill output

## Tool Context

Tools receive execution context:

```typescript
{
  runId?: string;      // Workflow run ID
  stepIndex?: number;  // Current step index
  stepId?: string;     // Current step ID
  userId?: string;     // User ID executing the workflow
}
```

## Best Practices

1. **Idempotency**: Tools should be idempotent when possible
2. **Error Handling**: Always return structured errors in `ToolResult`
3. **File References**: Use `saveFile()` from `@/lib/file-storage` for file outputs
4. **Logging**: Use `addExecutionLog()` for important operations
5. **Validation**: Validate inputs in the executor function
6. **Documentation**: Document tool inputs/outputs clearly

## API Endpoints

### List Tools

```
GET /api/tools
```

Returns all registered tools (without executor functions).

## Differences: Tools vs Skills

| Aspect | Tools | Skills |
|--------|-------|--------|
| **Type** | Code functions | LLM prompts |
| **Storage** | Runtime registry | Database |
| **Execution** | Direct function call | LLM API call |
| **Cost** | Free | LLM API costs |
| **Speed** | Fast (milliseconds) | Slower (seconds) |
| **Use Case** | Deterministic operations | AI-powered analysis |

## Examples

### Example 1: Document Generation

```typescript
// Tool: document-generator
// Skill metadata: { "toolId": "document-generator" }
// Input: { "content": "..." }
// Output: "__file__:runId/document.docx"
```

### Example 2: Future Tool Ideas

- **PDF Generator**: Convert HTML/markdown to PDF
- **File Converter**: Convert between file formats
- **Data Validator**: Validate JSON/XML against schemas
- **Template Renderer**: Render templates with data
- **API Caller**: Make HTTP requests to external APIs
