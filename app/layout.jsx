import './globals.css';

export const metadata = {
  title: 'Tsang Travel',
  description:
    'Private travel dashboard. Real trip data is served only through authenticated runtime storage and OIDC-protected routes.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
};

// TEMP hydration diagnostic — captures React #418 / hydration mismatches in the
// browser console AND POSTs them to /api/diag so we can read the server-side log
// to identify the exact text-node mismatch. Remove once #418 is fixed.
const HYDRATION_DIAG = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__hydrationDiagInstalled) return;
  window.__hydrationDiagInstalled = true;

  function post(payload) {
    try {
      const body = JSON.stringify({
        ...payload,
        url: location.pathname + location.search,
        ua: navigator.userAgent,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        themeInStorage: localStorage.getItem('tsang-travel-theme'),
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/diag', body);
      } else {
        fetch('/api/diag', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch (e) {}
  }

  const origErr = console.error;
  console.error = function() {
    try {
      const text = Array.from(arguments).map(a => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(' ');
      if (text.includes('Hydration') || text.includes('Minified React error #418') || text.includes('did not match')) {
        const stack = new Error('hydration').stack;
        post({ kind: 'console.error', text: text.substring(0, 4000), stack });
      }
    } catch (e) {}
    return origErr.apply(console, arguments);
  };

  window.addEventListener('error', function(e) {
    if (e?.message && (e.message.includes('Minified React error #418') || e.message.includes('Hydration'))) {
      post({ kind: 'window.error', text: e.message, stack: e.error?.stack || '' });
    }
  });

  window.addEventListener('unhandledrejection', function(e) {
    const msg = e?.reason?.message || '';
    if (msg.includes('Minified React error #418') || msg.includes('Hydration')) {
      post({ kind: 'unhandledrejection', text: msg, stack: e?.reason?.stack || '' });
    }
  });
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: HYDRATION_DIAG }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
