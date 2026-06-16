'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatLegModeEmoji,
  formatLegModeLabel,
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
    year: 'numeric',
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
  // planning.readiness may already be a short display label (brief builder sets it)
  return trip.planning?.readiness || 'Needs info';
}

function monitoringLabel(trip) {
  if (trip.monitoring?.summary) return toDisplayLabel(trip.monitoring.summary, 'Monitoring status pending');
  if (trip.monitoring?.active) return 'Monitoring active';
  if (trip.monitoring?.enabled) return 'Monitoring configured';
  return 'Monitoring not enabled';
}

function monitoringBadgeClass(trip) {
  if (trip.monitoring?.active) return 'badge-active';
  if (trip.monitoring?.enabled) return 'badge-enabled';
  return 'badge-neutral';
}

function readinessBadgeClass(readiness) {
  const lower = (readiness || '').toLowerCase();
  if (lower === 'finalised') return 'badge-active';
  if (lower === 'confirmed') return 'badge-active';
  if (lower === 'planned') return 'badge-enabled';
  if (lower === 'provisional') return 'badge-neutral';
  if (lower === 'not needed') return 'badge-neutral';
  return 'badge-neutral';
}

function SectionCollapsible({ title, emoji, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!children) return null;

  return (
    <section className="detail-section">
      <button
        type="button"
        className="detail-section-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="detail-section-emoji">{emoji}</span>
        <span className="detail-section-title">{title}</span>
        <span className="detail-section-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="detail-section-body">{children}</div>}
    </section>
  );
}

function DetailSection({ title, emoji, children }) {
  if (!children) return null;
  return (
    <section className="detail-section">
      <div className="detail-section-header">
        <span className="detail-section-emoji">{emoji}</span>
        <h2 className="detail-section-title">{title}</h2>
      </div>
      <div className="detail-section-body">{children}</div>
    </section>
  );
}

function LegRow({ leg, index }) {
  const label = leg.label || 'Unknown leg';
  const mode = leg.mode || 'unknown';
  const cju = leg.contactJourneyUpdate;

  return (
    <li className="leg-detail-row">
      <span className="leg-detail-index">{index + 1}</span>
      <span className="leg-detail-mode">{formatLegModeEmoji(mode)}</span>
      <div className="leg-detail-content">
        <span className="leg-detail-label">{label}</span>
        <span className="leg-detail-sub">{formatLegModeLabel(mode)}</span>
        {cju ? <ContactJourneyUpdateBlock cju={cju} /> : null}
      </div>
      {leg.flight ? (
        <div className="leg-detail-flight">
          {leg.flight.airline} {leg.flight.flightNumber}
          {leg.flight.departLocal ? (
            <span className="leg-detail-time">
              {new Date(leg.flight.departLocal).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {leg.flight.arriveLocal
                ? new Date(leg.flight.arriveLocal).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : '?'}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ContactJourneyUpdateBlock({ cju }) {
  const routing = cju?.routing;
  const recipient = cju?.recipient;
  const keep = cju?.keepInformed;
  const source = routing?.source;
  const destRoute = routing?.destinationRoute;
  const rType = recipient?.type;
  const rName = recipient?.displayName;
  const keepStatus = keep?.status;
  const keepScope = keep?.approvalScope;
  const keepTriggers = Array.isArray(keep?.triggers) ? keep.triggers : [];

  const hasAny = source || rType || rName || keepStatus || destRoute;
  if (!hasAny) return null;

  const sourceLabel = ({
    override: 'Override',
    destination_default: 'Destination route',
    contacts_fallback: 'Contacts fallback',
    none: 'No recipient',
    lookup_failed: 'Lookup failed',
  })[source] || source;

  return (
    <div className="leg-cju">
      <span className="leg-cju-pill" data-source={source || 'unknown'}>
        📨 {sourceLabel}{rName ? `: ${rName}` : rType && rType !== 'none' ? ` (${rType.replace('whatsapp_', 'WhatsApp ')})` : ''}
      </span>
      {destRoute?.status === 'matched' && destRoute.routeName ? (
        <span className="leg-cju-detail">Route: {destRoute.routeName} ({destRoute.matchScope})</span>
      ) : null}
      {keepStatus && keepStatus !== 'not_asked' ? (
        <span className="leg-cju-detail">
          Decision: {keepStatus}{keepScope ? ` — ${keepScope}` : ''}
          {keepTriggers.length ? ` [${keepTriggers.join(', ')}]` : ''}
        </span>
      ) : null}
    </div>
  );
}

export function TripDetailSurface({
  trip,
  tripId,
  authConfigurationIncomplete,
  storageConfigurationIncomplete,
  storageOk,
  notFound,
  errorMessage,
}) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  if (storageConfigurationIncomplete) {
    return (
      <main className="dashboard-shell" data-theme={theme}>
        <section className="detail-not-found">
          <h1>⚠️ Storage not configured</h1>
          <p>Private Blob storage is not available. The detail view requires it.</p>
          <Link href="/" className="back-link">← Back to summary</Link>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="dashboard-shell" data-theme={theme}>
        <section className="detail-not-found">
          <h1>🔍 Trip not found</h1>
          <p>No trip with ID <code>{tripId}</code> was found in the private brief.</p>
          <Link href="/" className="back-link">← Back to summary</Link>
        </section>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="dashboard-shell" data-theme={theme}>
        <section className="detail-not-found">
          <h1>🚨 Error loading trip</h1>
          <p>{errorMessage}</p>
          <Link href="/" className="back-link">← Back to summary</Link>
        </section>
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="dashboard-shell" data-theme={theme}>
        <section className="detail-loading">
          <p>Loading trip details…</p>
          <Link href="/" className="back-link">← Back to summary</Link>
        </section>
      </main>
    );
  }

  const rl = readinessLabel(trip);
  const rbc = readinessBadgeClass(rl);
  const ml = monitoringLabel(trip);
  const mlc = monitoringBadgeClass(trip);

  const hasLegs = trip.legs && trip.legs.length > 0;
  const hasProgramme = trip.programme && trip.programme.length > 0;
  const hasAssumptions = trip.planning?.assumptions && trip.planning.assumptions.length > 0;
  const hasMissing = trip.planning?.missing && trip.planning.missing.length > 0;
  const hasQuestions = trip.planning?.questionsForDanny && trip.planning.questionsForDanny.length > 0;
  const hasNotes = trip.notes && trip.notes.length > 0;
  const hasMonitoringChecks = trip.monitoring?.checks && trip.monitoring.checks.length > 0;
  const hasProgrammeSection = hasProgramme;
  const hasPlanningSection = hasAssumptions || hasMissing || hasQuestions;
  const hasNotesSection = hasNotes;
  const hasMonitoringSection = trip.monitoring?.enabled || trip.monitoring?.active || hasMonitoringChecks;
  const hasMap = hasLegs && trip.legs.filter(l => l.origin || l.destination).length >= 2;

  return (
    <main className="dashboard-shell" data-theme={theme}>
      <section className="detail-panel" aria-label={`Trip detail: ${trip.title}`}>
        {/* Back navigation */}
        <Link href="/" className="back-link">
          ← Back to trip summary
        </Link>

        {/* Header */}
        <header className="detail-header">
          <p className="trip-date">🗓️ {formatDateRange(trip.start, trip.end)}</p>
          <h1 className="detail-title">{trip.title || tripId}</h1>
          <p className="detail-destination">📍 {trip.destinationLabel || 'Destination TBC'}</p>
          <div className="detail-badges">
            <span className={`status-pill ${rbc}`}>{rl}</span>
            <span className={`status-pill ${mlc}`}>{ml}</span>
            <span className="status-pill">{statusLabel(trip)}</span>
          </div>
        </header>

        {/* Theme toggle */}
        <div className="detail-actions">
          <button
            type="button"
            className="secondary-action theme-toggle"
            aria-label={`Switch to ${nextTheme} mode`}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Travellers */}
        <DetailSection title="Travellers" emoji="👥">
          <ul className="traveller-list">
            {(trip.travellers && trip.travellers.length > 0)
              ? trip.travellers.map((t, i) => <li key={i}>{t}</li>)
              : <li className="text-muted">To confirm</li>
            }
          </ul>
        </DetailSection>

        {/* Legs */}
        {hasLegs ? (
          <DetailSection title="Legs" emoji="🛤️">
            <ol className="leg-detail-list">
              {trip.legs.map((leg, i) => (
                <LegRow key={`${trip.id}-leg-${i}`} leg={leg} index={i} />
              ))}
            </ol>
          </DetailSection>
        ) : null}

        {/* Map */}
        <SectionCollapsible title="Map" emoji="🗺️" defaultOpen={hasMap}>
          {hasMap ? (
            <div className="map-placeholder">
              <p className="map-note">🗺️ Map with numbered leg waypoints — Google Maps Static API integration pending</p>
              <ul className="waypoint-list">
                {trip.legs
                  .filter(l => l.origin?.label || l.destination?.label)
                  .map((leg, i) => (
                    <li key={i}>
                      <strong>{i + 1}.</strong>{' '}
                      {leg.origin?.label || '?'} → {leg.destination?.label || '?'}
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">Not enough location data for a map.</p>
          )}
        </SectionCollapsible>

        {/* Programme */}
        {hasProgrammeSection ? (
          <DetailSection title="Programme" emoji="📋">
            <ol className="programme-list">
              {trip.programme.map((item, i) => (
                <li key={i} className={`programme-item ${item.status?.includes('confirmed') ? '' : 'programme-item-unconfirmed'}`}>
                  <div className="programme-item-header">
                    <strong>{item.title}</strong>
                    {item.status && !item.status.includes('confirmed') && (
                      <span className="badge-neutral">{item.status}</span>
                    )}
                  </div>
                  <div className="programme-item-meta">
                    {item.date ? <span>📅 {item.date}</span> : null}
                    {item.time ? <span>🕒 {item.time}</span> : null}
                  </div>
                  {item.location ? <div className="programme-item-location">📍 {item.location}</div> : null}
                  {item.notes ? <p className="programme-item-notes">{item.notes}</p> : null}
                </li>
              ))}
            </ol>
          </DetailSection>
        ) : null}

        {/* Planning rationale */}
        {hasPlanningSection ? (
          <SectionCollapsible title="Planning rationale" emoji="🧩" defaultOpen={false}>
            {hasAssumptions ? (
              <div className="rationale-block">
                <h3 className="rationale-heading">Assumptions</h3>
                <ul className="rationale-list">
                  {trip.planning.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            ) : null}
            {hasMissing ? (
              <div className="rationale-block">
                <h3 className="rationale-heading">Missing</h3>
                <ul className="rationale-list rationale-list-missing">
                  {trip.planning.missing.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            ) : null}
            {hasQuestions ? (
              <div className="rationale-block">
                <h3 className="rationale-heading">Questions for Danny</h3>
                <ul className="rationale-list rationale-list-questions">
                  {trip.planning.questionsForDanny.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            ) : null}
          </SectionCollapsible>
        ) : null}

        {/* Monitoring detail */}
        {hasMonitoringSection ? (
          <SectionCollapsible title="Monitoring detail" emoji="📡" defaultOpen={false}>
            <dl className="monitoring-detail-list">
              {trip.monitoring.enabled !== undefined && (
                <>
                  <dt>Enabled</dt>
                  <dd>{trip.monitoring.enabled ? 'Yes' : 'No'}</dd>
                </>
              )}
              {trip.monitoring.active !== undefined && (
                <>
                  <dt>Active</dt>
                  <dd>{trip.monitoring.active ? 'Yes — checks are running' : 'Not yet active'}</dd>
                </>
              )}
              {trip.monitoring.cadence?.scheduler && (
                <>
                  <dt>Cadence</dt>
                  <dd>{trip.monitoring.cadence.scheduler}</dd>
                </>
              )}
              {trip.monitoring.alertTarget && (
                <>
                  <dt>Alert target</dt>
                  <dd>{trip.monitoring.alertTarget}</dd>
                </>
              )}
              {trip.monitoring.recommendation && (
                <>
                  <dt>Recommendation</dt>
                  <dd>{trip.monitoring.recommendation}</dd>
                </>
              )}
            </dl>
            {hasMonitoringChecks ? (
              <div className="monitoring-checks">
                <h3 className="rationale-heading">Checks</h3>
                <ul className="rationale-list">
                  {trip.monitoring.checks.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            ) : null}
            {trip.monitoring.stopWhen && trip.monitoring.stopWhen.length > 0 ? (
              <div className="monitoring-checks">
                <h3 className="rationale-heading">Stops when</h3>
                <ul className="rationale-list">
                  {trip.monitoring.stopWhen.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            ) : null}
          </SectionCollapsible>
        ) : null}

        {/* Notes */}
        {hasNotesSection ? (
          <SectionCollapsible title="Notes" emoji="📝" defaultOpen={false}>
            <ol className="notes-list">
              {trip.notes.map((note, i) => (
                <li key={i} className="note-item">{note}</li>
              ))}
            </ol>
          </SectionCollapsible>
        ) : null}

      </section>
    </main>
  );
}
