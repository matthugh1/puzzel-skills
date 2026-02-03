/**
 * MCP Handler: List Tools
 * Returns all published skills with ORG visibility as MCP tools
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { skillToMCPTool } from '../tools';
import type { MCPTool } from '../tools';

export async function handleListTools(): Promise<NextResponse> {
  try {
    // Get all published skills with ORG visibility
    const skills = await db.skill.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'ORG', // Only ORG visibility for MCP (PUBLIC doesn't exist in schema)
      },
      include: {
        versions: {
          where: {
            status: 'PUBLISHED',
          },
          orderBy: {
            version: 'desc',
          },
          take: 1, // Get latest published version
        },
      },
    });

    // Convert to MCP tools
    const tools: MCPTool[] = [];

    for (const skill of skills) {
      const publishedVersion = skill.versions[0];
      if (publishedVersion) {
        tools.push(skillToMCPTool(skill, publishedVersion));
      }
    }

    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error listing MCP tools:', error);
    return NextResponse.json(
      { error: 'Failed to list tools' },
      { status: 500 }
    );
  }
}
