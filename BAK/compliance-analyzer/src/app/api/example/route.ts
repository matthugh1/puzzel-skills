import { NextResponse } from 'next/server';
import { checkPermission, checkApplicationAccess } from '@/lib/platform';
import type { ApiResponse } from '@shared/types';

/**
 * Example API route showing how to use platform utilities
 * 
 * This demonstrates:
 * - Getting user ID from request headers (set by auth middleware)
 * - Checking application access
 * - Checking permissions
 */

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Example: Check if user has access to this application
    // Replace 'your-app-slug' with your actual application slug
    const hasAccess = await checkApplicationAccess(userId, 'your-app-slug');
    
    if (!hasAccess) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Application access denied',
        },
        { status: 403 }
      );
    }

    // Example: Check if user has a specific permission
    // Replace 'read-data' with your actual permission slug
    const hasPermission = await checkPermission(userId, 'your-app-slug', 'read-data');

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        userId,
        hasAccess,
        hasPermission,
        message: 'This is an example API route',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
