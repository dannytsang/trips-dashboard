import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardSessionSurface } from '@/components/dashboard-session-surface';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  getMissingBlobStorageEnvironment,
  readTripsDashboardBrief,
  TripsBriefStorageError,
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
  let brief = null;
  let storage = missingStorage.length > 0 ? { configured: false } : null;
  let briefStale = false;
  let briefMessage = null;
  let briefError = null;

  if (missingAuth.length === 0 && missingStorage.length === 0) {
    try {
      const result = await readTripsDashboardBrief();
      brief = result.brief;
      storage = result.storage;
      briefStale = result.stale;
      briefMessage = result.message;
    } catch (error) {
      briefError = error instanceof TripsBriefStorageError
        ? error.message
        : 'Failed to read trips brief';
      storage = { configured: true };
    }
  }

  return (
    <DashboardSessionSurface
      userName={userName}
      authConfigurationIncomplete={missingAuth.length > 0}
      storageConfigurationIncomplete={missingStorage.length > 0}
      brief={brief}
      briefStorage={storage}
      briefStale={briefStale}
      briefMessage={briefMessage}
      briefError={briefError}
    />
  );
}
