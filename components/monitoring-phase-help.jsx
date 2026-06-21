'use client';

import { useState } from 'react';
import { formatMonitoringPhaseTooltip } from '@/lib/monitoring-phase.mjs';

export function MonitoringPhaseHelp({ phase, label }) {
  const [open, setOpen] = useState(false);
  const tooltip = formatMonitoringPhaseTooltip(phase);

  return (
    <div className="monitoring-status-help">
      <button
        type="button"
        className="monitoring-status-help-toggle"
        aria-expanded={open}
        aria-label={`Show phase guide for ${label}`}
        title={tooltip}
        onClick={() => setOpen(current => !current)}
      >
        i
      </button>
      {open ? <pre className="monitoring-status-help-panel">{tooltip}</pre> : null}
    </div>
  );
}
