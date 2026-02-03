import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';

/**
 * GET /api/admin/check-skills
 * Admin endpoint to check skills in database
 */
export async function GET() {
  const authResult = await checkAuthWithPermission(
    new Request('http://localhost/api/admin/check-skills'),
    PERMISSIONS.SKILLS_ADMIN
  );

  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    // Search for skills with "formatter" or "document" in the name
    const formatterSkills = await db.skill.findMany({
      where: {
        OR: [
          { name: { contains: 'formatter', mode: 'insensitive' } },
          { name: { contains: 'document', mode: 'insensitive' } },
          { description: { contains: 'format', mode: 'insensitive' } },
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Extract variables from latest version content
    const skillsWithVars = formatterSkills.map((skill) => {
      const latestVersion = skill.versions[0];
      if (!latestVersion) {
        return { ...skill, variables: [] };
      }

      const variablePattern = /\{\{(\w+)\}\}/g;
      const variables = new Set<string>();
      let match;
      while ((match = variablePattern.exec(latestVersion.content)) !== null) {
        variables.add(match[1]);
      }

      return {
        id: skill.id,
        name: skill.name,
        status: skill.status,
        category: skill.category,
        visibility: skill.visibility,
        owner: skill.owner,
        versions: skill.versions.map((v) => ({
          id: v.id,
          version: v.version,
          status: v.status,
          contentPreview: v.content.substring(0, 300),
          variables: Array.from(variables),
        })),
      };
    });

    // Also get all skills
    const allSkills = await db.skill.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        category: true,
        visibility: true,
        owner: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      formatterSkills: skillsWithVars,
      allSkills,
    });
  } catch (error) {
    console.error('Check skills error:', error);
    return NextResponse.json(
      { error: 'Failed to check skills' },
      { status: 500 }
    );
  }
}
