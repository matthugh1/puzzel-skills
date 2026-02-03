import Link from 'next/link';
import { db } from '@/lib/db';
import { AlignWorkspace } from '@/components/align/AlignWorkspace';

export default async function AlignPage() {
  const latestSnapshot = await db.alignmentSnapshot.findFirst({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: {
          opportunities: true,
          roadmapItems: true,
          coalitionMembers: true,
          guardrailPolicies: true,
        },
      },
    },
  });

  const snapshotDetail = latestSnapshot
    ? await db.alignmentSnapshot.findUnique({
        where: { id: latestSnapshot.id },
        include: {
          opportunities: { orderBy: { updatedAt: 'desc' } },
          roadmapItems: { orderBy: { priority: 'asc' } },
          coalitionMembers: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          guardrailPolicies: { orderBy: { createdAt: 'desc' } },
        },
      })
    : null;

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
              Align
            </h1>
            <p style={{
              margin: 'var(--spacing-xs) 0 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
            }}>
              Establish direction, prioritize opportunities, and define guardrails.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
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
              Start Align Wizard
            </Link>
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
              Go to Opportunities
            </Link>
          </div>
        </div>
      </header>

      <main className="page-content" style={{ padding: 'var(--spacing-xl)' }}>
        {latestSnapshot ? (
          <section
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-xl)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 'var(--spacing-lg)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                Latest Snapshot
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                {latestSnapshot.title}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
                Status: {latestSnapshot.status}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Opportunities: {latestSnapshot._count.opportunities}
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Roadmap: {latestSnapshot._count.roadmapItems}
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Coalition: {latestSnapshot._count.coalitionMembers}
              </div>
              <div style={{ color: 'var(--color-text-secondary)' }}>
                Guardrails: {latestSnapshot._count.guardrailPolicies}
              </div>
            </div>
          </section>
        ) : (
          <section
            style={{
              background: 'var(--color-surface-secondary)',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-xl)',
            }}
          >
            <strong style={{ color: 'var(--color-text)' }}>No alignment snapshot yet.</strong>
            <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)' }}>
              Start the wizard to create your first alignment baseline.
            </div>
          </section>
        )}

        {snapshotDetail && (
          <AlignWorkspace
            snapshot={latestSnapshot}
            opportunities={snapshotDetail.opportunities}
            roadmapItems={snapshotDetail.roadmapItems}
            coalitionMembers={snapshotDetail.coalitionMembers}
            guardrailPolicies={snapshotDetail.guardrailPolicies}
          />
        )}
      </main>
    </div>
  );
}
