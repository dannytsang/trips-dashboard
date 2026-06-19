import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { TripDetailSurface } from '@/components/trip-detail-surface';
import { authOptions } from '@/lib/auth';
import {
  readTripById,
  resolveTripsDashboardMode,
  TripsPortfolioStorageError,
} from '@/lib/trips-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function TripDetailPage({ params }) {
  const { tripId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/trips/${tripId}`);
  }

  let trip = null;
  let storageOk = false;
  let notFound = false;
  let errorMessage = null;
  const dashboardMode = resolveTripsDashboardMode();

  try {
    trip = await readTripById(tripId);
    storageOk = true;
    if (!trip) {
      notFound = true;
    }
  } catch (err) {
    errorMessage =
      err instanceof TripsPortfolioStorageError
        ? err.message
        : 'Failed to load trip data';
  }

  return (
    <TripDetailSurface
      trip={trip}
      tripId={tripId}
      authConfigurationIncomplete={false}
      storageConfigurationIncomplete={false}
      storageOk={storageOk}
      dashboardMode={dashboardMode}
      notFound={notFound}
      errorMessage={errorMessage}
    />
  );
}
