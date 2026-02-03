import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAgentById, updateAgent, deleteAgent, startAgentRun } from '@/lib/agent';

interface RouteContext {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/agents/:id
 * Get a specific agent by ID
 */
export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const agent = await getAgentById(id);

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ agent });
    } catch (error) {
        console.error('Get agent error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/agents/:id
 * Update an agent's configuration or metadata
 */
export async function PATCH(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const agent = await getAgentById(id);

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updatedAgent = await updateAgent(id, body);
        return NextResponse.json({ agent: updatedAgent });
    } catch (error) {
        console.error('Update agent error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
export async function DELETE(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const agent = await getAgentById(id);

        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        if (agent.ownerId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await deleteAgent(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete agent error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/agents/:id/run
 * Start a new run for an agent
 * Note: We use the same file for simplicity, but could be agents/[id]/run/route.ts
 */
export async function POST(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { initialContext } = body;

        const run = await startAgentRun(id, user.id, initialContext);
        return NextResponse.json({ run });
    } catch (error) {
        console.error('Start agent run error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
