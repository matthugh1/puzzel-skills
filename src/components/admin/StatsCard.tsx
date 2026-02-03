'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: string;
}

export function StatsCard({ title, value, subtitle, trend, icon }: StatsCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              margin: 0,
              marginBottom: 'var(--spacing-xs)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              fontFamily: 'var(--font-display)',
            }}
          >
            {value}
          </p>
          {subtitle && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-muted)',
                margin: 0,
                marginTop: 'var(--spacing-xs)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            style={{
              fontSize: '2rem',
              color: 'var(--color-primary)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div
          style={{
            fontSize: '0.75rem',
            color: trend.value >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            marginTop: 'var(--spacing-xs)',
          }}
        >
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
        </div>
      )}
    </div>
  );
}
