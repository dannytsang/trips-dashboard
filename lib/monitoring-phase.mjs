const DAY_MS = 24 * 60 * 60 * 1000;
const THRESHOLDS = [
  { phase: 'fifteen_minute', limitMs: 60 * 60 * 1000, detail: 'Recommended phase: Fifteen minute' },
  { phase: 'hourly', limitMs: 4 * 60 * 60 * 1000, detail: 'Recommended phase: Hourly' },
  { phase: 'four_hourly', limitMs: DAY_MS, detail: 'Recommended phase: Four hourly' },
  { phase: 'daily_precheck', limitMs: 7 * DAY_MS, detail: 'Recommended phase: Daily precheck' },
];

const PHASE_LABELS = {
  not_started: {
    label: 'Monitoring',
    detail: 'Monitoring is configured but has not yet started.',
    accessibleLabel: 'Monitoring — monitoring is configured but has not yet started.',
  },
  daily_precheck: {
    label: 'Monitoring',
    detail: 'Recommended phase: Daily precheck',
    accessibleLabel: 'Monitoring — recommended phase: Daily precheck',
  },
  four_hourly: {
    label: 'Monitoring',
    detail: 'Recommended phase: Four hourly',
    accessibleLabel: 'Monitoring — recommended phase: Four hourly',
  },
  hourly: {
    label: 'Monitoring',
    detail: 'Recommended phase: Hourly',
    accessibleLabel: 'Monitoring — recommended phase: Hourly',
  },
  fifteen_minute: {
    label: 'Monitoring',
    detail: 'Recommended phase: Fifteen minute',
    accessibleLabel: 'Monitoring — recommended phase: Fifteen minute',
  },
  active_leg: {
    label: 'Monitoring',
    detail: 'Recommended phase: Active leg',
    accessibleLabel: 'Monitoring — recommended phase: Active leg',
  },
  completed: {
    label: 'Monitoring complete',
    detail: 'Monitoring window has completed.',
    accessibleLabel: 'Monitoring complete — monitoring window has completed.',
  },
  insufficient_timing_data: {
    label: 'Monitoring',
    detail: 'Timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
    accessibleLabel: 'Monitoring — timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
  },
};

const MONITORING_PHASE_LEGEND = [
  { phase: 'not_started', label: 'Not started yet', detail: 'Monitoring is configured but has not yet started.' },
  { phase: 'daily_precheck', label: 'Daily precheck', detail: 'Recommended phase: Daily precheck' },
  { phase: 'four_hourly', label: 'Four hourly', detail: 'Recommended phase: Four hourly' },
  { phase: 'hourly', label: 'Hourly', detail: 'Recommended phase: Hourly' },
  { phase: 'fifteen_minute', label: 'Fifteen minute', detail: 'Recommended phase: Fifteen minute' },
  { phase: 'active_leg', label: 'Active leg', detail: 'Recommended phase: Active leg' },
  { phase: 'completed', label: 'Completed', detail: 'Monitoring window has completed.' },
  { phase: 'insufficient_timing_data', label: 'Insufficient timing data', detail: 'Timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.' },
];

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const ISO_DATETIME_TEXT_RE = /\d{4}-\d{2}-\d{2}T[^\s/]+(?:Z|[+-]\d{2}:\d{2})/g;

function toTiming(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (candidate.monitorable === false) {
    return null;
  }

  const start = toDate(candidate.start ?? candidate.startAt ?? candidate.departure ?? candidate.windowStart);
  if (!start) {
    return null;
  }

  const end = toDate(candidate.end ?? candidate.endAt ?? candidate.arrival ?? candidate.windowEnd);
  const fallbackEnd = toDate(candidate.fallbackEnd ?? candidate.graceEnd ?? candidate.completionDeadline);

  return {
    start,
    end,
    fallbackEnd,
  };
}

function firstText(candidate, ...keys) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = candidate[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstIsoText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const matches = value.match(ISO_DATETIME_TEXT_RE);
  return matches?.[0] ?? null;
}

function lastIsoText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const matches = value.match(ISO_DATETIME_TEXT_RE);
  return matches?.at(-1) ?? null;
}

function latestEventAnchor(events, primaryField, secondaryField) {
  if (!Array.isArray(events)) {
    return null;
  }

  let latest = null;
  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }

    const value = firstText(event, primaryField) ?? firstText(event, secondaryField);
    if (value && toDate(value)) {
      latest = value;
    }
  }

  return latest;
}

function synthesiseTiming(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const timing = {};

  const explicitStart = firstText(source, 'start', 'startAt', 'departure', 'windowStart');
  if (explicitStart && toDate(explicitStart)) {
    timing.start = explicitStart;
  } else {
    const startCandidates = [
      firstText(source, 'depart_at', 'departAt', 'planned_departure', 'plannedDeparture', 'recommended_departure', 'recommendedDeparture', 'departLocal', 'depart_after', 'departAfter', 'event_start', 'eventStart'),
      firstIsoText(firstText(source, 'planned_departure_window', 'plannedDepartureWindow', 'planned_window', 'plannedWindow')),
      latestEventAnchor(source.pre_departure_events ?? source.preDepartureEvents, 'end', 'start'),
    ];
    const derivedStart = startCandidates.find(value => value && toDate(value));
    if (derivedStart) {
      timing.start = derivedStart;
    }
  }

  const explicitEnd = firstText(source, 'end', 'endAt', 'arrival', 'windowEnd');
  if (explicitEnd && toDate(explicitEnd)) {
    timing.end = explicitEnd;
  } else {
    const endCandidates = [
      firstText(source, 'arrive_at', 'arriveAt', 'target_arrival', 'targetArrival', 'arriveLocal', 'planned_arrival', 'plannedArrival', 'recommended_arrival', 'recommendedArrival', 'estimated_arrival', 'estimatedArrival', 'planned_arrival_by', 'plannedArrivalBy', 'event_end', 'eventEnd'),
      lastIsoText(firstText(source, 'planned_arrival_window', 'plannedArrivalWindow', 'planned_window', 'plannedWindow')),
      latestEventAnchor(source.post_arrival_events ?? source.postArrivalEvents, 'start', 'end'),
    ];
    const derivedEnd = endCandidates.find(value => value && toDate(value));
    if (derivedEnd) {
      timing.end = derivedEnd;
    }
  }

  const fallbackEnd = firstText(source, 'fallbackEnd', 'fallback_end', 'graceEnd', 'grace_end', 'completionDeadline', 'completion_deadline');
  if (fallbackEnd && toDate(fallbackEnd)) {
    timing.fallbackEnd = fallbackEnd;
  }

  const timezone = firstText(source, 'timezone', 'timeZone');
  if (timezone) {
    timing.timezone = timezone;
  }

  if (source.monitorable === false) {
    timing.monitorable = false;
  } else if (typeof source.monitorable === 'boolean') {
    timing.monitorable = source.monitorable;
  }

  return timing.start ? timing : null;
}

function phaseFromDelay(delayMs) {
  if (delayMs > 7 * DAY_MS) {
    return 'not_started';
  }

  if (delayMs > DAY_MS) {
    return 'daily_precheck';
  }

  if (delayMs > 4 * 60 * 60 * 1000) {
    return 'four_hourly';
  }

  if (delayMs > 60 * 60 * 1000) {
    return 'hourly';
  }

  return 'fifteen_minute';
}

function timingDeadlineMs(timing) {
  return timing.fallbackEnd?.getTime() ?? timing.end?.getTime() ?? timing.start.getTime();
}

function collectTimings(trip) {
  const candidates = [];

  const tripTiming = trip?.monitoring_timing ?? trip?.monitoringTiming ?? trip?.monitoring?.timing;
  const normalisedTripTiming = toTiming(tripTiming) ?? toTiming(synthesiseTiming(trip));
  if (normalisedTripTiming) {
    candidates.push(normalisedTripTiming);
  }

  for (const leg of trip?.legs ?? []) {
    const legTiming = toTiming(leg?.monitoring_timing ?? leg?.monitoringTiming)
      ?? toTiming(synthesiseTiming(leg));
    if (legTiming) {
      candidates.push(legTiming);
    }
  }

  candidates.sort((left, right) => left.start.getTime() - right.start.getTime());
  return candidates;
}

export function formatMonitoringPhaseLabel(phase) {
  return PHASE_LABELS[phase]?.label ?? 'Monitoring';
}

export function formatMonitoringPhaseTooltip(phase) {
  const current = MONITORING_PHASE_LEGEND.find((item) => item.phase === phase) ?? MONITORING_PHASE_LEGEND[0];
  const legend = MONITORING_PHASE_LEGEND.map((item) => `${item.phase === phase ? '→' : '•'} ${item.label}: ${item.detail}`).join('\n');
  return `Monitoring\nCurrent phase: ${current.label}\n${current.detail}\n\nHover legend:\n${legend}`;
}

export function computeMonitoringPhase(trip, now = null) {
  const candidates = collectTimings(trip);
  if (candidates.length === 0) {
    return {
      phase: 'insufficient_timing_data',
      started: false,
      ...PHASE_LABELS.insufficient_timing_data,
    };
  }

  const currentTime = now instanceof Date ? now : toDate(now);
  if (!currentTime) {
    return {
      phase: 'not_started',
      started: false,
      ...PHASE_LABELS.not_started,
    };
  }

  const currentMs = currentTime.getTime();
  const activeTiming = candidates.find((timing) => {
    const endMs = timingDeadlineMs(timing);
    return currentMs >= timing.start.getTime() && currentMs <= endMs;
  });

  if (activeTiming) {
    return {
      phase: 'active_leg',
      started: true,
      ...PHASE_LABELS.active_leg,
    };
  }

  const nextTiming = candidates.find((timing) => timing.start.getTime() > currentMs);
  if (nextTiming) {
    const delayMs = nextTiming.start.getTime() - currentMs;
    const phase = phaseFromDelay(delayMs);
    return {
      phase,
      started: phase !== 'not_started',
      ...PHASE_LABELS[phase],
    };
  }

  const latestTiming = [...candidates].sort((left, right) => timingDeadlineMs(right) - timingDeadlineMs(left))[0];
  if (latestTiming && currentMs > timingDeadlineMs(latestTiming)) {
    return {
      phase: 'completed',
      started: false,
      ...PHASE_LABELS.completed,
    };
  }

  return {
    phase: 'insufficient_timing_data',
    started: false,
    ...PHASE_LABELS.insufficient_timing_data,
  };
}