export default function HomePage() {
  return (
    <main>
      <section aria-labelledby="dashboard-title">
        <p className="eyebrow">Travel intelligence</p>
        <h1 id="dashboard-title">🧭 Trips Dashboard</h1>
        <p>
          This is the deployment shell for the private trips dashboard. Live trip data is intentionally absent until the authenticated runtime store, ingestion endpoint, and OIDC boundary are implemented.
        </p>
        <div className="status">No private trip data is bundled in this build</div>
      </section>
    </main>
  );
}
