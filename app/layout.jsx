import './globals.css';

export const metadata = {
  title: 'Trips Dashboard',
  description:
    'Private travel dashboard shell. Real trip data will be served only after authenticated storage and OIDC are implemented.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
