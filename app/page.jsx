import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardSessionSurface } from '@/components/dashboard-session-surface';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';
import {
  readTripsDashboardPortfolio,
  TripsPortfolioStorageError,
} from '@/lib/trips-storage';
import { readBuildInfo } from '@/app/api/build-info/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  const missingAuth = getMissingAuthEnvironment();
  const userName = session.user?.name || session.user?.email || 'authorised traveller';
  let portfolio = null;
  let storage = null;
  let portfolioMode = null;
  let portfolioStale = false;
  let portfolioMessage = null;
  let portfolioError = null;

  if (missingAuth.length === 0) {
    try {
      const result = await readTripsDashboardPortfolio();
      portfolio = result.portfolio;
      storage = result.storage;
      portfolioMode = result.mode;
      portfolioStale = result.stale;
      portfolioMessage = result.message;
    } catch (error) {
      portfolioError = error instanceof TripsPortfolioStorageError
        ? error.message
        : 'Failed to read trips portfolio';
      storage = { configured: true };
    }
  }

  // Build/deployment metadata for FR-035 / FR-036.
  const { builtAt } = await readBuildInfo();

  return (
    <DashboardSessionSurface
      userName={userName}
      authConfigurationIncomplete={missingAuth.length > 0}
      storageConfigurationIncomplete={false}
      portfolioMode={portfolioMode}
      portfolio={portfolio}
      portfolioStorage={storage}
      portfolioStale={portfolioStale}
      portfolioMessage={portfolioMessage}
      portfolioError={portfolioError}
      builtAt={builtAt}
    />
  );
}
