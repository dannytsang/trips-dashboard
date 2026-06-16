import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { TripDetailSurface } from '@/components/trip-detail-surface';
import { authOptions } from '@/lib/auth';
import {
  getMissingBlobStorageEnvironment,
  readTripById,
  TripsProjectionStorageError,
} from '@/lib/trips-storage';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({ params }) {
  const { tripId } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/auth/signin?callbackUrl=/trips/${tripId}`);
  }

  const missingAuth = [];
  const missingStorage = getMissingBlobStorageEnvironment();

  let trip = null;
  let storageOk = false;
  let notFound = false;
  let errorMessage = null;

  if (missingStorage.length === 0) {
    try {
      trip = await readTripById(tripId);
      storageOk = true;
      if (!trip) {
        notFound = true;
      }
    } catch (err) {
      errorMessage =
        err instanceof TripsProjectionStorageError
          ? err.message
          : 'Failed to load trip data';
    }
  }

  return (
    <TripDetailSurface
      trip={trip}
      tripId={tripId}
      authConfigurationIncomplete={missingAuth.length > 0}
      storageConfigurationIncomplete={missingStorage.length > 0}
      storageOk={storageOk}
      notFound={notFound}
      errorMessage={errorMessage}
    />
  );
}
