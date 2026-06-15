'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import {
  formatLegModeLabel,
  formatNextActionLabel,
  formatReadinessLabel,
  formatStatusLabel,
  toDisplayLabel,
} from '@/lib/display-labels.mjs';

const THEME_STORAGE_KEY = 'tsang-travel-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function formatDateRange(start, end) {
  if (!start) return 'Date pending';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  if (!endDate || Number.isNaN(endDate.getTime())) {
    return formatter.format(startDate);
  }
  return `${formatter.format(startDate)} → ${formatter.format(endDate)}`;
}

function statusLabel(trip) {
  return formatStatusLabel(trip.status, { active: Boolean(trip.monitoring?.active) });
}

function readinessLabel(trip) {
  return formatReadinessLabel(trip.planning?.readiness);
}

function monitoringLabel(trip) {
  if (trip.monitoring?.summary) return toDisplayLabel(trip.monitoring.summary, 'Monitoring status pending');
  if (trip.monitoring?.active) return 'Monitoring active';
  if (trip.monitoring?.enabled) return 'Monitoring configured';
  return 'Monitoring not enabled';
}

function nextActionLabel(trip) {
  return formatNextActionLabel(trip.planning?.nextAction);
}

function metricValue(projection, predicate) {
  return projection?.trips?.filter(predicate).length || 0;
}

export function DashboardSessionSurface({
  userName,
  authConfigurationIncomplete = false,
  storageConfigurationIncomplete = false,
  projection = null,
  projectionStorage = null,
  projectionStale = false,
  projectionMessage = null,
  projectionError = null,
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
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
    setTheme(current => (current === 'dark' ? 'light' : 'dark'));
  }

  function handleSignOut() {
    setIsSigningOut(true);
    void signOut({ callbackUrl: '/auth/signin?signedOut=1' });
  }

  if (isSigningOut) {
    return (
      <main className="auth-shell" data-auth-state="signing-out">
        <section className="auth-card" aria-labelledby="signout-heading">
          <p className="eyebrow">Tsang Travel</p>
          <h1 id="signout-heading">🔐 Signing out</h1>
          <p>Ending the local dashboard session and returning to the protected sign-in flow.</p>
        </section>
      </main>
    );
  }

  const trips = projection?.trips || [];
  const generatedAt = projection?.generatedAt || null;
  const activeTrips = metricValue(projection, trip => trip.monitoring?.active || trip.status === 'active');
  const monitorableTrips = metricValue(projection, trip => trip.monitoring?.enabled);
  const blockers = metricValue(projection, trip => trip.planning?.nextAction);

  return (
    <main className="dashboard-shell" data-theme={theme}>
      <section aria-labelledby="dashboard-title" className="dashboard-panel">
        <div className="session-header">
          <div>
            <p className="eyebrow">✈️ Travel intelligence</p>
            <h1 id="dashboard-title">🧭 Tsang Travel</h1>
            <p className="dashboard-subtitle">Upcoming and active trips from the private travel-planner projection.</p>
          </div>
          <div className="session-actions">
            <span className="session-user">👤 Welcome, {userName}</span>
            <button
              aria-label={themeToggleLabel}
              className="secondary-action theme-toggle"
              type="button"
              onClick={handleThemeToggle}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="secondary-action" type="button" onClick={handleSignOut}>
              🔐 Sign out
            </button>
          </div>
        </div>

        {authConfigurationIncomplete ? (
          <div className="notice notice-warning">
            <strong>⚠️ Authentication configuration incomplete.</strong>
            <span>No trip data is available until the server OIDC configuration is corrected.</span>
          </div>
        ) : storageConfigurationIncomplete ? (
          <div className="notice notice-warning">
            <strong>⚠️ Projection storage is not configured.</strong>
            <span>The dashboard is protected, but private Blob storage is unavailable.</span>
          </div>
        ) : projectionError ? (
          <div className="notice notice-danger">
            <strong>🚨 Projection unavailable.</strong>
            <span>{projectionError}</span>
          </div>
        ) : (
          <>
            <div className="metric-grid" aria-label="Travel summary metrics">
              <article className="metric-card">
                <span className="metric-label">🧳 Trips shown</span>
                <strong>{trips.length}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">🚦 Active</span>
                <strong>{activeTrips}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">📡 Monitoring</span>
                <strong>{monitorableTrips}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">✅ Actions</span>
                <strong>{blockers}</strong>
              </article>
            </div>

            <div className={`projection-status ${projectionStale ? 'status-warning' : 'status-ok'}`}>
              <span>{projectionStale ? '⚠️ Projection stale' : '✅ Projection current'}</span>
              {generatedAt ? <span>🕒 Generated {new Date(generatedAt).toLocaleString('en-GB')}</span> : <span>🕒 Not generated yet</span>}
              {projectionStorage?.pathname ? <span>🔒 Private manifest: {projectionStorage.pathname}</span> : null}
              {projectionMessage ? <span>ℹ️ {projectionMessage}</span> : null}
            </div>

            {trips.length === 0 ? (
              <div className="empty-state">
                <h2>🛫 No upcoming trips</h2>
                <p>The private projection is reachable, but it does not currently contain upcoming or active trips.</p>
              </div>
            ) : (
              <div className="trip-list" aria-label="Upcoming trips">
                {trips.map(trip => (
                  <article className="trip-card" key={trip.id}>
                    <div className="trip-card-header">
                      <div>
                        <p className="trip-date">🗓️ {formatDateRange(trip.start, trip.end)}</p>
                        <h2>{trip.title}</h2>
                      </div>
                      <span className="status-pill">{statusLabel(trip)}</span>
                    </div>
                    <dl className="trip-details">
                      <div>
                        <dt>📍 Destination</dt>
                        <dd>{trip.destinationLabel}</dd>
                      </div>
                      <div>
                        <dt>👥 Travellers</dt>
                        <dd>{trip.travellers?.length ? trip.travellers.join(', ') : 'To confirm'}</dd>
                      </div>
                      <div>
                        <dt>🧩 Planning</dt>
                        <dd>{readinessLabel(trip)}</dd>
                      </div>
                      <div>
                        <dt>📡 Monitoring</dt>
                        <dd>{monitoringLabel(trip)}</dd>
                      </div>
                    </dl>
                    {trip.legs?.length ? (
                      <ul className="leg-list" aria-label={`${trip.title} legs`}>
                        {trip.legs.slice(0, 3).map((leg, index) => (
                          <li key={`${trip.id}-leg-${index}`}>
                            <span>🛣️ {leg.label}</span>
                            <small>{formatLegModeLabel(leg.mode)}</small>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="next-action">
                      <span>➡️ Next action</span>
                      <strong>{nextActionLabel(trip)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
