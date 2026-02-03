/**
 * GET /api/tools
 * List all available reusable tools
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission } from '@/lib/permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { toolsRegistry } from '@/lib/tools';

export async function GET(request: NextRequest) {
  try {
    const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);

    if (!authResult.authorized) {
      return authResult.response;
    }

    const tools = toolsRegistry.getAll();

    // Return tools in a simplified format (without executor functions)
    return NextResponse.json({
      tools: tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  } catch (error) {
    console.error('[API Tools] Error in GET handler:', error);
    return NextResponse.json(
      { error: 'Failed to load tools', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
