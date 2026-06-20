const DAY_MS = 24 * 60 * 60 * 1000;
const THRESHOLDS = [
  { phase: 'fifteen_minute', limitMs: 60 * 60 * 1000, detail: 'Recommended phase: Fifteen minute' },
  { phase: 'hourly', limitMs: 4 * 60 * 60 * 1000, detail: 'Recommended phase: Hourly' },
  { phase: 'four_hourly', limitMs: DAY_MS, detail: 'Recommended phase: Four hourly' },
  { phase: 'daily_precheck', limitMs: 7 * DAY_MS, detail: 'Recommended phase: Daily precheck' },
];

const PHASE_LABELS = {
  not_started: {
    label: 'Monitoring configured',
    detail: 'Monitoring is configured but has not yet started.',
    accessibleLabel: 'Monitoring configured — monitoring is configured but has not yet started.',
  },
  daily_precheck: {
    label: 'Should be monitoring',
    detail: 'Recommended phase: Daily precheck',
    accessibleLabel: 'Should be monitoring — recommended phase: Daily precheck',
  },
  four_hourly: {
    label: 'Should be monitoring',
    detail: 'Recommended phase: Four hourly',
    accessibleLabel: 'Should be monitoring — recommended phase: Four hourly',
  },
  hourly: {
    label: 'Should be monitoring',
    detail: 'Recommended phase: Hourly',
    accessibleLabel: 'Should be monitoring — recommended phase: Hourly',
  },
  fifteen_minute: {
    label: 'Should be monitoring',
    detail: 'Recommended phase: Fifteen minute',
    accessibleLabel: 'Should be monitoring — recommended phase: Fifteen minute',
  },
  active_leg: {
    label: 'Should be monitoring',
    detail: 'Recommended phase: Active leg',
    accessibleLabel: 'Should be monitoring — recommended phase: Active leg',
  },
  completed: {
    label: 'Monitoring completed',
    detail: 'Monitoring window has completed.',
    accessibleLabel: 'Monitoring completed — monitoring window has completed.',
  },
  insufficient_timing_data: {
    label: 'Insufficient timing data',
    detail: 'Timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
    accessibleLabel: 'Insufficient timing data — timing data is incomplete, so the dashboard cannot estimate whether monitoring should have started.',
  },
};

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
  const normalisedTripTiming = toTiming(tripTiming);
  if (normalisedTripTiming) {
    candidates.push(normalisedTripTiming);
  }

  for (const leg of trip?.legs ?? []) {
    const legTiming = toTiming(leg?.monitoring_timing ?? leg?.monitoringTiming);
    if (legTiming) {
      candidates.push(legTiming);
    }
  }

  candidates.sort((left, right) => left.start.getTime() - right.start.getTime());
  return candidates;
}

export function formatMonitoringPhaseLabel(phase) {
  return PHASE_LABELS[phase]?.label ?? 'Insufficient timing data';
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