'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * DebugPanel — a floating, non-modal diagnostic panel surfaced only to
 * signed-in users.  Computes its snapshot once per open and exposes
 * per-section and full-snapshot clipboard copy.
 *
 * @param {object}   props
 * @param {boolean}  props.isOpen
 * @param {Function} props.onClose
 * @param {object}   props.debugSnapshot  — already-computed snapshot object
 */
export function DebugPanel({ isOpen, onClose, debugSnapshot }) {
  const [copiedSection, setCopiedSection] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [fallbackText, setFallbackText] = useState(null);
  const fallbackRef = useRef(null);

  const clearCopied = useCallback(() => {
    setCopiedSection(null);
    setCopiedAll(false);
  }, []);

  // Auto-clear the copied indicator after 2 s so the live-region fires each copy.
  useEffect(() => {
    if (copiedSection === null && copiedAll === false) return undefined;
    const id = setTimeout(clearCopied, 2000);
    return () => clearTimeout(id);
  }, [copiedSection, copiedAll, clearCopied]);

  async function copyText(text, sectionKey) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Insecure context fallback: select and copy via textarea.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch {
      setFallbackText(text);
      window.setTimeout(() => fallbackRef.current?.focus(), 0);
      return;
    }
    if (sectionKey === 'all') {
      setCopiedAll(true);
    } else {
      setCopiedSection(sectionKey);
    }
  }

  function handleCopySection(sectionKey, data) {
    void copyText(JSON.stringify(data, null, 2), sectionKey);
  }

  function handleCopyAll() {
    void copyText(JSON.stringify(debugSnapshot, null, 2), 'all');
  }

  if (!isOpen || !debugSnapshot) return null;

  const { meta, session, portfolio, trips, uiState, environment, notes } = debugSnapshot;

  const sections = [
    {
      key: 'meta',
      title: 'Meta',
      section: meta,
    },
    {
      key: 'session',
      title: 'Session',
      section: session,
    },
    {
      key: 'portfolio',
      title: 'Portfolio',
      section: portfolio,
    },
    {
      key: 'trips',
      title: `Trips (${Array.isArray(trips?.data) ? trips.data.length : 0})`,
      section: trips,
    },
    {
      key: 'uiState',
      title: 'UI State',
      section: uiState,
    },
    {
      key: 'environment',
      title: 'Environment',
      section: environment,
    },
    {
      key: 'notes',
      title: 'Notes',
      section: notes,
    },
  ];

  return (
    <>
      <aside
        className="debug-panel"
        role="region"
        aria-label="Debug snapshot"
      >
        <header className="debug-panel-header">
          <h2 className="debug-panel-title">🛠 Debug snapshot</h2>
          <button
            aria-label="Close debug panel"
            className="debug-panel-close"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="debug-panel-body">
          {sections.map(({ key, title, section }) => {
            const data = section?.data ?? null;
            return (
            <section key={key} className="debug-section">
              <div className="debug-section-header">
                <h3 className="debug-section-title">{title}</h3>
                <button
                  aria-label={`Copy ${title} section`}
                  className="debug-copy-btn"
                  type="button"
                  onClick={() => handleCopySection(key, data)}
                >
                  {copiedSection === key ? '✅' : '📋'} Copy
                </button>
              </div>
              <pre className="debug-pre">{JSON.stringify(data, null, 2)}</pre>
            </section>
            );
          })}
        </div>

        <footer className="debug-panel-footer">
          <button
            aria-label="Copy full debug snapshot as JSON"
            className="debug-copy-all-btn"
            type="button"
            onClick={handleCopyAll}
          >
            {copiedAll ? '✅ Copied' : '📋 Copy all (JSON)'}
          </button>
          {copiedAll && (
            <span aria-live="polite" className="debug-copied-indicator">
              Full snapshot copied to clipboard
            </span>
          )}
        </footer>

        {fallbackText ? (
          <div className="debug-copy-fallback" role="dialog" aria-modal="false" aria-label="Manual copy fallback">
            <p>Clipboard access is blocked. Select the JSON below and press ⌘/Ctrl-C to copy.</p>
            <textarea
              ref={fallbackRef}
              className="debug-fallback-textarea"
              value={fallbackText}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              className="debug-copy-btn"
              type="button"
              onClick={() => setFallbackText(null)}
            >
              Close
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}
