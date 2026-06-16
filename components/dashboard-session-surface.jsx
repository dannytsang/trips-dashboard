'use client';

import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  formatLegModeEmoji,
  formatLegModeLabel,
  formatNextActionLabel,
  formatReadinessLabel,
  formatStatusLabel,
  toDisplayLabel,
} from '@/lib/display-labels.mjs';

const THEME_STORAGE_KEY = 'tsang-travel-theme';
const FILTER_QUERY_KEY = 'filter';
const TRIP_FILTERS = {
  active: {
    label: 'Active',
    predicate: trip => trip.monitoring?.active === true,
  },
  monitoring: {
    label: 'Monitoring',
    predicate: trip => trip.monitoring?.enabled === true,
  },
  actions: {
    label: 'Actions',
    predicate: trip => trip.planning?.nextAction != null,
  },
};

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

function metricValue(portfolio, predicate) {
  return portfolio?.trips?.filter(predicate).length || 0;
}

function normaliseFilter(value) {
  return value && Object.hasOwn(TRIP_FILTERS, value) ? value : null;
}

function readFilterFromLocation() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return normaliseFilter(params.get(FILTER_QUERY_KEY));
}

function writeFilterToUrl(filter) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (filter) {
    url.searchParams.set(FILTER_QUERY_KEY, filter);
  } else {
    url.searchParams.delete(FILTER_QUERY_KEY);
  }
  window.history.pushState({}, '', url);
}

export function DashboardSessionSurface({
  userName,
  authConfigurationIncomplete = false,
  storageConfigurationIncomplete = false,
  portfolio = null,
  portfolioStorage = null,
  portfolioStale = false,
  portfolioMessage = null,
  portfolioError = null,
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    setActiveFilter(readFilterFromLocation());

    function handlePopState() {
      setActiveFilter(readFilterFromLocation());
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  function handleFilterToggle(filter) {
    const nextFilter = activeFilter === filter ? null : filter;
    setActiveFilter(nextFilter);
    writeFilterToUrl(nextFilter);
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

  const trips = portfolio?.trips || [];
  const generatedAt = portfolio?.generatedAt || null;
  const activeTrips = metricValue(portfolio, trip => trip.monitoring?.active === true);
  const monitorableTrips = metricValue(portfolio, trip => trip.monitoring?.enabled === true);
  const blockers = metricValue(portfolio, trip => trip.planning?.nextAction != null);
  const filteredTrips = activeFilter ? trips.filter(TRIP_FILTERS[activeFilter].predicate) : trips;
  const activeFilterLabel = activeFilter ? TRIP_FILTERS[activeFilter].label : null;

  return (
    <main className="dashboard-shell" data-theme={theme}>
      <section aria-labelledby="dashboard-title" className="dashboard-panel">
        <div className="session-header">
          <div>
            <p className="eyebrow">✈️ Travel intelligence</p>
            <h1 id="dashboard-title">🧭 Tsang Travel</h1>
            <p className="dashboard-subtitle">Upcoming and active trips from the private travel-planner portfolio.</p>
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
            <strong>⚠️ Portfolio storage is not configured.</strong>
            <span>The dashboard is protected, but private Blob storage is unavailable.</span>
          </div>
        ) : portfolioError ? (
          <div className="notice notice-danger">
            <strong>🚨 Portfolio unavailable.</strong>
            <span>{portfolioError}</span>
          </div>
        ) : (
          <>
            <div className="metric-grid" aria-label="Travel summary metrics">
              <article className="metric-card">
                <span className="metric-label">🧳 Trips shown</span>
                <strong>{trips.length}</strong>
              </article>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'active' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'active'}
                onClick={() => handleFilterToggle('active')}
              >
                <span className="metric-label">🚦 Active</span>
                <strong>{activeTrips}</strong>
              </button>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'monitoring' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'monitoring'}
                onClick={() => handleFilterToggle('monitoring')}
              >
                <span className="metric-label">📡 Monitoring</span>
                <strong>{monitorableTrips}</strong>
              </button>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'actions' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'actions'}
                onClick={() => handleFilterToggle('actions')}
              >
                <span className="metric-label">✅ Actions</span>
                <strong>{blockers}</strong>
              </button>
              {activeFilter ? (
                <button
                  type="button"
                  className="metric-card metric-filter-card metric-show-all"
                  onClick={() => handleFilterToggle(activeFilter)}
                >
                  <span className="metric-label">🧾 Filter active</span>
                  <strong>Show all</strong>
                </button>
              ) : null}
            </div>

            <div className={`portfolio-status ${portfolioStale ? 'status-warning' : 'status-ok'}`}>
              <span>{portfolioStale ? '⚠️ Portfolio stale' : '✅ Portfolio current'}</span>
              {generatedAt ? <span>🕒 Generated {new Date(generatedAt).toLocaleString('en-GB')}</span> : <span>🕒 Not generated yet</span>}
              {portfolioMessage ? <span>ℹ️ {portfolioMessage}</span> : null}
            </div>

            {trips.length === 0 ? (
              <div className="empty-state">
                <h2>🛫 No upcoming trips</h2>
                <p>The private portfolio is reachable, but it does not currently contain upcoming or active trips.</p>
              </div>
            ) : filteredTrips.length === 0 ? (
              <div className="empty-state" aria-live="polite">
                <h2>🔎 No trips match the {activeFilterLabel} filter</h2>
                <p>Try the visible Show all control or click the {activeFilterLabel} card again to return to the chronological trip list.</p>
              </div>
            ) : (
              <div className="trip-list" aria-label={activeFilterLabel ? `${activeFilterLabel} trips` : 'Upcoming trips'}>
                {filteredTrips.map(trip => (
                  <Link href={`/trips/${trip.id}`} prefetch={false} key={trip.id} className="trip-card-link">
                  <article className="trip-card">
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
                            <span>{formatLegModeEmoji(leg.mode)} {leg.label}</span>
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
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
