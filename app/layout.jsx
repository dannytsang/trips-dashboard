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

// TEMP hydration diagnostic v2 — captures the full unminified hydration
// mismatch by monkey-patching React's hydrateRoot-style error reporter.
// Walks the DOM at the moment of error to dump the offending subtree.
const HYDRATION_DIAG = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__hydrationDiagInstalled) return;
  window.__hydrationDiagInstalled = true;

  function dumpDOMAround(node, depth, maxLen) {
    if (!node) return '[null node]';
    depth = depth || 0;
    maxLen = maxLen || 8000;
    if (depth > 12) return '[truncated-depth]';
    var indent = '  '.repeat(depth);
    var out = '';
    var ownAttrs = '';
    if (node.attributes) {
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes[i];
        ownAttrs += ' ' + a.name + '="' + (a.value || '').substring(0, 80) + '"';
      }
    }
    out += indent + '<' + node.nodeName.toLowerCase() + ownAttrs + '>';
    if (node.childNodes && node.childNodes.length) {
      for (var j = 0; j < node.childNodes.length && j < 30; j++) {
        var c = node.childNodes[j];
        if (c.nodeType === 3) {
          var txt = (c.nodeValue || '').substring(0, 200);
          if (txt.trim()) out += '\\n' + indent + '  [text:"' + txt + '"]';
        } else if (c.nodeType === 8) {
          out += '\\n' + indent + '  [comment]';
        } else {
          out += '\\n' + dumpDOMAround(c, depth + 1, maxLen);
        }
      }
    }
    out += '\\n' + indent + '</' + node.nodeName.toLowerCase() + '>';
    if (out.length > maxLen) return out.substring(0, maxLen) + '...[truncated]';
    return out;
  }

  function post(payload) {
    try {
      var body = JSON.stringify(Object.assign({
        url: location.pathname + location.search,
        ua: navigator.userAgent,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        themeInStorage: localStorage.getItem('tsang-travel-theme'),
      }, payload));
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/diag', body);
      } else {
        fetch('/api/diag', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch (e) {}
  }

  // Capture the FULL stack trace by wrapping Error constructors.
  var OrigError = window.Error;
  window.Error = function(msg) {
    var e = new OrigError(msg);
    var origStack = e.stack;
    return new Proxy(e, {
      get: function(target, prop) {
        if (prop === 'stack') {
          var origGet = function() { return origStack; };
          return origGet.call(target);
        }
        return target[prop];
      }
    });
  };

  // Walk a React fiber tree to dump the component chain (for hydration errors).
  function walkFiber(fiber, depth) {
    if (!fiber || depth > 12) return null;
    var info = {
      type: typeof fiber.type === 'string' ? fiber.type :
            (fiber.type && (fiber.type.displayName || fiber.type.name || fiber.type.$$typeof)) || '?',
      key: fiber.key || null,
      pendingPropsKeys: fiber.pendingProps ? Object.keys(fiber.pendingProps).slice(0, 20) : [],
      memoizedPropsKeys: fiber.memoizedProps ? Object.keys(fiber.memoizedProps).slice(0, 20) : [],
    };
    if (fiber.return) info.parent = walkFiber(fiber.return, depth + 1);
    return info;
  }

  function findClosestFiber(node) {
    var keys = Object.keys(node).filter(function(k){return k.indexOf('__reactFiber') === 0;});
    if (keys.length === 0) return null;
    return node[keys[0]];
  }

  // Capture the FULL stack trace by wrapping Error constructors.
  window.addEventListener('error', function(e) {
    var msg = (e?.message || '').toString();
    if (msg.indexOf('Minified React error #418') !== -1 || msg.indexOf('Hydration') !== -1 || msg.indexOf('did not match') !== -1) {
      // Capture the body DOM at this instant
      var domSnapshot = '';
      try {
        var body = document.body;
        if (body) domSnapshot = dumpDOMAround(body, 0).substring(0, 5000);
      } catch (_) {}

      // Walk the React fiber tree from the body element to find the mismatched component.
      var fiberChain = null;
      try {
        var fiber = findClosestFiber(document.body);
        fiberChain = walkFiber(fiber, 0);
      } catch (_) {}

      // Also dump <main> contents since the dashboard renders inside <main>
      var mainSnapshot = '';
      try {
        var main = document.querySelector('main');
        if (main) mainSnapshot = dumpDOMAround(main, 0).substring(0, 5000);
      } catch (_) {}

      post({
        kind: 'window.error',
        text: msg.substring(0, 2000),
        filename: e?.filename || '',
        lineno: e?.lineno,
        colno: e?.colno,
        domSnapshot: domSnapshot,
        mainSnapshot: mainSnapshot,
        fiberChain: fiberChain,
        reactProps: (function() {
          try {
            var keys = Object.keys(document.documentElement).filter(function(k){return k.startsWith('__react')});
            return keys;
          } catch (_) { return []; }
        })(),
      });
    }
  });

  // Also catch the original console.error which has the real unminified message
  // in dev. We override it BEFORE React mounts so we get the first call.
  var origConsoleError = console.error.bind(console);
  console.error = function() {
    try {
      var text = Array.prototype.slice.call(arguments).map(function(a) {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a); } catch (_) { return String(a); }
      }).join(' ');
      if (text.indexOf('did not match') !== -1 || text.indexOf('Hydration') !== -1 || text.indexOf('Minified React error #418') !== -1 || text.indexOf('Text content') !== -1) {
        post({ kind: 'console.error', text: text.substring(0, 8000) });
      }
    } catch (_) {}
    return origConsoleError.apply(console, arguments);
  };
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
