import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
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

  const missingStorage = getMissingBlobStorageEnvironment();

  if (missingStorage.length > 0) {
    return (
      <main style={{ maxWidth: 520, margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <h1>Storage not configured</h1>
        <p>{missingStorage.join(', ')}</p>
      </main>
    );
  }

  let trip = null;
  let notFound = false;
  let errorMessage = null;

  try {
    trip = await readTripById(tripId);
    if (!trip) {
      notFound = true;
    }
  } catch (err) {
    const msg = err instanceof TripsProjectionStorageError
      ? err.message
      : err instanceof Error
        ? err.message
        : String(err);
    errorMessage = `Failed to load trip: ${msg}`;
  }

  if (notFound) {
    return (
      <main style={{ maxWidth: 520, margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <h1>Trip not found</h1>
        <p>No trip found with ID: {tripId}</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main style={{ maxWidth: 520, margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <h1>Error</h1>
        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
      <p>Trip: {trip?.title || tripId}</p>
      <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
        {JSON.stringify(trip, null, 2)}
      </pre>
    </main>
  );
}
