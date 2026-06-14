import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardSessionSurface } from '@/components/dashboard-session-surface';
import { authOptions, getMissingAuthEnvironment } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/signin?callbackUrl=/');
  }

  const missingAuth = getMissingAuthEnvironment();
  const userName = session.user?.name || session.user?.email || 'authorised traveller';

  return (
    <DashboardSessionSurface
      userName={userName}
      authConfigurationIncomplete={missingAuth.length > 0}
    />
  );
}
