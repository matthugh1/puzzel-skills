/**
 * POST /api/plan
 * Generate a workflow plan with recommended tools, skills, and steps
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAuthWithPermission, PERMISSIONS } from '@/lib/permissions';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { validateRequestBody, validationSchemas, ValidationError } from '@/lib/validation';
import { db } from '@/lib/db';
import { toolsRegistry } from '@/lib/tools';
import { callLLM } from '@/lib/llm';
import { z } from 'zod';

const planGenerationSchema = z.object({
  userGoal: z.string().min(1, 'Goal is required').max(1000).trim(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await checkAuthWithPermission(request, PERMISSIONS.SKILLS_READ);

    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;

    // Rate limiting
    const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Validate request body
    const body = await validateRequestBody(request, planGenerationSchema);

    // Fetch available tools
    const tools = toolsRegistry.getAll().map((tool) => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    // Fetch available skills (published and user's own)
    const skills = await db.skill.findMany({
      where: {
        OR: [
          { status: 'PUBLISHED' },
          { ownerId: user.id },
        ],
      },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            metadata: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Format skills for LLM
    const skillsList = skills
      .filter((skill) => skill.versions.length > 0)
      .map((skill) => {
        const version = skill.versions[0];
        const metadata = version.metadata;
        const executorConfig = metadata?.executorConfig as Record<string, unknown> | undefined;
        const toolId = (executorConfig?.toolId || (metadata as Record<string, unknown>)?.toolId) as string | undefined;
        return {
          id: skill.id,
          name: skill.name,
          description: skill.description || '',
          category: skill.category || '',
          toolId: toolId || null,
          capabilities: metadata?.capabilities || [],
        };
      });

    // Build LLM prompt
    const prompt = `You are a workflow planning assistant for a Skills Library application. Your job is to analyze a user's goal and recommend a workflow plan.

User Goal: "${body.userGoal}"

Available Tools:
${tools.map((tool) => `- ${tool.id}: ${tool.name} - ${tool.description}`).join('\n')}

Available Skills:
${skillsList.map((skill) => `- ${skill.id}: ${skill.name} - ${skill.description}${skill.toolId ? ` (uses tool: ${skill.toolId})` : ''}${skill.capabilities.length > 0 ? ` [capabilities: ${skill.capabilities.join(', ')}]` : ''}`).join('\n')}

Based on the user's goal, provide a JSON response with the following structure:
{
  "recommendedTools": [
    {
      "toolId": "tool-id",
      "reason": "why this tool is needed"
    }
  ],
  "recommendedSkills": [
    {
      "skillId": "skill-id",
      "reason": "why this skill is needed"
    }
  ],
  "recommendedSteps": [
    {
      "stepNumber": 1,
      "type": "SKILL" | "BRANCH" | "MERGE" | "ITERATOR" | "WAIT" | "APP_ACTION" | "TASK" | "DATA_INPUT",
      "description": "what this step does",
      "skillId": "skill-id-if-type-is-skill",
      "inputs": {
        "inputName": "description of what this input should be"
      },
      "reason": "why this step is needed"
    }
  ],
  "workflowName": "suggested workflow name",
  "workflowDescription": "brief description of the workflow"
}

CRITICAL REQUIREMENTS:
- You MUST use skill IDs and tool IDs EXACTLY as they appear in the lists above
- Copy the IDs character-for-character - do not modify or guess them
- If a skill ID is "clm555rc10015xlz4s28wxx9b", use exactly that string
- Only recommend skills and tools that are listed above
- Double-check each ID before including it in your response

Steps should be ordered logically. For SKILL steps, include the skillId and describe what inputs are needed. Be specific about why each recommendation is made. The workflow should accomplish the user's goal.

Respond with ONLY valid JSON, no markdown formatting or code blocks.`;

    // Call LLM
    const llmResponse = await callLLM(
      prompt,
      {
        provider: 'openai',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
      }
    );

    // Parse LLM response
    let planData;
    try {
      // Try to extract JSON from response (handle markdown code blocks)
      const jsonMatch = llmResponse.content.match(/```json\s*([\s\S]*?)\s*```/) || 
                        llmResponse.content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : llmResponse.content;
      planData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error('Failed to parse LLM response:', llmResponse.content);
      return NextResponse.json(
        { error: 'Failed to generate plan. Please try again.' },
        { status: 500 }
      );
    }

    // Validate and enrich plan data
    const enrichedPlan = {
      workflowName: planData.workflowName || 'Generated Workflow',
      workflowDescription: planData.workflowDescription || '',
      recommendedTools: (planData.recommendedTools || []).map((rec: { toolId: string; reason: string }) => {
        const tool = tools.find((t) => t.id === rec.toolId);
        return {
          toolId: rec.toolId,
          toolName: tool?.name || rec.toolId,
          toolDescription: tool?.description || '',
          reason: rec.reason || '',
          exists: !!tool,
        };
      }),
      recommendedSkills: (planData.recommendedSkills || []).map((rec: { skillId: string; reason: string }) => {
        // Try to find skill by ID first
        let skill = skillsList.find((s) => s.id === rec.skillId);
        
        // If not found by ID, try to find by name (in case LLM provided name instead of ID)
        // Check if the skillId looks like it might actually be a name
        if (!skill && rec.skillId) {
          const skillByName = skillsList.find((s) => 
            s.name.toLowerCase().trim() === rec.skillId.toLowerCase().trim()
          );
          if (skillByName) {
            skill = skillByName;
            console.log(`[Plan API] Matched skill by name instead of ID: "${rec.skillId}" -> "${skillByName.id}"`);
          }
        }
        
        // If still not found, the LLM provided an incorrect ID
        return {
          skillId: skill?.id || rec.skillId, // Use actual ID if found, otherwise keep original
          skillName: skill?.name || `Unknown Skill (ID: ${rec.skillId})`,
          skillDescription: skill?.description || '',
          reason: rec.reason || '',
          exists: !!skill,
        };
      }),
      recommendedSteps: (planData.recommendedSteps || []).map((step: any) => {
        // Try to resolve skillId - check if it's actually a name
        let resolvedSkillId = step.skillId || null;
        let resolvedSkillName = '';
        
        if (resolvedSkillId && step.type === 'SKILL') {
          // First try by ID
          let skill = skillsList.find((s) => s.id === resolvedSkillId);
          // If not found, try by name
          if (!skill) {
            const skillByName = skillsList.find((s) => 
              s.name.toLowerCase().trim() === resolvedSkillId.toLowerCase().trim()
            );
            if (skillByName) {
              resolvedSkillId = skillByName.id;
              resolvedSkillName = skillByName.name;
              console.log(`[Plan API] Resolved step skillId by name: "${step.skillId}" -> "${skillByName.id}" (${skillByName.name})`);
            }
          } else {
            resolvedSkillName = skill.name;
          }
        }
        
        return {
          stepNumber: step.stepNumber || 0,
          type: step.type || 'SKILL',
          description: step.description || '',
          skillId: resolvedSkillId,
          skillName: resolvedSkillName, // Include resolved skill name
          inputs: step.inputs || {},
          reason: step.reason || '',
        };
      }),
    };

    return NextResponse.json({ plan: enrichedPlan });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Plan generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}
