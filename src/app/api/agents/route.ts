import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createAgent, getAgents } from '@/lib/agent';

/**
 * GET /api/agents
 * List all agents owned by the current user
 */
export async function GET(request: Request) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const agents = await getAgents(user.id);
        return NextResponse.json({ agents });
    } catch (error) {
        console.error('List agents error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/agents
 * Create a new agent
 */
export async function POST(request: Request) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, goal, workflowId, config } = body;

        if (!name || !goal) {
            return NextResponse.json({ error: 'Name and goal are required' }, { status: 400 });
        }

        const agent = await createAgent({
            name,
            description,
            goal,
            ownerId: user.id,
            workflowId,
            config,
        });

        return NextResponse.json({ agent });
    } catch (error) {
        console.error('Create agent error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
