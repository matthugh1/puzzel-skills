import { NextResponse } from 'next/server';
import { db } from '@shared/database';
import type { ApiResponse } from '@shared/types';

/**
 * GET /api/providers
 * Get list of configured LLM providers with their enabled status
 * This endpoint doesn't require admin access - it just checks which providers are configured
 */
export async function GET() {
  try {
    const providers = await db.llmProvider.findMany({
      select: {
        provider: true,
        enabled: true,
      },
    });

    // Return all configured providers with their status
    const providerList = providers.map(p => ({
      provider: p.provider as 'openai' | 'anthropic',
      enabled: p.enabled,
    }));

    // Return all configured providers (not just enabled) so dropdown can show all options
    // The backend will validate and return clear error if user tries to use disabled provider
    const allConfiguredProviders = providerList.map(p => p.provider);
    
    // Also return enabled ones separately for reference
    const enabledProviders = providerList
      .filter(p => p.enabled)
      .map(p => p.provider);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        providers: allConfiguredProviders.length > 0 ? allConfiguredProviders : ['openai', 'anthropic'], // Show all configured, or both if none configured
        enabledProviders, // Enabled providers for reference
        allProviders: providerList, // All with status for future use
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching available providers:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
