import { NextRequest } from 'next/server';
import { getUserId } from '@/lib/auth';
import { checkApplicationAccess } from '@/lib/platform';
import { complianceAnalysisService } from '@/services/compliance-analysis.service';

const APPLICATION_SLUG = 'compliance-analyzer';

/**
 * GET /api/documents/[id]/analyze/stream - Stream analysis progress with Server-Sent Events
 * Uses Server-Sent Events (SSE) to stream progress updates to the client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check application access
    const hasAccess = await checkApplicationAccess(userId, APPLICATION_SLUG);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Application access denied' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get provider from query parameter
    const searchParams = request.nextUrl.searchParams;
    const provider = (searchParams.get('provider') as 'openai' | 'anthropic') || 'openai';

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
          );

          // Run analysis with progress callbacks
          const result = await complianceAnalysisService.analyzeDocumentWithProgress(
            params.id,
            userId,
            (progress) => {
              // Send progress update as SSE
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
              );
            },
            provider
          );

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'completed', result })}\n\n`
            )
          );
          controller.close();
        } catch (error: any) {
          // Send error
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error.message || 'Analysis failed',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to start analysis stream',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
