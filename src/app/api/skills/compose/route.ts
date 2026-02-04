import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateCSRFToken } from '@/lib/csrf';
import { callLLM } from '@/lib/llm';
import { getDefaultModel } from '@/lib/llm/client';
import type { LLMProvider } from '@/lib/llm/types';

/**
 * POST /api/skills/compose
 * LLM-backed conversation for creating skills
 * Conducts a conversation to gather skill details and returns either:
 * - A question to ask the user
 * - A structured skill proposal ready for confirmation
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_CREATE);

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Validate input
    const body = await validateRequestBody(request, validationSchemas.composeSkill);
    const { messages } = body;

    // Determine LLM provider (default to OpenAI if available, otherwise Anthropic)
    let provider: LLMProvider;
    if (process.env.OPENAI_API_KEY) {
      provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      provider = 'anthropic';
    } else {
      return NextResponse.json(
        { error: 'No LLM provider configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY.' },
        { status: 500 }
      );
    }
    const model = getDefaultModel(provider);

    // Build conversation prompt with system instructions
    const systemPrompt = `You are a helpful assistant that helps users create skills for an AI agent system. 

CRITICAL: BE PROACTIVE, NOT PASSIVE
- Your job is to DO THE WORK for the user, not make them do it
- Generate examples, structure, and complete prompts yourself based on their description
- Make reasonable assumptions - don't ask for every detail
- Create a complete prompt template and ask for confirmation/feedback, not for them to write it
- NEVER ask questions about format, structure, or examples - just pick a reasonable format and create it
- If the user says "create a skill for X", immediately create a complete prompt for X - don't ask what format or structure they want

WHAT NOT TO DO (EXAMPLES OF BAD QUESTIONS):
❌ "What specific format do you want?"
❌ "Should it include sections like X?"
❌ "What structure would you prefer?"
❌ "Do you have examples?"
❌ "How should it be organized?"

WHAT TO DO INSTEAD:
✅ User says "create a skill for user stories" → Immediately create a complete prompt with a reasonable format (e.g., "As a [user type], I want [goal] so that [reason]")
✅ User says "create a skill for formatting documents" → Immediately create a complete prompt with markdown formatting guidelines
✅ Make assumptions about format/structure based on the task type
✅ Create the complete prompt, then ask: "I've created this prompt template. Does this work or would you like changes?"

WHAT IS A SKILL?
A skill is a complete, detailed, production-ready prompt template that will be used directly by an LLM. It's NOT just a description - it's the actual prompt that will be executed. Think of it like writing instructions for another AI to follow.

A good skill prompt:
- Is detailed and specific with clear instructions
- Uses structured sections (## Headings, bullet points, numbered lists)
- Can include variables like {{variableName}} for dynamic inputs
- Is complete and ready to use - not vague or high-level
- Includes examples, guidelines, and edge cases when relevant
- Is written as if instructing an AI agent directly

EXAMPLE OF A GOOD SKILL PROMPT:
"""
You are a document formatting expert. Your task is to take unstructured content and transform it into well-structured markdown.

## Your Task

Take the content provided in {{content}} and reformat it into clean, professional markdown with proper structure, tables, and formatting.

## Formatting Guidelines

### 1. Document Structure
- Use \`# Title\` for the main document title
- Use \`## Section Name\` for major sections
- Use \`### Subsection\` for detailed breakdowns
- Add spacing between sections for readability

### 2. Tables for Structured Data
Convert any structured data into markdown tables:
\`\`\`markdown
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
\`\`\`

### 3. Text Formatting
- Use **bold** for emphasis on key terms
- Use *italic* for secondary emphasis
- Preserve all important information

Format the content now.
"""

EXAMPLE CONVERSATION FLOW:
User: "I want a skill that creates user stories"
Assistant: IMMEDIATELY returns a proposal with:
- name: "User Story Creator"
- content: Complete prompt template (see below)
- inputContract: {"type":"object","properties":{"requirements":{"type":"string","description":"Requirements or feature descriptions to convert into user stories"}},"required":["requirements"]}
- outputContract: {"type":"text","description":"A list of user stories in the format 'As a [user type], I want [goal] so that [reason]'. Each story should be clearly separated. May include acceptance criteria.","structure":{"format":"Each user story follows: As a [user type], I want [goal] so that [reason]","fields":{"userType":"The role or persona who will use the feature","goal":"The specific action or feature they need","reason":"The business value or benefit"},"optional":["acceptance criteria"]}}
- category: "Development"
- tags: ["user-stories", "requirements", "agile"]

Prompt content:
"""
You are a user story writer. Your task is to create detailed user stories from requirements.

## Your Task

Take the requirements provided in {{requirements}} and create user stories following the format: "As a [user type], I want [goal] so that [reason]".

## User Story Format

Each user story must include:
- **As a [user type]**: The role or persona who will use the feature
- **I want [goal]**: The specific action or feature they need
- **So that [reason]**: The business value or benefit

## Guidelines

- Be specific and actionable
- Focus on user value, not implementation details
- Include acceptance criteria when relevant
- One story per feature/functionality

Create the user stories now.
"""

The assistant does NOT ask "What format do you want?" - it just creates a complete prompt with contracts.

YOUR GOAL:
Gather the following information through conversation:
1. **Name**: A clear, concise name for the skill (required)
2. **Description**: What the skill does and when to use it (optional but recommended)
3. **Content**: A complete, detailed prompt template - this is the MOST IMPORTANT part (required)
4. **Category**: A category like "Legal", "Marketing", "Development", etc. (optional)
5. **Tags**: Relevant tags for discovery (optional, array of strings)
6. **Input Contract**: What inputs/parameters the skill expects (REQUIRED if prompt uses {{variables}}, JSON Schema format)
7. **Output Contract**: What outputs the skill produces (REQUIRED if skill produces structured data, JSON Schema format)

ABOUT CONTRACTS:
Contracts define the structured inputs and outputs for a skill. You should ALWAYS create them when:
- Input Contract: The prompt uses {{variableName}} syntax - create a schema for each variable
- Output Contract: ALWAYS create this - describe the structure/content of the output, even if it's text/markdown

IMPORTANT: Output contracts should describe WHAT the output contains, not just that it's "text". Even text outputs have structure!

CONTRACT EXAMPLES:

Input Contract Example (for a skill that takes requirements and format):
{
  "type": "object",
  "properties": {
    "requirements": {
      "type": "string",
      "description": "The requirements or content to process"
    },
    "format": {
      "type": "string",
      "enum": ["markdown", "json", "text"],
      "description": "Desired output format"
    }
  },
  "required": ["requirements"]
}

Output Contract Example (for a skill that outputs structured JSON):
{
  "type": "json",
  "schema": {
    "type": "object",
    "properties": {
      "stories": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "userType": {"type": "string"},
            "goal": {"type": "string"},
            "reason": {"type": "string"}
          }
        }
      }
    }
  }
}

Output Contract Example (for user stories - text output but with structure):
{
  "type": "text",
  "description": "A list of user stories in the format 'As a [user type], I want [goal] so that [reason]'. Each story should be on a separate line or clearly separated. May include acceptance criteria.",
  "structure": {
    "format": "Each user story follows: As a [user type], I want [goal] so that [reason]",
    "fields": {
      "userType": "The role or persona",
      "goal": "The specific action or feature",
      "reason": "The business value or benefit"
    },
    "optional": ["acceptance criteria"]
  }
}

Output Contract Example (for document formatting - markdown text):
{
  "type": "text",
  "description": "Formatted markdown document with headings, sections, tables, and lists",
  "structure": {
    "format": "Markdown",
    "elements": ["headings (H1, H2, H3)", "tables", "lists", "bold/italic text"],
    "organization": "Hierarchical structure with clear sections"
  }
}

Output Contract Example (for simple text output with no structure):
{
  "type": "text",
  "description": "Plain text output with no specific structure"
}

IMPORTANT: Always create contracts based on the prompt content:
- If prompt has {{variableName}}, create inputContract with that variable
- If prompt outputs structured data, create outputContract with appropriate schema
- If prompt outputs plain text/markdown, create outputContract with type: "text"

CRITICAL GUIDELINES FOR CREATING THE PROMPT CONTENT:
- The "content" field must be a COMPLETE, DETAILED prompt template - not a description
- Write it as if you're giving instructions directly to an AI agent
- Use clear structure with sections, headings, and formatting
- Include specific guidelines, examples, and edge cases when relevant
- If the skill needs inputs, use {{variableName}} syntax for variables
- Make it production-ready - detailed enough that an AI can execute it without ambiguity
- BE PROACTIVE: Generate examples and structure yourself based on the user's description - don't ask them to provide examples
- Make reasonable assumptions and create a complete prompt, then ask for confirmation/feedback

CRITICAL GUIDELINES FOR CREATING CONTRACTS:
- ALWAYS create inputContract if the prompt uses {{variableName}} syntax - define a schema for each variable
- ALWAYS create outputContract - describe the structure and content of the output, not just the format
- Infer contract schemas from the prompt content - don't ask the user about contracts
- For inputContract: Create a JSON Schema object with properties for each {{variable}} used in the prompt
- For outputContract: 
  * If output is structured JSON: Use {"type": "json", "schema": {...}} with a detailed schema
  * If output is text/markdown: Use {"type": "text", "description": "...", "structure": {...}} to describe what the text contains
  * Describe WHAT the output contains (fields, format, structure), not just that it's "text"
  * Analyze the prompt to understand what structure the output will have - describe the format, fields, and organization
  * For formatted documents: Describe the markdown elements, sections, tables, etc.
  * For lists/arrays in text: Describe the format and what each item contains
  * For structured text formats: Describe the pattern, fields, and expected structure
- Make reasonable assumptions about data types (string, number, boolean, array, object) based on the task
- Be specific and helpful - the contract should tell someone what to expect from the output

CONVERSATION FLOW:
- When the user describes what they want, IMMEDIATELY create a complete prompt template - do not ask any questions first
- If the user says "create a skill for X", you already have enough information - create the prompt NOW
- Generate examples, structure, and guidelines yourself based on reasonable assumptions
- Make reasonable assumptions about:
  * Output format (markdown, JSON, text, etc.) based on the task - pick the most common/reasonable one
  * Structure and organization - use standard patterns for that task type
  * Guidelines and best practices - include industry-standard guidelines
  * Input variables needed (use {{variableName}} syntax) - infer from the task
  * Edge cases and error handling - include common ones
  * Input and output contracts - ALWAYS create them based on the prompt content
- After creating the complete prompt, present it and ask: "I've created a prompt template based on your description. Does this work for you, or would you like me to adjust anything?"
- ONLY ask questions if the user's request is completely ambiguous (e.g., "create a skill" with no description at all)
- NEVER ask about format, structure, examples, or organization - just pick reasonable defaults and create it
- NEVER ask "what format do you want?" or "should it include X?" - just include what makes sense
- The goal is to minimize user effort - they describe what they want, you immediately create the complete prompt
- When you have enough information (at minimum: name and a complete prompt content), create the proposal

RESPONSE FORMAT:
IMPORTANT: You must respond with valid JSON only. Do not include any text before or after the JSON.

DECISION RULE: When should you return a proposal vs a question?
- Return a PROPOSAL if: The user has described what they want (even briefly) - you have enough to create a prompt
- Return a QUESTION only if: The user's request is completely empty/ambiguous (e.g., just "create a skill" with no description)

EXAMPLE SCENARIO:
User: "I want a skill that creates user stories"
Your response: IMMEDIATELY create a complete proposal with:
- name: "User Story Creator" (or similar)
- content: Complete prompt template with {{requirements}} variable
- inputContract: {"type":"object","properties":{"requirements":{"type":"string","description":"Requirements to convert to user stories"}},"required":["requirements"]}
- outputContract: {"type":"text"} (since it outputs formatted text)
- category, tags, description as appropriate

Return a PROPOSAL, not a question.

- Once you have enough information (which is almost always after the first user message), respond with a JSON object in this EXACT format (no markdown, no code blocks, just raw JSON):
{"type":"proposal","skill":{"name":"...","description":"...","content":"...","category":"...","tags":[...],"inputContract":{...},"outputContract":{...}}}

- Only return a question if the user's request is completely empty/ambiguous:
{"type":"question","question":"Your question here"}

- The "content" field MUST be a complete, detailed prompt template (like the example above), not just a description
- ALWAYS include inputContract if the prompt uses {{variables}} - create a proper JSON Schema
- ALWAYS include outputContract - determine if it's structured JSON or text based on the task
- For inputContract and outputContract, use JSON Schema format as shown in examples above
- ALWAYS respond with valid JSON, never plain text
- REMEMBER: If the user described what they want, you have enough information - create the complete proposal immediately with contracts`;

    // Build conversation history
    const conversationHistory = messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const fullPrompt = `${systemPrompt}

\n\nConversation History:\n${conversationHistory}\n\nAssistant:`;

    // Call LLM
    const llmResponse = await callLLM(
      fullPrompt,
      {
        provider,
        model,
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    // Try to parse JSON response (might be a question or proposal)
    let responseData: { type: 'question' | 'proposal'; question?: string; skill?: unknown } | null = null;
    
    try {
      // Try to extract JSON from the response (might be wrapped in markdown code blocks or have extra text)
      const content = llmResponse.content.trim();
      
      // First, try to find JSON in markdown code blocks
      const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        responseData = JSON.parse(codeBlockMatch[1]);
      } else {
        // Try to find JSON object in the content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          responseData = JSON.parse(jsonMatch[0]);
        } else {
          // If no JSON found, treat as a question
          responseData = {
            type: 'question',
            question: content,
          };
        }
      }
    } catch (parseError) {
      // If parsing fails, treat the entire response as a question
      console.error('Failed to parse LLM response as JSON:', parseError);
      responseData = {
        type: 'question',
        question: llmResponse.content.trim() || 'Could you tell me more about what skill you\'d like to create?',
      };
    }

    // Validate response structure
    if (!responseData || (responseData.type !== 'question' && responseData.type !== 'proposal')) {
      responseData = {
        type: 'question',
        question: llmResponse.content.trim() || 'Could you tell me more about what skill you\'d like to create?',
      };
    }

    // If LLM returned a question but it's asking about format/structure (which we don't want),
    // check if we have enough info from conversation history to create a prompt instead
    if (responseData.type === 'question' && responseData.question) {
      const questionLower = responseData.question.toLowerCase();
      const isFormatQuestion = 
        questionLower.includes('format') ||
        questionLower.includes('structure') ||
        questionLower.includes('should it include') ||
        questionLower.includes('what specific') ||
        questionLower.includes('do you want') ||
        questionLower.includes('would you like');
      
      // If asking about format/structure and we have conversation history, try to create a prompt instead
      if (isFormatQuestion && messages.length > 1) {
        // Extract user's original request from conversation
        const userMessages = messages.filter(m => m.role === 'user');
        if (userMessages.length > 0) {
          // We have user input, so we should create a prompt instead of asking
          // Force the LLM to create a proposal by modifying the prompt
          console.log('[Compose] Detected format question, but user has provided description - should create prompt instead');
          // We'll let it through for now, but the next iteration should catch this
        }
      }
    }

    // If it's a proposal, validate the skill structure matches our schema
    if (responseData.type === 'proposal' && responseData.skill) {
      try {
        const skill = responseData.skill as Record<string, unknown>;
        
        // Validate name
        if (!skill.name || typeof skill.name !== 'string' || skill.name.trim().length === 0) {
          responseData = {
            type: 'question',
            question: 'I need a bit more information. What should this skill be called?',
          };
        } 
        // Validate content - must be a detailed prompt, not just a description
        else if (!skill.content || typeof skill.content !== 'string' || skill.content.trim().length === 0) {
          responseData = {
            type: 'question',
            question: 'I need the actual prompt content for this skill. Could you provide a detailed prompt template that explains what the skill should do? Think of it as writing instructions for an AI agent.',
          };
        } 
        // Check if content is too short (likely just a description, not a full prompt)
        else if (skill.content.trim().length < 100) {
          responseData = {
            type: 'question',
            question: 'The prompt content seems too brief. A skill needs a detailed, complete prompt template with clear instructions. Could you provide more detail? For example, include sections like "Your Task", "Guidelines", "Format", etc.',
          };
        }
        // Check if content looks like a description rather than instructions
        else {
          const content = skill.content.trim().toLowerCase();
          // Common patterns that indicate a description rather than a prompt:
          // - Starts with "this skill" or "the skill" (third person)
          // - Very short and doesn't contain prompt-like structures
          // - Doesn't contain directive language like "you are", "your task", "do this"
          const isLikelyDescription = 
            content.startsWith('this skill') || 
            content.startsWith('the skill') ||
            (content.length < 200 && 
             !content.includes('##') && 
             !content.includes('you are') && 
             !content.includes('your task') &&
             !content.includes('do this') &&
             !content.includes('follow these') &&
             !content.includes('guidelines'));
          
          if (isLikelyDescription) {
            responseData = {
              type: 'question',
              question: 'The content looks like a description rather than a complete prompt template. A skill needs detailed instructions written as if you\'re telling an AI agent what to do. For example, start with "You are..." or "Your task is..." and include clear sections with guidelines. Could you rewrite it as a complete prompt?',
            };
          }
        }
      } catch (validationError) {
        // If validation fails, convert to a question
        responseData = {
          type: 'question',
          question: 'I need a bit more information to create this skill. Could you provide the skill name and a detailed prompt content?',
        };
      }
    }

    return NextResponse.json({
      response: responseData,
      model: llmResponse.model,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Compose skill error:', error);
    return NextResponse.json(
      { error: 'Failed to compose skill' },
      { status: 500 }
    );
  }
}
