'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  formatBuildInfo,
  formatLegModeEmoji,
  formatLegModeLabel,
  formatNextActionLabel,
  formatReadinessLabel,
  formatStatusLabel,
  formatWeatherCondition,
  toDisplayLabel,
} from '@/lib/display-labels.mjs';
import { formatUtcDateRange, formatUtcDateTime } from '@/lib/format-utc.mjs';
import { computeMonitoringPhase } from '@/lib/monitoring-phase.mjs';
import { MonitoringPhaseHelp } from '@/components/monitoring-phase-help';

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
  return formatUtcDateRange(start, end);
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

function WeatherSummaryChip({ weather }) {
  const summary = weather?.summary;
  if (!summary) return null;
  const fallback = formatWeatherCondition(summary.label, { icon: summary.icon });
  const label = summary.accessibleLabel || fallback.accessibleLabel;
  const icons = Array.isArray(summary.icons) && summary.icons.length > 0
    ? summary.icons.slice(0, 2)
    : [summary.icon || fallback.icon];
  return (
    <span className="weather-summary-chip" aria-label={label} title={label}>
      <span className="weather-summary-icons" aria-hidden="true">{icons.join('')}</span>
      <span className="weather-summary-label">{summary.label || fallback.label}</span>
    </span>
  );
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

function DebugDisclosure({ id, title, summary, data, open, onToggle }) {
  const [copyState, setCopyState] = useState('idle');

  function handleCopy() {
    const payload = JSON.stringify(data, null, 2);
    if (!navigator?.clipboard?.writeText) {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2000);
      return;
    }
    navigator.clipboard.writeText(payload).then(
      () => {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      },
      () => {
        setCopyState('failed');
        setTimeout(() => setCopyState('idle'), 2000);
      },
    );
  }

  return (
    <section className="debug-inline-panel" data-debug-disclosure>
      <button
        type="button"
        className="debug-inline-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{open ? '▾' : '▸'} 🛠 {title}</span>
        {summary ? <small>{summary}</small> : null}
      </button>
      {open ? (
        <div className="debug-pre-wrapper">
          <button
            type="button"
            className="debug-copy-btn"
            onClick={handleCopy}
            aria-label={`Copy ${title} debug payload to clipboard`}
          >
            {copyState === 'copied' ? '✓ Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
          </button>
          <pre id={id} className="debug-pre debug-inline-pre">{JSON.stringify(data, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}

function summaryMetricDebug({ key, count, activeFilter, note }) {
  return {
    key,
    count,
    activeFilter: activeFilter ?? 'all',
    note,
    computedFrom: 'already-loaded portfolio.trips in DashboardSessionSurface',
  };
}

function tripSummaryDebug(trip, { index, monitoringPhase }) {
  return {
    id: trip.id,
    index,
    title: trip.title,
    dateRange: { start: trip.start ?? null, end: trip.end ?? null },
    destinationLabel: trip.destinationLabel ?? null,
    status: trip.status ?? null,
    planning: {
      readiness: trip.planning?.readiness ?? null,
      nextAction: trip.planning?.nextAction ?? null,
      hasQuestionsForDanny: Boolean(trip.planning?.questionsForDanny?.length),
      missingCount: trip.planning?.missing?.length ?? 0,
    },
    monitoring: {
      enabled: trip.monitoring?.enabled ?? null,
      active: trip.monitoring?.active ?? null,
      summary: trip.monitoring?.summary ?? null,
      computedPhase: monitoringPhase ? {
        phase: monitoringPhase.phase,
        started: monitoringPhase.started,
        currentPhaseLabel: monitoringPhase.currentPhaseLabel,
      } : null,
    },
    counts: {
      travellers: trip.travellers?.length ?? 0,
      legs: trip.legs?.length ?? 0,
      programme: trip.programme?.length ?? 0,
      notes: trip.notes?.length ?? 0,
    },
    features: {
      hasWeather: Boolean(trip.weather),
      hasNotifications: Boolean(trip.notifications) || Boolean(trip.legs?.some((leg) => leg?.notification)),
      hasAccommodation: Boolean(trip.accommodation),
    },
  };
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
  portfolioMode = null,
  builtAt = null,
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [browserNow, setBrowserNow] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [expandedTripLegs, setExpandedTripLegs] = useState({});
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugExpandedTripIds, setDebugExpandedTripIds] = useState({});
  const sessionMenuRef = useRef(null);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frameId = 0;

    function tickMonitoringClock() {
      frameId = 0;
      setBrowserNow(new Date());
    }

    tickMonitoringClock();
    const intervalId = window.setInterval(tickMonitoringClock, 60_000);

    return () => {
      window.clearInterval(intervalId);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    setActiveFilter(readFilterFromLocation());

    function handlePopState() {
      setActiveFilter(readFilterFromLocation());
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let frameId = 0;

    function getScrollTop() {
      return document.scrollingElement?.scrollTop ?? window.scrollY ?? document.documentElement.scrollTop ?? 0;
    }

    function updateHeaderCompactState() {
      frameId = 0;
      setIsHeaderCompact(getScrollTop() > 24);
    }

    function handleScroll() {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateHeaderCompactState);
    }

    updateHeaderCompactState();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, true);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
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

  function handleSessionMenuToggle() {
    setIsSessionMenuOpen(open => !open);
  }

  function handleSessionMenuClose() {
    setIsSessionMenuOpen(false);
  }

  function handleSessionThemeToggle() {
    handleThemeToggle();
    handleSessionMenuClose();
  }

  function handleSessionSignOut() {
    handleSessionMenuClose();
    handleSignOut();
  }

  function handleToggleDebug() {
    setIsDebugOpen(open => !open);
    handleSessionMenuClose();
  }

  function handleTripDebugToggle(tripId) {
    setDebugExpandedTripIds(prev => ({
      ...prev,
      [tripId]: !prev[tripId],
    }));
  }

  useEffect(() => {
    function handlePointerDown(event) {
      if (!sessionMenuRef.current) return;
      if (!sessionMenuRef.current.contains(event.target)) {
        setIsSessionMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsSessionMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleFilterToggle(filter) {
    const nextFilter = activeFilter === filter ? null : filter;
    setActiveFilter(nextFilter);
    writeFilterToUrl(nextFilter);
  }

  function handleLegExpansionToggle(tripId) {
    setExpandedTripLegs(prev => ({
      ...prev,
      [tripId]: !prev[tripId],
    }));
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
  const buildInfo = formatBuildInfo(builtAt);

  return (
    <main className={`dashboard-shell ${isDebugOpen ? 'debug-mode-active' : ''}`} data-theme={theme} data-debug-mode={isDebugOpen ? 'on' : 'off'}>
      <section aria-labelledby="dashboard-title" className="dashboard-panel">
        <div className={`session-header ${isHeaderCompact ? 'session-header--compact' : ''}`}>
          <div className="session-brand">
            <p className="eyebrow">✈️ Travel intelligence</p>
            <h1 id="dashboard-title" className="dashboard-title">🧭 Tsang Travel</h1>
            <p
              className={`dashboard-subtitle ${isHeaderCompact ? 'dashboard-subtitle--compact' : ''}`}
              aria-hidden={isHeaderCompact}
            >
              Upcoming and active trips from the private travel-planner portfolio.
            </p>
          </div>
          <div className="session-actions" ref={sessionMenuRef}>
            <button
              aria-expanded={isSessionMenuOpen}
              aria-haspopup="menu"
              aria-label={`Open account menu for ${userName}`}
              className="session-user session-user-trigger"
              type="button"
              onClick={handleSessionMenuToggle}
            >
              <span className={`session-user-label ${isHeaderCompact ? 'session-user-label--compact' : 'session-user-label--full'}`}>
                {isHeaderCompact ? userName : `👤 Welcome, ${userName}`}
              </span>
              <span className="session-user-caret" aria-hidden="true">▾</span>
            </button>
            {isSessionMenuOpen ? (
              <div className="session-menu" role="menu" aria-label="Account menu">
                <button
                  aria-label={themeToggleLabel}
                  className="secondary-action session-menu-item theme-toggle"
                  type="button"
                  role="menuitem"
                  onClick={handleSessionThemeToggle}
                >
                  <span className="session-menu-item-icon" aria-hidden="true">
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </span>
                  <span className="session-menu-item-label">{themeToggleLabel}</span>
                </button>
                <button
                  aria-label={isDebugOpen ? 'Turn dashboard debug mode off' : 'Turn dashboard debug mode on'}
                  className="secondary-action session-menu-item session-menu-item--debug"
                  type="button"
                  role="menuitem"
                  aria-pressed={isDebugOpen}
                  onClick={handleToggleDebug}
                >
                  <span className="session-menu-item-icon" aria-hidden="true">🛠</span>
                  <span className="session-menu-item-label">
                    Debug mode {isDebugOpen ? 'on' : 'off'}
                  </span>
                </button>
                <button
                  className="secondary-action session-menu-item session-menu-item--sign-out"
                  type="button"
                  role="menuitem"
                  aria-label="Sign out"
                  onClick={handleSessionSignOut}
                >
                  <span className="session-menu-item-icon" aria-hidden="true">🔐</span>
                  <span className="session-menu-item-label">Sign out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {isDebugOpen ? (
          <section className="debug-global-panel" aria-label="Dashboard debug summary">
            <div className="debug-global-heading">
              <span>🛠 Debug mode</span>
              <strong>Dashboard diagnostics are embedded in-page.</strong>
            </div>
            <dl className="debug-kv-grid">
              <div><dt>Data source</dt><dd>{portfolioMode?.dataSourceLabel || (portfolioMode?.isDemo ? 'Demo data' : 'Live portfolio')}</dd></div>
              <div><dt>Storage configured</dt><dd>{portfolioStorage?.configured === undefined ? 'unknown' : String(portfolioStorage?.configured)}</dd></div>
              <div><dt>Portfolio generated</dt><dd>{generatedAt || 'null'}</dd></div>
              <div><dt>Build timestamp</dt><dd>{builtAt || 'null'}</dd></div>
              <div><dt>Active filter</dt><dd>{activeFilter || 'all'}</dd></div>
              <div><dt>Shown / total trips</dt><dd>{filteredTrips.length} / {trips.length}</dd></div>
            </dl>
          </section>
        ) : null}

        {authConfigurationIncomplete ? (
          <div className="notice notice-warning">
            <strong>⚠️ Authentication configuration incomplete.</strong>
            <span>No trip data is available until the server OIDC configuration is corrected.</span>
          </div>
        ) : portfolioMode?.isDemo ? (
          <div className="notice notice-info">
            <strong>🧪 Demo mode.</strong>
            <span>{portfolioMode.bannerMessage || 'The dashboard is using anonymised static sample trips.'}</span>
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
                {isDebugOpen ? (
                  <small className="metric-debug-line">source: portfolio.trips; filtered: {filteredTrips.length}</small>
                ) : null}
              </article>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'active' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'active'}
                onClick={() => handleFilterToggle('active')}
              >
                <span className="metric-label">🚦 Active</span>
                <strong>{activeTrips}</strong>
                {isDebugOpen ? (
                  <small className="metric-debug-line">predicate: monitoring.active === true</small>
                ) : null}
              </button>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'monitoring' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'monitoring'}
                onClick={() => handleFilterToggle('monitoring')}
              >
                <span className="metric-label">📡 Monitoring</span>
                <strong>{monitorableTrips}</strong>
                {isDebugOpen ? (
                  <small className="metric-debug-line">predicate: monitoring.enabled === true</small>
                ) : null}
              </button>
              <button
                type="button"
                className={`metric-card metric-filter-card ${activeFilter === 'actions' ? 'metric-card-active' : ''}`}
                aria-pressed={activeFilter === 'actions'}
                onClick={() => handleFilterToggle('actions')}
              >
                <span className="metric-label">✅ Actions</span>
                <strong>{blockers}</strong>
                {isDebugOpen ? (
                  <small className="metric-debug-line">predicate: planning.nextAction != null</small>
                ) : null}
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
              {generatedAt ? <span>🕒 Generated {formatUtcDateTime(generatedAt)} UTC</span> : <span>🕒 Not generated yet</span>}
              {portfolioMessage ? <span>ℹ️ {portfolioMessage}</span> : null}
              <span className={`portfolio-build-info ${buildInfo.missing ? 'portfolio-build-info--missing' : ''}`}>
                {buildInfo.label}
              </span>
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
                {filteredTrips.map((trip, tripIndex) => {
                  const legCount = trip.legs?.length || 0;
                  const isLegListExpanded = Boolean(expandedTripLegs[trip.id]);
                  const visibleLegs = isLegListExpanded ? trip.legs : trip.legs?.slice(0, 3);
                  const hiddenLegCount = Math.max(0, legCount - 3);
                  const monitoringPhase = trip.monitoring?.enabled === true ? computeMonitoringPhase(trip, browserNow) : null;
                  const monitoringPhaseTone = monitoringPhase?.started ? 'started' : 'neutral';
                  const isTripDebugOpen = Boolean(debugExpandedTripIds[trip.id]);
                  const tripDebugId = `trip-summary-debug-${trip.id}`;
                  const tripDebugPayload = tripSummaryDebug(trip, { index: tripIndex, monitoringPhase });

                  return (
                    <article className="trip-card" key={trip.id}>
                      <div className="trip-card-header">
                        <Link href={`/trips/${trip.id}`} prefetch={false} className="trip-card-title-link">
                          <p className="trip-date">🗓️ {formatDateRange(trip.start, trip.end)}</p>
                          <h2>{trip.title}</h2>
                          <span className="trip-card-view-details">View trip details →</span>
                        </Link>
                        <span className="status-pill">{statusLabel(trip)}</span>
                        <WeatherSummaryChip weather={trip.weather} />
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
                          <dd className="trip-monitoring-state">
                            {trip.monitoring?.enabled === true ? (
                              <div className={`monitoring-status-row monitoring-status-row--${monitoringPhaseTone}`}>
                                <MonitoringPhaseHelp phase={monitoringPhase.phase} label={monitoringPhase.label} />
                                <span className="monitoring-status-label" aria-label={monitoringPhase.accessibleLabel}>
                                  {monitoringPhase.label}
                                </span>
                                <span className="monitoring-status-phase">Current phase: {monitoringPhase.currentPhaseLabel}</span>
                              </div>
                            ) : (
                              monitoringLabel(trip)
                            )}
                          </dd>
                        </div>
                      </dl>
                      {legCount ? (
                        <div className="trip-card-leg-summary">
                          <ul className="leg-list" aria-label={`${trip.title} legs`}>
                            {visibleLegs.map((leg, index) => (
                              <li key={`${trip.id}-leg-${index}`}>
                                <span>{formatLegModeEmoji(leg.mode)} {leg.label}</span>
                                <small>{formatLegModeLabel(leg.mode)}</small>
                              </li>
                            ))}
                          </ul>
                          {hiddenLegCount > 0 ? (
                            <button
                              type="button"
                              className="leg-list-toggle"
                              aria-expanded={isLegListExpanded}
                              aria-label={`${isLegListExpanded ? 'Show fewer legs for' : 'Show all legs for'} ${trip.title}`}
                              onClick={() => handleLegExpansionToggle(trip.id)}
                            >
                              {isLegListExpanded ? 'Show fewer legs' : `Show ${hiddenLegCount} more leg${hiddenLegCount === 1 ? '' : 's'}`}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {isDebugOpen ? (
                        <DebugDisclosure
                          id={tripDebugId}
                          title="Trip summary debug"
                          summary={`${legCount} legs · ${trip.monitoring?.enabled ? 'monitoring configured' : 'monitoring off'}`}
                          data={tripDebugPayload}
                          open={isTripDebugOpen}
                          onToggle={() => handleTripDebugToggle(trip.id)}
                        />
                      ) : null}
                      <div className="next-action">
                        <span>➡️ Next action</span>
                        <strong>{nextActionLabel(trip)}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
