'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export function DashboardSessionSurface({ userName, authConfigurationIncomplete = false }) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  function handleSignOut() {
    setIsSigningOut(true);
    void signOut({ callbackUrl: '/auth/signin?signedOut=1' });
  }

  if (isSigningOut) {
    return (
      <main className="auth-shell" data-auth-state="signing-out">
        <section className="auth-card" aria-labelledby="signout-heading">
          <p className="eyebrow">Tsang Travel</p>
          <h1 id="signout-heading">Signing out</h1>
          <p>Ending the local dashboard session and returning to the protected sign-in flow.</p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section aria-labelledby="dashboard-title">
        <div className="session-header">
          <div>
            <p className="eyebrow">Travel intelligence</p>
            <h1 id="dashboard-title">🧭 Tsang Travel</h1>
          </div>
          <button className="secondary-action" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
        {authConfigurationIncomplete ? (
          <>
            <p>
              The dashboard is protected, but required OIDC runtime configuration is incomplete. No trip data is available until the server configuration is corrected.
            </p>
            <div className="status status-warning">Authentication configuration incomplete</div>
          </>
        ) : (
          <p>
            Welcome, {userName}. The authenticated dashboard boundary is active. Live trip summaries are loaded only through the protected private projection API.
          </p>
        )}
      </section>
    </main>
  );
}
