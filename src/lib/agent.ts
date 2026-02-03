import { db } from './db';
import { Agent, AgentStatus, Prisma } from '@prisma/client';

/**
 * Creates a new agent
 */
export async function createAgent(data: {
  name: string;
  description?: string;
  goal: string;
  ownerId: string;
  workflowId?: string;
  config?: any;
}) {
  return db.agent.create({
    data,
  });
}

/**
 * Gets all agents for a user
 */
export async function getAgents(ownerId: string) {
  return db.agent.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Gets a specific agent by ID with its recent runs
 */
export async function getAgentById(id: string) {
  return db.agent.findUnique({
    where: { id },
    include: {
      workflow: true,
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Updates an agent's configuration or metadata
 */
export async function updateAgent(id: string, data: Prisma.AgentUpdateInput) {
  return db.agent.update({
    where: { id },
    data,
  });
}

/**
 * Deletes an agent
 */
export async function deleteAgent(id: string) {
  return db.agent.delete({
    where: { id },
  });
}

/**
 * Initiates a new run for an agent
 */
export async function startAgentRun(agentId: string, userId: string, initialContext: any) {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  // Update agent status to RUNNING
  await db.agent.update({
    where: { id: agentId },
    data: { status: AgentStatus.RUNNING },
  });

  return db.agentRun.create({
    data: {
      userId,
      agentId,
      goal: agent.goal,
      initialContext: initialContext || {},
      status: 'PLANNING',
      workflowId: agent.workflowId,
    },
  });
}
