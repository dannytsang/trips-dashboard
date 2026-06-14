import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
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
    <main>
      <section aria-labelledby="dashboard-title">
        <p className="eyebrow">Travel intelligence</p>
        <h1 id="dashboard-title">🧭 Tsang Travel</h1>
        {missingAuth.length > 0 ? (
          <>
            <p>
              The dashboard is protected, but required OIDC runtime configuration is incomplete. No trip data is available until the server configuration is corrected.
            </p>
            <div className="status status-warning">Authentication configuration incomplete</div>
          </>
        ) : (
          <>
            <p>
              Welcome, {userName}. The authenticated dashboard boundary is active. Live trip summaries will appear here once the private projection store is wired in.
            </p>
            <div className="status">No private trip data is bundled in this build</div>
          </>
        )}
      </section>
    </main>
  );
}
