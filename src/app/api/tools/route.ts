import { NextResponse } from 'next/server';
import { toolsRegistry } from '@/lib/tools';

/**
 * GET /api/tools
 * List all available tools
 * Public endpoint (tools are public knowledge)
 */
export async function GET() {
  try {
    const tools = toolsRegistry.getAll().map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Get tools error:', error);
    return NextResponse.json(
      { error: 'Failed to get tools' },
      { status: 500 }
    );
  }
}
