import Link from 'next/link';
import { db } from '@/lib/db';
import { AlignRoadmap } from '@/components/align/AlignRoadmap';

export default async function AlignRoadmapPage() {
  const latestSnapshot = await db.alignmentSnapshot.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  const roadmapItems = latestSnapshot
    ? await db.roadmapItem.findMany({
        where: { snapshotId: latestSnapshot.id },
        orderBy: { priority: 'asc' },
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
              Align: Roadmap
            </h1>
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
            }}>
              Step 3 of Align. Prioritize near-term delivery.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <Link
              href="/align/opportunities"
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
              Back to Opportunities
            </Link>
            <Link
              href="/align"
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
              Back to Align
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
          <AlignRoadmap snapshotId={latestSnapshot.id} roadmapItems={roadmapItems} />
        )}
      </main>
    </div>
  );
}
