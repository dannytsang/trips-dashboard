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
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const themeToggleLabel = useMemo(
    () => `Switch to ${nextTheme} mode`,
    [nextTheme],
  );

  function handleThemeToggle() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  return (
    <main className="auth-shell" data-theme={theme}>
      <section className="auth-card" aria-labelledby="signin-heading">
        <p className="eyebrow">Tsang Travel</p>
        <h1 id="signin-heading">Sign in for travel intelligence</h1>
        <p>
          A private travel intelligence dashboard that summarises upcoming trips, itinerary context, and live monitoring views sourced from the travel planner.
        </p>
        <button className="primary-action" type="button" onClick={() => signIn('authentik', { callbackUrl: '/' })}>
          Continue with Authentik
        </button>
        <button
          aria-label={themeToggleLabel}
          className="secondary-action theme-toggle"
          type="button"
          onClick={handleThemeToggle}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </section>
    </main>
  );
}
