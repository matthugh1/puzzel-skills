'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

/**
 * SSO Callback page
 * Creates a NextAuth session from SSO token and redirects
 */
export default function SSOCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');
  const redirect = searchParams.get('redirect') || '/';

  useEffect(() => {
    console.log('[SSO Callback] Page loaded, userId:', userId, 'email:', email, 'redirect:', redirect);
    
    if (!userId || !email) {
      console.error('[SSO Callback] Missing user information');
      router.push('/auth/login?error=Configuration&message=Missing user information');
      return;
    }

    // Create NextAuth session using credentials provider
    console.log('[SSO Callback] Attempting signIn...');
    signIn('credentials', {
      userId,
      email,
      sso: 'true',
      redirect: false,
    }).then((result) => {
      console.log('[SSO Callback] signIn result:', result);
      if (result?.error) {
        console.error('[SSO Callback] signIn error:', result.error);
        router.push(`/auth/login?error=Configuration&message=${encodeURIComponent(result.error)}`);
      } else {
        console.log('[SSO Callback] signIn successful, redirecting to:', redirect);
        router.push(redirect);
        router.refresh();
      }
    }).catch((error) => {
      console.error('[SSO Callback] signIn exception:', error);
      router.push(`/auth/login?error=Configuration&message=${encodeURIComponent(error.message || 'Sign in failed')}`);
    });
  }, [userId, email, redirect, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-600">
        <p>Completing sign-in...</p>
      </div>
    </div>
  );
}
