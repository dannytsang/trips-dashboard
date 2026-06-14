import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardSessionSurface } from '@/components/dashboard-session-surface';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  getMissingBlobStorageEnvironment,
  readTripsDashboardProjection,
  TripsProjectionStorageError,
} from '@/lib/trips-storage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  const missingAuth = getMissingAuthEnvironment();
  const missingStorage = getMissingBlobStorageEnvironment();
  const userName = session.user?.name || session.user?.email || 'authorised traveller';
  let projection = null;
  let storage = missingStorage.length > 0 ? { configured: false } : null;
  let projectionStale = false;
  let projectionMessage = null;
  let projectionError = null;

  if (missingAuth.length === 0 && missingStorage.length === 0) {
    try {
      const result = await readTripsDashboardProjection();
      projection = result.projection;
      storage = result.storage;
      projectionStale = result.stale;
      projectionMessage = result.message;
    } catch (error) {
      projectionError = error instanceof TripsProjectionStorageError
        ? error.message
        : 'Failed to read trips projection';
      storage = { configured: true };
    }
  }

  return (
    <DashboardSessionSurface
      userName={userName}
      authConfigurationIncomplete={missingAuth.length > 0}
      storageConfigurationIncomplete={missingStorage.length > 0}
      projection={projection}
      projectionStorage={storage}
      projectionStale={projectionStale}
      projectionMessage={projectionMessage}
      projectionError={projectionError}
    />
  );
}
