import Link from 'next/link';
import { db } from '@/lib/db';
import { AlignOpportunities } from '@/components/align/AlignOpportunities';

export default async function AlignOpportunitiesPage() {
  const latestSnapshot = await db.alignmentSnapshot.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  const opportunities = latestSnapshot
    ? await db.opportunity.findMany({
        where: { snapshotId: latestSnapshot.id },
        orderBy: { updatedAt: 'desc' },
      })
    : [];

  return (
    <div className="page-container">
      <header className="page-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 'var(--spacing-md)',
        }}>
          <div>
            <h1 style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              margin: 0,
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
            }}>
              Align: Opportunities
            </h1>
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
            }}>
              Step 2 of Align. Capture and score candidate use cases.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <Link
              href="/align"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                border: '1px solid var(--color-border)',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Back to Align
            </Link>
            <Link
              href="/align/wizard"
              style={{
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Start Over
            </Link>
          </div>
        </div>
      </header>

      <main className="page-content" style={{ padding: 'var(--spacing-xl)' }}>
        {!latestSnapshot ? (
          <section style={{
            background: 'var(--color-surface-secondary)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
          }}>
            <strong style={{ color: 'var(--color-text)' }}>No alignment snapshot yet.</strong>
            <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              Start the wizard to create your first alignment baseline.
            </div>
          </section>
        ) : (
          <AlignOpportunities snapshotId={latestSnapshot.id} opportunities={opportunities} />
        )}
      </main>
    </div>
  );
}
