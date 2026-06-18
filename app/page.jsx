import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardSessionSurface } from '@/components/dashboard-session-surface';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  getMissingBlobStorageEnvironment,
  readTripsDashboardPortfolio,
  TripsPortfolioStorageError,
} from '@/lib/trips-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  const missingAuth = getMissingAuthEnvironment();
  const missingStorage = getMissingBlobStorageEnvironment();
  const userName = session.user?.name || session.user?.email || 'authorised traveller';
  let portfolio = null;
  let storage = missingStorage.length > 0 ? { configured: false } : null;
  let portfolioStale = false;
  let portfolioMessage = null;
  let portfolioError = null;

  if (missingAuth.length === 0 && missingStorage.length === 0) {
    try {
      const result = await readTripsDashboardPortfolio();
      portfolio = result.portfolio;
      storage = result.storage;
      portfolioStale = result.stale;
      portfolioMessage = result.message;
    } catch (error) {
      portfolioError = error instanceof TripsPortfolioStorageError
        ? error.message
        : 'Failed to read trips portfolio';
      storage = { configured: true };
    }
  }

  return (
    <DashboardSessionSurface
      userName={userName}
      authConfigurationIncomplete={missingAuth.length > 0}
      storageConfigurationIncomplete={missingStorage.length > 0}
      portfolio={portfolio}
      portfolioStorage={storage}
      portfolioStale={portfolioStale}
      portfolioMessage={portfolioMessage}
      portfolioError={portfolioError}
    />
  );
}
