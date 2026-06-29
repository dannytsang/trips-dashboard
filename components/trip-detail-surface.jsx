'use client';
// v6 (spec 010 FR-041 + FR-042): each leg is a LegCollapsible —
// collapsed to its header line by default, expanded on click.
// FR-042 also adds a TripOverviewMap above the leg list, showing
// all legs on a single embedded map (one pin per leg destination).
// Nudge commit to fire Vercel rebuild (empty commits are skipped by vercel-ignore-build.sh).
// FR-042 Final: TripOverviewMap uses the Google Maps JavaScript API
// (@googlemaps/js-api-loader) — one interactive map showing all legs as
// colored polylines (one per leg, colour-coded by transport mode) plus
// numbered circle/square markers at each endpoint. Map auto-fits its bounds
// to show all legs. OSM users see nothing from TripOverviewMap (provider
// guard returns null) — OSM has no free multi-leg map renderer.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  formatLegModeEmoji,
  formatLegModeLabel,
  formatStatusLabel,
  formatWeatherCondition,
  toDisplayLabel,
} from '@/lib/display-labels.mjs';
import { LegRouteMap } from '@/components/leg-route-map';
import { TripOverviewMap } from '@/components/trip-overview-map';
import {
  formatUtcDateRange,
  formatUtcWeekdayDateTime,
  formatUtcDateTime,
  formatUtcTime,
} from '@/lib/format-utc.mjs';
import { computeMonitoringPhase } from '@/lib/monitoring-phase.mjs';
import { MonitoringPhaseHelp } from '@/components/monitoring-phase-help';

const THEME_STORAGE_KEY = 'tsang-travel-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// "Fri 3 Jul" or "Fri 3 Jul → Sat 4 Jul"
function formatDateRange(start, end) {
  return formatUtcDateRange(start, end);
}

function statusLabel(trip) {
  return formatStatusLabel(trip.status, { active: Boolean(trip.monitoring?.active) });
}

function readinessLabel(trip) {
  // planning.readiness may already be a short display label (portfolio builder sets it)
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

const ACCOMMODATION_STATUS_LABELS = {
  available_paid_addon: 'Available (paid addon)',
  not_purchased: 'Not purchased',
  not_applicable: 'Not applicable',
};

function accommodationStatusLabel(value) {
  if (!value) return null;
  return ACCOMMODATION_STATUS_LABELS[value] || value;
}

function formatWeatherMetaTime(value) {
  if (!value) return null;
  try {
    return formatUtcDateTime(value);
  } catch (err) {
    return value;
  }
}

function WeatherDetailSection({ weather }) {
  if (!weather) return null;
  const summary = weather.summary;
  const periods = Array.isArray(weather.periods) ? weather.periods : [];
  const hasAvailableForecast = weather.status === 'available' && (summary || periods.length > 0);
  const statusLabel = toDisplayLabel(weather.status, 'Weather unavailable');
  const generated = formatWeatherMetaTime(weather.generatedAt || weather.updatedAt);
  const coverageNote = weather.coverageNote || (!hasAvailableForecast ? 'Forecast is not available for this trip window yet.' : null);

  return (
    <SectionCollapsible title="Weather" emoji="🌦️" defaultOpen={true}>
      <div className="weather-detail-card">
        <div className="weather-detail-meta">
          {summary ? (
            <span className="weather-detail-summary" aria-label={summary.accessibleLabel || formatWeatherCondition(summary.label, { icon: summary.icon }).accessibleLabel}>
              <span aria-hidden="true">{summary.icon || formatWeatherCondition(summary.label).icon}</span>
              <strong>{summary.label || formatWeatherCondition(summary.label).label}</strong>
            </span>
          ) : (
            <span className="weather-detail-summary weather-detail-summary-muted">🌡️ {statusLabel}</span>
          )}
          {weather.locationLabel ? <span>📍 {weather.locationLabel}</span> : null}
          {weather.source ? <span>Source: {weather.source}</span> : null}
          {generated ? <span>Updated {generated} UTC</span> : null}
        </div>
        {coverageNote ? <p className="weather-coverage-note">{coverageNote}</p> : null}
        {periods.length > 0 ? (
          <ol className="weather-period-list">
            {periods.map((period, index) => {
              const condition = formatWeatherCondition(period.label, { icon: period.icon });
              const temp = [period.temperatureMinC, period.temperatureMaxC].filter(v => v !== undefined && v !== null).join('–');
              const temperature = period.temperature || (temp ? `${temp}°C` : null);
              const precipitation = period.precipitation
                || (period.precipitationChancePercent !== undefined ? `${period.precipitationChancePercent}% precipitation` : null)
                || (period.precipitationAmountMm !== undefined ? `${period.precipitationAmountMm} mm` : null);
              const wind = period.wind
                || [period.windSpeedMph !== undefined ? `${period.windSpeedMph} mph` : null, period.windDirection].filter(Boolean).join(' ')
                || null;
              return (
                <li key={`${period.periodLabel || period.start || 'period'}-${index}`} className="weather-period-row">
                  <div className="weather-period-heading">
                    <span aria-hidden="true">{period.icon || condition.icon}</span>
                    <strong>{period.periodLabel || period.start || `Period ${index + 1}`}</strong>
                    <span>{period.label || condition.label}</span>
                  </div>
                  <dl className="weather-period-facts">
                    {temperature ? <><dt>Temp</dt><dd>{temperature}</dd></> : null}
                    {precipitation ? <><dt>Rain</dt><dd>{precipitation}</dd></> : null}
                    {wind ? <><dt>Wind</dt><dd>{wind}</dd></> : null}
                  </dl>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </SectionCollapsible>
  );
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

function DetailDebugDisclosure({ id, title, summary, data, open, onToggle }) {
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

function buildTripDetailDebugPayload(trip, { tripId, dashboardMode, monitoringPhase }) {
  return {
    id: trip?.id ?? tripId,
    title: trip?.title ?? null,
    route: `/trips/${tripId}`,
    dashboardMode: dashboardMode?.isDemo ? 'demo' : 'live',
    status: trip?.status ?? null,
    dateRange: { start: trip?.start ?? null, end: trip?.end ?? null },
    destinationLabel: trip?.destinationLabel ?? null,
    counts: {
      travellers: trip?.travellers?.length ?? 0,
      legs: trip?.legs?.length ?? 0,
      programme: trip?.programme?.length ?? 0,
      assumptions: trip?.planning?.assumptions?.length ?? 0,
      missing: trip?.planning?.missing?.length ?? 0,
      questionsForDanny: trip?.planning?.questionsForDanny?.length ?? 0,
      notes: trip?.notes?.length ?? 0,
    },
    planning: {
      readiness: trip?.planning?.readiness ?? null,
      nextAction: trip?.planning?.nextAction ?? null,
      transportDecisionMode: trip?.planning?.transportDecision?.selectedMode ?? null,
    },
    monitoring: {
      enabled: trip?.monitoring?.enabled ?? null,
      active: trip?.monitoring?.active ?? null,
      summary: trip?.monitoring?.summary ?? null,
      computedPhase: monitoringPhase ? {
        phase: monitoringPhase.phase,
        started: monitoringPhase.started,
        currentPhaseLabel: monitoringPhase.currentPhaseLabel,
      } : null,
    },
    sections: {
      weather: Boolean(trip?.weather),
      notifications: Boolean(trip?.notifications) || Boolean(trip?.legs?.some((leg) => leg?.notification)),
      accommodation: Boolean(trip?.accommodation),
    },
  };
}

function LegCollapsible({ leg, index }) {
  const [open, setOpen] = useState(false);
  const label = leg.label || 'Unknown leg';
  const mode = leg.mode || 'unknown';
  const cju = leg.contactJourneyUpdate;
  const notif = leg.notification;
  const review = leg.planningReview;

  return (
    <li className="leg-collapsible-row">
      <button
        type="button"
        className="leg-collapsible-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="leg-detail-index">{index + 1}</span>
        <span className="leg-detail-mode">{formatLegModeEmoji(mode)}</span>
        <span className="leg-detail-label">{label}</span>
        <span className="leg-detail-sub">{formatLegModeLabel(mode)}</span>
        <span className="leg-collapsible-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="leg-collapsible-body">
          <div className="leg-detail-content">
            <LegDetailBlock leg={leg} />
            {cju ? <ContactJourneyUpdateBlock cju={cju} /> : null}
            {notif ? <NotificationBlock notif={notif} /> : null}
            {review ? <PlanningReviewBlock review={review} /> : null}
            <LegRouteMap leg={leg} />
          </div>
          {leg.flight ? (
            <div className="leg-detail-flight">
              {leg.flight.airline} {leg.flight.flightNumber}
              {leg.flight.departLocal ? (
                <span className="leg-detail-time">
                  {formatUtcTime(leg.flight.departLocal)}
                  {' → '}
                  {leg.flight.arriveLocal
                    ? formatUtcTime(leg.flight.arriveLocal)
                    : '?'}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </li>
  );
}

function LegDetailBlock({ leg }) {
  const fields = [];
  if (leg.origin?.label) {
    fields.push({ key: 'from', label: 'From', value: leg.origin.label });
  }
  if (leg.destination?.label) {
    fields.push({ key: 'to', label: 'To', value: leg.destination.label });
  }
  if (leg.target_arrival) {
    fields.push({ key: 'target_arrival', label: 'Target arrival', value: leg.target_arrival });
  }
  if (leg.planned_departure) {
    fields.push({ key: 'planned_departure', label: 'Planned departure', value: leg.planned_departure });
  }
  if (leg.estimated_drive) {
    fields.push({ key: 'estimated_drive', label: 'Estimated drive', value: leg.estimated_drive });
  }
  if (leg.buffer) {
    fields.push({ key: 'buffer', label: 'Buffer', value: leg.buffer });
  }
  if (leg.departure_preference) {
    fields.push({ key: 'departure_preference', label: 'Departure preference', value: leg.departure_preference });
  }
  if (leg.timing_basis) {
    fields.push({ key: 'timing_basis', label: 'Why this leg', value: leg.timing_basis });
  }
  if (leg.transport_status) {
    fields.push({ key: 'transport_status', label: 'Status', value: leg.transport_status.replace(/_/g, ' ') });
  }
  const sources = Array.isArray(leg.monitoring_sources) ? leg.monitoring_sources.filter(Boolean) : [];

  if (fields.length === 0 && sources.length === 0) return null;

  return (
    <div className="leg-detail-block">
      {fields.length > 0 ? (
        <dl className="leg-detail-fields">
          {fields.map((f) => (
            <div key={f.key} className="leg-detail-field">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {sources.length > 0 ? (
        <div className="leg-detail-sources">
          <span className="leg-detail-sources-label">Monitoring:</span>
          {sources.map((s, i) => (
            <span key={`${s}-${i}`} className="leg-detail-source-pill">{s}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NextActionCallout({ nextAction }) {
  if (!nextAction) return null;
  return (
    <div className="detail-callout detail-callout-next-action">
      <span className="detail-callout-arrow">→</span>
      <span className="detail-callout-label">Next action</span>
      <span className="detail-callout-body">{nextAction}</span>
    </div>
  );
}

function TransportDecisionCallout({ decision }) {
  if (!decision || !decision.selectedMode) return null;
  const basis = decision.bestOptionBasis || {};
  const basisKeys = Object.keys(basis).filter((k) => basis[k]);
  const confidence = decision.recommendationConfidence
    ? toDisplayLabel(decision.recommendationConfidence, '')
    : '';
  return (
    <SectionCollapsible title="Transport decision" emoji="🚦" defaultOpen={true}>
      <p className="transport-decision-mode">
        Selected: <strong>{toDisplayLabel(decision.selectedMode, 'Mode pending')}</strong>
        {confidence ? (
          <span className="transport-decision-confidence"> ({confidence})</span>
        ) : null}
      </p>
      {basisKeys.length > 0 ? (
        <ul className="transport-decision-basis">
          {basisKeys.map((k) => (
            <li key={k}>
              <strong>{toDisplayLabel(k, k)}:</strong>{' '}
              {basis[k]}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCollapsible>
  );
}

function hasAccommodationContent(accommodation) {
  if (!accommodation || typeof accommodation !== 'object') {
    return false;
  }
  const booking = accommodation.booking || {};
  return Boolean(
    accommodation.provider
    || accommodation.address
    || accommodation.check_in
    || accommodation.checkout
    || accommodation.reception
    || accommodation.parking
    || accommodation.nearby_transport
    || booking.reservation_number
    || booking.nights
    || booking.calendar_event_span
    || booking.actual_stay_window
  );
}

function AccommodationSection({ accommodation }) {
  const hasAccommodation = hasAccommodationContent(accommodation);
  const b = accommodation?.booking || {};
  const earlyLabel = accommodationStatusLabel(accommodation?.early_check_in_status);
  const lateLabel = accommodationStatusLabel(accommodation?.late_checkout_status);
  const hasAccommodationDetails = Boolean(
    accommodation?.provider
    || accommodation?.address
    || accommodation?.check_in
    || accommodation?.checkout
    || earlyLabel
    || lateLabel
    || accommodation?.reception
    || accommodation?.parking
    || accommodation?.nearby_transport
    || b?.reservation_number
    || b?.nights
    || b?.calendar_event_span
    || b?.actual_stay_window
  );
  return (
    <SectionCollapsible title="Accommodation" emoji="🏨" defaultOpen={hasAccommodation}>
      {hasAccommodation ? (
        <>
          {hasAccommodationDetails ? (
            <dl className="accommodation-detail-list">
              {accommodation.provider ? (
                <>
                  <dt>Provider</dt>
                  <dd>{accommodation.provider}</dd>
                </>
              ) : null}
              {accommodation.address ? (
                <>
                  <dt>Address</dt>
                  <dd>{accommodation.address}</dd>
                </>
              ) : null}
              {accommodation.check_in ? (
                <>
                  <dt>Check-in</dt>
                  <dd>{formatDateTime(accommodation.check_in)}</dd>
                </>
              ) : null}
              {accommodation.checkout ? (
                <>
                  <dt>Checkout</dt>
                  <dd>{formatDateTime(accommodation.checkout)}</dd>
                </>
              ) : null}
              {earlyLabel ? (
                <>
                  <dt>Early check-in</dt>
                  <dd>{earlyLabel}</dd>
                </>
              ) : null}
              {lateLabel ? (
                <>
                  <dt>Late checkout</dt>
                  <dd>{lateLabel}</dd>
                </>
              ) : null}
              {accommodation.reception ? (
                <>
                  <dt>Reception</dt>
                  <dd>{accommodation.reception}</dd>
                </>
              ) : null}
              {accommodation.parking ? (
                <>
                  <dt>Parking</dt>
                  <dd>{accommodation.parking}</dd>
                </>
              ) : null}
              {accommodation.nearby_transport ? (
                <>
                  <dt>Nearby transport</dt>
                  <dd>{accommodation.nearby_transport}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted">Accommodation details are pending.</p>
          )}
          {b && (b.nights || b.reservation_number || b.calendar_event_span || b.actual_stay_window) ? (
            <div className="rationale-block accommodation-booking-block">
              <h3 className="rationale-heading">Booking</h3>
              <dl className="accommodation-detail-list">
                {b.reservation_number ? (
                  <>
                    <dt>Reservation</dt>
                    <dd>{b.reservation_number}</dd>
                  </>
                ) : null}
                {b.nights ? (
                  <>
                    <dt>Nights</dt>
                    <dd>{b.nights}</dd>
                  </>
                ) : null}
                {b.calendar_event_span ? (
                  <>
                    <dt>Calendar span</dt>
                    <dd>{b.calendar_event_span}</dd>
                  </>
                ) : null}
                {b.actual_stay_window ? (
                  <>
                    <dt>Stay window</dt>
                    <dd>{b.actual_stay_window}</dd>
                  </>
                ) : null}
              </dl>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-muted">No accommodation recorded for this trip.</p>
      )}
    </SectionCollapsible>
  );
}

function formatDateTime(iso) {
  if (!iso) return null;
  try {
    return formatUtcWeekdayDateTime(iso);
  } catch (err) {
    return iso;
  }
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

function NotificationBlock({ notif }) {
  const pol = notif?.policy;
  const st = notif?.state;
  if (!pol && !st) return null;
  const policyBits = [];
  if (pol?.enabled === false) {
    policyBits.push(<span key="off" className="leg-notif-pill" data-state="off">🔕 Disabled</span>);
  } else if (pol?.enabled === true) {
    policyBits.push(<span key="on" className="leg-notif-pill" data-state="on">🔔 Enabled</span>);
  }
  if (pol?.approvalPolicy) {
    policyBits.push(<span key="ap" className="leg-notif-detail">Approval: {pol.approvalPolicy.replace(/_/g, ' ')}</span>);
  }
  if (typeof pol?.etaChangeThresholdMinutes === 'number') {
    policyBits.push(<span key="eta" className="leg-notif-detail">ETA threshold: {pol.etaChangeThresholdMinutes}m</span>);
  }
  if (Array.isArray(pol?.enabledTriggers) && pol.enabledTriggers.length) {
    policyBits.push(
      <span key="tr" className="leg-notif-detail">
        Triggers: {pol.enabledTriggers.map(t => t.replace('send_on_', '')).join(', ')}
      </span>
    );
  }
  if (pol?.arrivalWhatsappPolicy) {
    policyBits.push(
      <span key="arr" className="leg-notif-detail">Arrival: {pol.arrivalWhatsappPolicy.replace(/_/g, ' ')}</span>
    );
  }

  const stateBits = [];
  if (st?.journeyStart?.status) {
    stateBits.push(
      <span key="js" className="leg-notif-detail">
        Journey start: {st.journeyStart.status}
        {st.journeyStart.sentAt ? ` @ ${formatUtcTime(st.journeyStart.sentAt)}` : ''}
      </span>
    );
  }
  if (typeof st?.updatesSentCount === 'number' && st.updatesSentCount > 0) {
    stateBits.push(<span key="sent" className="leg-notif-detail">Sent: {st.updatesSentCount}</span>);
  }
  if (typeof st?.suppressedCount === 'number' && st.suppressedCount > 0) {
    stateBits.push(<span key="sup" className="leg-notif-detail">Suppressed: {st.suppressedCount}</span>);
  }
  if (typeof st?.queuedCount === 'number' && st.queuedCount > 0) {
    stateBits.push(<span key="q" className="leg-notif-detail">Queued: {st.queuedCount}</span>);
  }
  if (st?.lastSentAt) {
    stateBits.push(
      <span key="lsa" className="leg-notif-detail">
        Last: {formatUtcDateTime(st.lastSentAt)}
      </span>
    );
  }

  if (policyBits.length === 0 && stateBits.length === 0) return null;

  return (
    <div className="leg-notif">
      {policyBits}
      {stateBits.length > 0 ? <div className="leg-notif-row">{stateBits}</div> : null}
    </div>
  );
}

// FR-048..FR-052 (spec 010 v8): trip-level Notifications section.
// Aggregates the per-leg preapproval summary table (from the existing
// `leg.notification.policy` projection, spec 006) with an optional
// trip-level `trip.notifications` policy block (from the new
// `notifications_projection()` in the brief builder). The section is
// read-only, display-only, and is omitted entirely when the trip has
// no notification data at all (no per-leg blocks AND no
// trip.notifications block) — consistent with FR-005.
//
// Status pill logic (FR-049):
//   policy.enabled === true && approvalPolicy === 'all_or_nothing_leg_preapproval_required'
//     → 🔔 Pre-approved (all-or-nothing)
//   policy.enabled === false
//     → 🔕 Disabled
//   otherwise
//     → ❓ Pending decision

const NOTIFICATION_STATUS_LABELS = {
  pre_approved: '🔔 Pre-approved (all-or-nothing)',
  disabled: '🔕 Disabled',
  pending: '❓ Pending decision',
};

function notificationStatusKey(policy) {
  if (!policy) return 'pending';
  if (policy.enabled === false) return 'disabled';
  if (
    policy.enabled === true
    && policy.approvalPolicy === 'all_or_nothing_leg_preapproval_required'
  ) {
    return 'pre_approved';
  }
  return 'pending';
}

function NotificationsSection({ notifications, legs }) {
  const legRows = Array.isArray(legs) ? legs : [];
  const legsWithNotif = legRows
    .map((leg, index) => ({ leg, index }))
    .filter(({ leg }) => leg && leg.notification);
  const hasTripNotif = notifications
    && typeof notifications === 'object'
    && Object.keys(notifications).length > 0;
  if (!hasTripNotif && legsWithNotif.length === 0) return null;

  return (
    <SectionCollapsible title="Notifications" emoji="🔔" defaultOpen={true}>
      {hasTripNotif ? (
        <div className="rationale-block notifications-policy-block">
          <h3 className="rationale-heading">Notification policy</h3>
          <dl className="notifications-policy-list">
            {notifications.defaultApprovalPolicy ? (
              <>
                <dt>Default approval</dt>
                <dd>{notifications.defaultApprovalPolicy.replace(/_/g, ' ')}</dd>
              </>
            ) : null}
            {notifications.defaultArrivalWhatsappPolicy ? (
              <>
                <dt>Arrival WhatsApp</dt>
                <dd>{notifications.defaultArrivalWhatsappPolicy.replace(/_/g, ' ')}</dd>
              </>
            ) : null}
            {typeof notifications.defaultEtaChangeThresholdMinutes === 'number' ? (
              <>
                <dt>ETA change threshold</dt>
                <dd>{notifications.defaultEtaChangeThresholdMinutes} minutes</dd>
              </>
            ) : null}
            {Array.isArray(notifications.defaultEnabledTriggers)
              && notifications.defaultEnabledTriggers.length > 0 ? (
                <>
                  <dt>Default triggers</dt>
                  <dd>
                    {notifications.defaultEnabledTriggers
                      .map((t) => t.replace('send_on_', ''))
                      .join(', ')}
                  </dd>
                </>
              ) : null}
            {notifications.defaultMessageStyle ? (
              <>
                <dt>Message style</dt>
                <dd>{notifications.defaultMessageStyle.replace(/_/g, ' ')}</dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}
      {legsWithNotif.length > 0 ? (
        <div className="notifications-perleg">
          <h3 className="rationale-heading">Per-leg preapproval</h3>
          <ol className="notifications-perleg-list">
            {legsWithNotif.map(({ leg, index }) => {
              const statusKey = notificationStatusKey(leg.notification?.policy);
              const statusLabel = NOTIFICATION_STATUS_LABELS[statusKey];
              const rawApproval = leg.notification?.policy?.approvalPolicy;
              const enabledTriggers = Array.isArray(leg.notification?.policy?.enabledTriggers)
                ? leg.notification.policy.enabledTriggers
                : [];
              return (
                <li
                  key={`notif-leg-${index}`}
                  className="notifications-perleg-row"
                  data-state={statusKey}
                >
                  <span className="leg-detail-index">{index + 1}</span>
                  <span className="leg-detail-mode">{formatLegModeEmoji(leg.mode)}</span>
                  <span className="leg-detail-label">{leg.label || 'Unknown leg'}</span>
                  <span className="notifications-perleg-pill" data-state={statusKey}>
                    {statusLabel}
                  </span>
                  {rawApproval ? (
                    <span className="notifications-perleg-detail">
                      Approval policy: {rawApproval.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                  {enabledTriggers.length > 0 ? (
                    <span className="notifications-perleg-detail">
                      Triggers: {enabledTriggers.map((t) => t.replace('send_on_', '')).join(', ')}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </SectionCollapsible>
  );
}

function PlanningReviewBlock({ review }) {
  const action = review?.action;
  const drafts = review?.drafts;
  if (!action && !drafts) return null;

  const actionStatus = action?.status;
  const actionStatusLabel = ({
    pending: 'Pending decision',
    approved: 'Approved',
    declined: 'Declined',
    blocked_missing_recipient: 'Blocked — missing recipient',
    not_applicable: 'Not applicable',
  })[actionStatus] || actionStatus;

  const bits = [];
  if (action && actionStatus) {
    bits.push(
      <span
        key="ra"
        className="leg-review-pill"
        data-state={actionStatus}
        title={action.question || ''}
      >
        📋 {actionStatusLabel}
      </span>
    );
  }
  if (action?.shownAt) {
    bits.push(
      <span key="rs" className="leg-review-detail">
        Shown: {formatUtcDateTime(action.shownAt)}
      </span>
    );
  }
  if (action?.decidedAt) {
    bits.push(
      <span key="rd" className="leg-review-detail">
        Decided: {formatUtcDateTime(action.decidedAt)}
        {action.decidedBy ? ` by ${action.decidedBy}` : ''}
      </span>
    );
  }
  if (action?.includeInItinerary === false) {
    bits.push(<span key="rii" className="leg-review-detail">Excluded from itinerary</span>);
  }

  const draftBits = [];
  if (drafts?.count) {
    draftBits.push(
      <span key="dc" className="leg-review-detail">
        Drafts: {drafts.count}
        {drafts.statuses?.length ? ` (${drafts.statuses.join(', ')})` : ''}
      </span>
    );
    if (drafts.templateVersions?.length) {
      draftBits.push(
        <span key="dt" className="leg-review-detail">Templates: {drafts.templateVersions.join(', ')}</span>
      );
    }
    if (drafts.triggers?.length) {
      draftBits.push(
        <span key="dk" className="leg-review-detail">Triggers: {drafts.triggers.join(', ')}</span>
      );
    }
    if (drafts.pointOfView?.length) {
      draftBits.push(
        <span key="dp" className="leg-review-detail">POV: {drafts.pointOfView.join(', ')}</span>
      );
    }
  }

  if (bits.length === 0 && draftBits.length === 0) return null;

  return (
    <div className="leg-review">
      {bits}
      {draftBits.length > 0 ? <div className="leg-review-row">{draftBits}</div> : null}
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
  dashboardMode = null,
}) {
  const [theme, setTheme] = useState('dark');
  const [showTopbarTitle, setShowTopbarTitle] = useState(false);
  const [browserNow, setBrowserNow] = useState(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isTripDebugExpanded, setIsTripDebugExpanded] = useState(false);
  const topbarRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const topbar = topbarRef.current;
    const header = headerRef.current;
    if (!topbar || !header) return undefined;

    let frame = 0;
    const updateTopbarTitle = () => {
      frame = 0;
      const topbarRect = topbar.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      // Show the compact title as soon as the full header starts sliding
      // behind the sticky topbar, not only after the whole header disappears.
      setShowTopbarTitle(headerRect.top <= topbarRect.bottom + 2);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTopbarTitle);
    };

    updateTopbarTitle();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [trip?.id]);

  useEffect(() => {
    const tickMonitoringClock = () => setBrowserNow(new Date());
    tickMonitoringClock();
    const intervalId = window.setInterval(tickMonitoringClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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
          <p>No trip with ID <code>{tripId}</code> was found in the private portfolio.</p>
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
  const monitoringPhase = trip.monitoring?.enabled === true ? computeMonitoringPhase(trip, browserNow) : null;
  const monitoringPhaseTone = monitoringPhase?.started ? 'started' : 'neutral';
  const hasTransportDecision = trip.planning?.transportDecision && trip.planning.transportDecision.selectedMode;
  const hasNextAction = typeof trip.planning?.nextAction === 'string' && trip.planning.nextAction.trim().length > 0;
  const hasWeather = Boolean(trip.weather);
  const hasTripNotifications = trip.notifications
    && typeof trip.notifications === 'object'
    && Object.keys(trip.notifications).length > 0;
  const hasPerLegNotifications = Array.isArray(trip.legs)
    && trip.legs.some((leg) => leg && leg.notification);
  const hasNotificationsSection = hasTripNotifications || hasPerLegNotifications;
  const tripDebugPayload = buildTripDetailDebugPayload(trip, { tripId, dashboardMode, monitoringPhase });

  return (
    <main className={`dashboard-shell ${isDebugOpen ? 'debug-mode-active' : ''}`} data-theme={theme} data-debug-mode={isDebugOpen ? 'on' : 'off'}>
      {dashboardMode?.isDemo ? (
        <div className="notice notice-info" style={{ margin: '0 1rem 1rem' }}>
          <strong>🧪 Demo mode.</strong>
          <span>{dashboardMode.bannerMessage || 'The trip detail page is using anonymised static sample trips.'}</span>
        </div>
      ) : null}
      <section className="detail-panel" aria-label={`Trip detail: ${trip.title}`}>
        {/* Top navigation */}
        <div ref={topbarRef} className="detail-topbar">
          <Link href="/" className="back-link">
            ← Back to trip summary
          </Link>
          <div
            className={`detail-topbar-title ${showTopbarTitle ? 'detail-topbar-title-visible' : ''}`}
            aria-label="Current trip"
            aria-hidden={!showTopbarTitle}
          >
            <span className="detail-topbar-date">{formatDateRange(trip.start, trip.end)}</span>
            <span className="detail-topbar-name">{trip.title || tripId}</span>
          </div>
          <button
            type="button"
            className={`secondary-action debug-mode-toggle ${isDebugOpen ? 'debug-mode-toggle--active' : ''}`}
            aria-pressed={isDebugOpen}
            aria-label={isDebugOpen ? 'Turn trip detail debug mode off' : 'Turn trip detail debug mode on'}
            onClick={() => setIsDebugOpen(open => !open)}
          >
            🛠 Debug {isDebugOpen ? 'on' : 'off'}
          </button>
          <button
            type="button"
            className="secondary-action theme-toggle"
            aria-label={`Switch to ${nextTheme} mode`}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Header */}
        <header ref={headerRef} className="detail-header">
          <div className="detail-header-body">
            <p className="trip-date">🗓️ {formatDateRange(trip.start, trip.end)}</p>
            <h1 className="detail-title">{trip.title || tripId}</h1>
            <p className="detail-destination">📍 {trip.destinationLabel || 'Destination TBC'}</p>
            <div className="detail-badges">
              <span className={`status-pill ${rbc}`}>{rl}</span>
              <span className={`status-pill ${mlc}`}>{ml}</span>
              <span className="status-pill">{statusLabel(trip)}</span>
            </div>
          </div>
        </header>

        {isDebugOpen ? (
          <section className="debug-global-panel" aria-label="Trip detail debug summary">
            <div className="debug-global-heading">
              <span>🛠 Debug mode</span>
              <strong>Trip detail diagnostics are embedded in-page.</strong>
            </div>
            <dl className="debug-kv-grid">
              <div><dt>Route</dt><dd>/trips/{tripId}</dd></div>
              <div><dt>Mode</dt><dd>{dashboardMode?.isDemo ? 'demo' : 'live'}</dd></div>
              <div><dt>Readiness</dt><dd>{rl}</dd></div>
              <div><dt>Monitoring phase</dt><dd>{monitoringPhase?.currentPhaseLabel || 'not computed'}</dd></div>
              <div><dt>Sections</dt><dd>{[hasWeather ? 'weather' : null, hasLegs ? 'legs' : null, hasPlanningSection ? 'planning' : null, hasNotificationsSection ? 'notifications' : null].filter(Boolean).join(', ') || 'none'}</dd></div>
            </dl>
            <DetailDebugDisclosure
              id={`trip-detail-debug-${tripId}`}
              title="Trip detail payload"
              summary={`${tripDebugPayload.counts.legs} legs · ${tripDebugPayload.counts.questionsForDanny} questions`}
              data={tripDebugPayload}
              open={isTripDebugExpanded}
              onToggle={() => setIsTripDebugExpanded(open => !open)}
            />
          </section>
        ) : null}

        {/* Next action callout (FR-018) */}
        {hasNextAction ? <NextActionCallout nextAction={trip.planning.nextAction} /> : null}

        {/* Weather */}
        {hasWeather ? <WeatherDetailSection weather={trip.weather} /> : null}

        {/* Travellers */}
        <SectionCollapsible title="Travellers" emoji="👥" defaultOpen={true}>
          <ul className="traveller-list">
            {(trip.travellers && trip.travellers.length > 0)
              ? trip.travellers.map((t, i) => <li key={i}>{t}</li>)
              : <li className="text-muted">To confirm</li>
            }
          </ul>
        </SectionCollapsible>

        {/* Transport decision callout (FR-017) — above Legs */}
        {hasTransportDecision ? <TransportDecisionCallout decision={trip.planning.transportDecision} /> : null}

        {/* Legs (with map embedded) */}
        {hasLegs ? (
          <SectionCollapsible title="Legs" emoji="🛤️" defaultOpen={true}>
            <TripOverviewMap legs={trip.legs} homeBase={trip.homeBase} />
            <ol className="leg-detail-list">
              {trip.legs.map((leg, i) => (
                <LegCollapsible key={`${trip.id}-leg-${i}`} leg={leg} index={i} />
              ))}
            </ol>
          </SectionCollapsible>
        ) : null}

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
            {trip.monitoring.enabled === true ? (
              <div className="trip-monitoring-state">
                <div className={`monitoring-status-row monitoring-status-row--${monitoringPhaseTone}`}>
                  <MonitoringPhaseHelp phase={monitoringPhase.phase} label={monitoringPhase.label} />
                  <span className="monitoring-status-label" aria-label={monitoringPhase.accessibleLabel}>
                    {monitoringPhase.label}
                  </span>
                  <span className="monitoring-status-phase">Current phase: {monitoringPhase.currentPhaseLabel}</span>
                </div>
                <p className="monitoring-detail-note">
                  Advisory: this page computes the recommendation from already-loaded trip and leg timing data plus browser time. It does not fetch live monitoring-state or live-status APIs.
                </p>
              </div>
            ) : null}
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
              {trip.monitoring.fallbackStopThreshold && (
                <>
                  <dt>Fallback stop threshold</dt>
                  <dd>{trip.monitoring.fallbackStopThreshold.label}</dd>
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

        {/* Notifications (FR-048..FR-052) — between Monitoring detail and Accommodation */}
        {hasNotificationsSection ? (
          <NotificationsSection
            notifications={trip.notifications}
            legs={trip.legs}
          />
        ) : null}

        {/* Accommodation (FR-013) — between Notifications and Notes */}
        <AccommodationSection accommodation={trip.accommodation} />

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
