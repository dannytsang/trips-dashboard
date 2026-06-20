'use client';

import { useEffect, useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';

const THEME_STORAGE_KEY = 'tsang-travel-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function AuthSignInPage() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    setTheme(getInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const themeToggleLabel = useMemo(() => 'Toggle theme', []);

  function handleThemeToggle() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          theme === 'dark'
            ? 'radial-gradient(circle at top left, rgba(59, 130, 246, 0.18), transparent 34%), var(--bg-primary)'
            : 'radial-gradient(circle at top left, rgba(37, 99, 235, 0.10), transparent 34%), var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <section
        className="auth-card"
        aria-labelledby="signin-heading"
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          padding: '2rem',
        }}
      >
        <div
          className="auth-card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
            marginBottom: '1.5rem',
          }}
        >
          <div className="auth-card-title">
            <p
              style={{
                margin: 0,
                color: 'var(--accent-emerald)',
                fontWeight: 700,
                fontSize: '0.78rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Tsang Travel
            </p>
            <h1
              id="signin-heading"
              style={{
                margin: '0.35rem 0 0',
                fontSize: '1.85rem',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
              }}
            >
              Sign in for travel intelligence
            </h1>
          </div>
          <button
            type="button"
            onClick={handleThemeToggle}
            aria-label={themeToggleLabel}
            className="secondary-action theme-toggle"
            style={{
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              borderRadius: '999px',
              padding: '0.45rem 0.75rem',
              cursor: 'pointer',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
            marginTop: 0,
          }}
        >
          A private travel intelligence dashboard that summarises upcoming trips, itinerary context, and live monitoring views sourced from the travel planner.
        </p>

        <button
          type="button"
          onClick={() => signIn('authentik', { callbackUrl: '/' })}
          style={{
            width: '100%',
            border: '1px solid var(--accent-emerald)',
            borderRadius: '0.85rem',
            backgroundColor: 'var(--accent-emerald)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 800,
            padding: '0.9rem 1rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          Login to continue
        </button>
      </section>
    </main>
  );
}
