'use client';

import { DocumentsList } from '@/components/documents/DocumentsList';
import Link from 'next/link';

export default function DocumentsPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl" style={{ backgroundColor: 'var(--color-background)' }}>
      <div style={{ 
        marginBottom: 'var(--spacing-lg)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <h1 style={{ 
          fontSize: '2.25rem', 
          fontWeight: '700', 
          color: 'var(--color-text)',
          fontFamily: 'Space Grotesk, sans-serif'
        }}>
          My Documents
        </h1>
        <Link
          href="/"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            transition: 'background-color var(--transition-fast)',
            fontSize: '0.875rem',
            textDecoration: 'none',
            fontWeight: '500'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
        >
          Upload New Document
        </Link>
      </div>

      <DocumentsList />
    </main>
  );
}
