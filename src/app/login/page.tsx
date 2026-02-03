'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      // Redirect to previous page or skills browser
      const returnTo = sessionStorage.getItem('returnTo') || '/skills';
      sessionStorage.removeItem('returnTo');
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <main className="page-content">
        <div
          style={{
            maxWidth: '400px',
            margin: '0 auto',
            paddingTop: 'var(--spacing-2xl)',
          }}
        >
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 700,
              marginBottom: 'var(--spacing-md)',
              fontFamily: 'var(--font-display)',
              color: 'var(--color-text)',
              textAlign: 'center',
            }}
          >
            Sign In
          </h1>

          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
              marginBottom: 'var(--spacing-xl)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Sign in to access your skills and manage the library
          </p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: 'var(--spacing-md)',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-lg)',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-sm)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  fontSize: '1rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                  e.target.style.outline = 'none';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                }}
              />
            </div>

            <div style={{ marginBottom: 'var(--spacing-xl)' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  marginBottom: 'var(--spacing-sm)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  fontSize: '1rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)';
                  e.target.style.outline = 'none';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: 'var(--spacing-md)',
                fontSize: '0.875rem',
                fontWeight: 500,
                background: loading ? 'var(--color-text-muted)' : 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'var(--color-primary-dark)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = 'var(--color-primary)';
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div
            style={{
              marginTop: 'var(--spacing-xl)',
              padding: 'var(--spacing-md)',
              background: 'var(--color-surface-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <strong>Default credentials:</strong>
            <br />
            Admin: admin@puzzel.com / admin123
          </div>
        </div>
      </main>
    </div>
  );
}
