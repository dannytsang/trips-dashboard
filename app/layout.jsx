import './globals.css';

export const metadata = {
  title: 'Tsang Travel',
  description:
    'Private travel dashboard. Real trip data is served only through authenticated runtime storage and OIDC-protected routes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
