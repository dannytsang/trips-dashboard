'use client';

import { signIn } from 'next-auth/react';

export function AuthSignInPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="signin-heading">
        <p className="eyebrow">Tsang Travel</p>
        <h1 id="signin-heading">Sign in for travel intelligence</h1>
        <p>
          Private trip summaries, itinerary context, and future travel monitoring views are protected by Authentik.
        </p>
        <button className="primary-action" type="button" onClick={() => signIn('authentik', { callbackUrl: '/' })}>
          Continue with Authentik
        </button>
      </section>
    </main>
  );
}
