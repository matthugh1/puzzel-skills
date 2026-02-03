'use client';

import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root providers wrapper
 * Will be expanded to include:
 * - Auth provider (JOB-03)
 * - Theme provider (if needed)
 * - Query client (if using react-query)
 */
export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}
