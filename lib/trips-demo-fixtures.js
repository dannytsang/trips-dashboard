import { sha256ForObject, validateTripsPortfolio } from './trips-portfolio.js';

const DEMO_BANNER_MESSAGE = 'Demo mode: using anonymised static sample trips instead of private Blob storage.';
const DEMO_DATA_SOURCE_LABEL = 'Demo data';
const DEMO_GENERATED_AT = '2026-06-19T12:00:00.000Z';

const demoTrips = [
  {
    schemaVersion: 1,
    id: 'demo-family-day-trip',
    title: 'Demo family day trip',
    status: 'planned',
    start: '2026-07-04T08:00:00+01:00',
    end: '2026-07-04T19:30:00+01:00',
    destinationLabel: 'Southdown Botanic Garden',
    travellers: ['Alex', 'Sam'],
    planning: {
      readiness: 'provisional',
      nextAction: 'Confirm picnic supplies',
      assumptions: ['Sunny weather expected'],
      missing: [],
      questionsForDanny: [],
      transportDecision: {
        selectedMode: 'driving',
        rationale: 'Short, self-contained day trip with flexibility for timings.',
      },
    },
    monitoring: {
      enabled: true,
      active: false,
      summary: 'Monitoring configured',
      checks: [{ label: 'Weather review', status: 'ok' }],
    },
    homeBase: { town: 'Stevenage' },
    legs: [
      {
        label: 'Home to garden',
        mode: 'driving',
        origin: { label: 'Stevenage', precision: 'home' },
        destination: { label: 'Southdown Botanic Garden', precision: 'venue' },
        start: '2026-07-04T08:00:00+01:00',
        end: '2026-07-04T09:40:00+01:00',
      },
      {
        label: 'Garden to home',
        mode: 'driving',
        origin: { label: 'Southdown Botanic Garden', precision: 'venue' },
        destination: { label: 'Stevenage', precision: 'home' },
        start: '2026-07-04T17:30:00+01:00',
        end: '2026-07-04T19:30:00+01:00',
      },
    ],
    weather: {
      status: 'available',
      source: 'demo',
      locationLabel: 'Southdown Botanic Garden',
      generatedAt: DEMO_GENERATED_AT,
      summary: {
        label: 'Light rain',
        icon: '🌧️',
        accessibleLabel: 'Light rain forecast',
      },
      periods: [
        { periodLabel: 'Morning', label: 'Partly cloudy', icon: '⛅', temperature: '18–21°C' },
        { periodLabel: 'Afternoon', label: 'Light rain', icon: '🌧️', temperature: '17–19°C' },
      ],
    },
    notes: ['Pack picnic blanket', 'Keep the umbrella handy'],
    programme: [],
    accommodation: null,
  },
  {
    schemaVersion: 1,
    id: 'demo-city-weekend',
    title: 'Demo city weekend',
    status: 'planned',
    start: '2026-08-14T09:15:00+01:00',
    end: '2026-08-16T18:30:00+01:00',
    destinationLabel: 'Brighton',
    travellers: ['Alex', 'Taylor'],
    planning: {
      readiness: 'confirmed',
      nextAction: 'Book late checkout',
      assumptions: ['Hotel allows bag drop before check-in'],
      missing: ['Confirm dinner booking'],
      questionsForDanny: ['Prefer Italian or seafood for the first night?'],
      transportDecision: {
        selectedMode: 'train',
        rationale: 'Rail is the least stressful option for a short weekend city break.',
      },
    },
    monitoring: {
      enabled: true,
      active: true,
      summary: 'Monitoring active',
      checks: [{ label: 'Hotel rate watch', status: 'ok' }],
    },
    homeBase: { town: 'Stevenage' },
    legs: [
      {
        label: 'Stevenage to Brighton',
        mode: 'train',
        origin: { label: 'Stevenage', precision: 'home' },
        destination: { label: 'Brighton station', precision: 'station' },
        start: '2026-08-14T09:15:00+01:00',
        end: '2026-08-14T11:05:00+01:00',
      },
      {
        label: 'Brighton station to hotel',
        mode: 'walk',
        origin: { label: 'Brighton station', precision: 'station' },
        destination: { label: 'Beachside Hotel', precision: 'venue' },
        start: '2026-08-14T11:20:00+01:00',
        end: '2026-08-14T11:40:00+01:00',
      },
      {
        label: 'Brighton to Stevenage',
        mode: 'train',
        origin: { label: 'Brighton station', precision: 'station' },
        destination: { label: 'Stevenage', precision: 'home' },
        start: '2026-08-16T16:00:00+01:00',
        end: '2026-08-16T18:30:00+01:00',
      },
    ],
    weather: {
      status: 'available',
      source: 'demo',
      locationLabel: 'Brighton',
      generatedAt: DEMO_GENERATED_AT,
      summary: {
        label: 'Partly cloudy',
        icon: '⛅',
        accessibleLabel: 'Partly cloudy forecast',
      },
      periods: [
        { periodLabel: 'Friday', label: 'Partly cloudy', icon: '⛅', temperature: '20–24°C' },
        { periodLabel: 'Saturday', label: 'Light rain', icon: '🌦️', temperature: '18–21°C' },
      ],
    },
    accommodation: {
      status: 'available_paid_addon',
      name: 'Beachside Hotel',
    },
    programme: [
      { title: 'Dinner reservation', date: '2026-08-14', time: '19:30', location: 'Sea View Restaurant', notes: 'Try the tasting menu' },
      { title: 'Museum visit', date: '2026-08-15', time: '10:00', location: 'Brighton Museum', notes: 'Pre-book tickets' },
    ],
    notes: ['Bring railcard', 'Reserve a table for Saturday night'],
  },
  {
    schemaVersion: 1,
    id: 'demo-multi-leg-holiday',
    title: 'Demo multi-leg holiday',
    status: 'active',
    start: '2026-09-10T06:15:00+01:00',
    end: '2026-09-17T21:45:00+01:00',
    destinationLabel: 'Lake Como',
    travellers: ['Alex'],
    planning: {
      readiness: 'planned',
      nextAction: 'Confirm ferry transfer timings',
      assumptions: ['Outbound flight is unchanged'],
      missing: ['Check luggage allowance'],
      questionsForDanny: ['Should the return leg include an overnight stop?'],
      transportDecision: {
        selectedMode: 'ferry',
        rationale: 'The lakeside route is simpler with a ferry transfer for the final leg.',
      },
    },
    monitoring: {
      enabled: true,
      active: true,
      summary: 'Monitoring active',
      checks: [{ label: 'Flight schedule watch', status: 'ok' }, { label: 'Ferry service watch', status: 'ok' }],
    },
    homeBase: { town: 'Stevenage' },
    legs: [
      {
        label: 'Stevenage to airport',
        mode: 'driving',
        origin: { label: 'Stevenage', precision: 'home' },
        destination: { label: 'Luton Airport', precision: 'airport' },
        start: '2026-09-10T06:15:00+01:00',
        end: '2026-09-10T07:05:00+01:00',
      },
      {
        label: 'Airport to Milan',
        mode: 'flight',
        origin: { label: 'Luton Airport', precision: 'airport' },
        destination: { label: 'Milan Malpensa', precision: 'airport' },
        start: '2026-09-10T08:15:00+01:00',
        end: '2026-09-10T11:25:00+02:00',
      },
      {
        label: 'Milan to Lake Como',
        mode: 'ferry',
        origin: { label: 'Milan Centrale', precision: 'station' },
        destination: { label: 'Lake Como', precision: 'venue' },
        start: '2026-09-10T12:15:00+02:00',
        end: '2026-09-10T14:45:00+02:00',
      },
    ],
    weather: {
      status: 'available',
      source: 'demo',
      locationLabel: 'Lake Como',
      generatedAt: DEMO_GENERATED_AT,
      summary: {
        label: 'Sunny',
        icon: '☀️',
        accessibleLabel: 'Sunny forecast',
      },
      periods: [
        { periodLabel: 'Departure', label: 'Sunny', icon: '☀️', temperature: '24–28°C' },
        { periodLabel: 'Arrival', label: 'Warm', icon: '🌤️', temperature: '23–27°C' },
      ],
    },
    accommodation: {
      status: 'not_purchased',
      name: 'Lake Como apartment',
    },
    programme: [
      { title: 'Lakeside walk', date: '2026-09-11', time: '09:30', location: 'Bellagio', notes: 'Morning stroll before lunch' },
      { title: 'Boat excursion', date: '2026-09-13', time: '13:00', location: 'Varenna', notes: 'Private tour' },
    ],
    notes: ['Pack sun cream', 'Keep an eye on ferry strike updates'],
  },
  {
    schemaVersion: 1,
    id: 'demo-cancelled-rail-shuffle',
    title: 'Demo cancelled rail shuffle',
    status: 'cancelled',
    start: '2026-10-03T08:45:00+01:00',
    end: '2026-10-03T20:15:00+01:00',
    destinationLabel: 'Cambridge',
    travellers: ['Alex', 'Taylor'],
    planning: {
      readiness: 'needs_info',
      nextAction: 'Rebook once the rail replacement is confirmed',
      assumptions: [],
      missing: ['Await the new travel date'],
      questionsForDanny: ['Should we keep the hotel hold?'],
      transportDecision: {
        selectedMode: 'bus',
        rationale: 'A rail replacement coach is the only realistic option after the cancellation.',
      },
    },
    monitoring: {
      enabled: false,
      active: false,
      summary: 'Monitoring not enabled',
      checks: [],
    },
    homeBase: { town: 'Stevenage' },
    legs: [
      {
        label: 'Home to coach stop',
        mode: 'driving',
        origin: { label: 'Stevenage', precision: 'home' },
        destination: { label: 'Stevenage coach stop', precision: 'station' },
        start: '2026-10-03T08:45:00+01:00',
        end: '2026-10-03T09:00:00+01:00',
      },
      {
        label: 'Replacement coach to Cambridge',
        mode: 'bus',
        origin: { label: 'Stevenage coach stop', precision: 'station' },
        destination: { label: 'Cambridge coach station', precision: 'station' },
        start: '2026-10-03T09:15:00+01:00',
        end: '2026-10-03T10:45:00+01:00',
        planningReview: {
          action: {
            status: 'not_applicable',
            question: 'No review needed for the cancelled transfer',
            includeInItinerary: false,
          },
          drafts: {
            count: 2,
            statuses: ['draft', 'approved'],
            templateVersions: ['v1', 'v2'],
            triggers: ['rail-cancellation'],
            pointOfView: ['planner'],
          },
        },
      },
      {
        label: 'Cambridge coach station to home',
        mode: 'walk',
        origin: { label: 'Cambridge coach station', precision: 'station' },
        destination: { label: 'Stevenage', precision: 'home' },
        start: '2026-10-03T10:50:00+01:00',
        end: '2026-10-03T12:15:00+01:00',
      },
    ],
    weather: {
      status: 'available',
      source: 'demo',
      locationLabel: 'Cambridge',
      generatedAt: DEMO_GENERATED_AT,
      summary: {
        label: 'Overcast',
        icon: '☁️',
        accessibleLabel: 'Overcast forecast',
      },
      periods: [
        { periodLabel: 'Morning', label: 'Overcast', icon: '☁️', temperature: '11–14°C' },
        { periodLabel: 'Afternoon', label: 'Showers', icon: '🌦️', temperature: '12–15°C' },
      ],
    },
    accommodation: {
      status: 'not_applicable',
    },
    programme: [
      {
        title: 'Flexible lunch',
        date: '2026-10-03',
        time: '13:00',
        location: 'Cambridge station',
        notes: 'No reservation until the date is fixed',
        status: 'tentative',
      },
    ],
    notes: [],
  },
];

const demoManifestEntries = demoTrips.map(trip => ({
  id: trip.id,
  path: `trips-dashboard/trips/${trip.id}.json`,
  sha256: sha256ForObject(trip),
  sidecarPath: `trips-dashboard/trips/${trip.id}.sha256`,
  sortStart: trip.start,
  status: trip.status,
  title: trip.title,
  destinationLabel: trip.destinationLabel,
}));

export const DEMO_TRIPS_MANIFEST = {
  schemaVersion: 1,
  generatedAt: DEMO_GENERATED_AT,
  staleAfterMinutes: 0,
  tripCount: demoTrips.length,
  stale: false,
  lastSync: {
    status: 'demo',
    message: 'Static anonymised demo fixtures bundled with the preview build.',
  },
  trips: demoManifestEntries,
};

export const DEMO_TRIPS_PORTFOLIO = validateTripsPortfolio({
  schemaVersion: 1,
  generatedAt: DEMO_GENERATED_AT,
  trips: demoTrips,
  summary: {
    tripCount: demoTrips.length,
    staleAfterMinutes: 0,
    lastSync: DEMO_TRIPS_MANIFEST.lastSync,
  },
}, { receivedAt: DEMO_GENERATED_AT });

export const DEMO_TRIPS_BY_ID = Object.fromEntries(demoTrips.map(trip => [trip.id, trip]));

export function getDemoTripsDashboardMode() {
  return {
    mode: 'demo',
    isDemo: true,
    dataSourceLabel: DEMO_DATA_SOURCE_LABEL,
    bannerMessage: DEMO_BANNER_MESSAGE,
  };
}

export function getDemoTripsDashboardPortfolio() {
  return {
    portfolio: DEMO_TRIPS_PORTFOLIO,
    manifest: DEMO_TRIPS_MANIFEST,
    storage: {
      configured: false,
      exists: true,
      source: 'static-demo-fixtures',
      pathname: 'trips-dashboard/current.demo.json',
      size: null,
      uploadedAt: DEMO_GENERATED_AT,
    },
    message: DEMO_BANNER_MESSAGE,
    mode: getDemoTripsDashboardMode(),
  };
}

export function getDemoTripById(tripId) {
  return DEMO_TRIPS_BY_ID[tripId] || null;
}
