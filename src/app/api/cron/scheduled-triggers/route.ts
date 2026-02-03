/**
 * GET /api/cron/scheduled-triggers
 * Vercel Cron endpoint for checking scheduled triggers
 * Can also be called manually for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAndTriggerScheduledWorkflows } from '@/lib/workers/scheduler';

export async function GET(request: NextRequest) {
  // Verify cron secret (if using Vercel Cron)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await checkAndTriggerScheduledWorkflows();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cron scheduled triggers error:', error);
    return NextResponse.json(
      { error: 'Failed to check scheduled triggers' },
      { status: 500 }
    );
  }
}
