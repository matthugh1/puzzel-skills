/**
 * MCP Server Route
 * Model Context Protocol endpoint for exposing skills to AI agents
 *
 * Endpoints:
 * - POST /api/mcp with { method: "tools/list" } - List available tools
 * - POST /api/mcp with { method: "tools/call", name, arguments } - Execute a tool
 */

import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { handleListTools } from './handlers/list';
import { handleCallTool } from './handlers/call';

// Simple rate limiting store (in-memory, resets on server restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute

/**
 * Simple rate limiting check
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW);

export async function POST(request: Request) {
  // Authenticate request
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Rate limiting by user ID
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { method } = body;

    if (!method) {
      return NextResponse.json(
        { error: 'Method is required' },
        { status: 400 }
      );
    }

    // Route to appropriate handler
    switch (method) {
      case 'tools/list':
        return handleListTools();

      case 'tools/call': {
        const { name, arguments: args } = body;
        return handleCallTool(
          { name, arguments: args || {} },
          user.id,
          request
        );
      }

      default:
        return NextResponse.json(
          { error: `Unknown method: ${method}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('MCP server error:', error);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}

// MCP servers typically don't support GET, but we can add it for convenience
export async function GET() {
  return NextResponse.json({
    name: 'Skills Library MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol server for Skills Library',
    endpoints: {
      'tools/list': 'List available skills as MCP tools',
      'tools/call': 'Execute a skill with provided arguments',
    },
  });
}
