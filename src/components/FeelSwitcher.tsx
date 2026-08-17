import { useState } from 'react';
import { FEELS, applyFeel, feelName, type FeelName } from '../lib/feel';

// Local comparison tool: only mounts when ?feel is in the URL, so it can never
// appear for a visitor. Switching reloads so the map picks up new paint timings.
export default function FeelSwitcher() {
  const [name, setName] = useState<FeelName>(feelName);
  const pick = (n: FeelName) => {
    applyFeel(n);
    setName(n);
    const u = new URL(window.location.href);
    u.searchParams.set('feel', n);
    window.location.replace(u.toString());
  };
  return (
    <div className="fixed bottom-3 right-3 z-50 w-64 rounded-lg border border-slate-300 bg-white/95 p-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 px-1 font-semibold text-slate-700">Motion preset</div>
      <div className="flex flex-col gap-1">
        {(Object.keys(FEELS) as FeelName[]).map((n) => (
          <button
            key={n}
            onClick={() => pick(n)}
            className={`rounded-md px-2 py-1.5 text-left transition-colors ${
              n === name ? 'bg-slate-800 text-white' : 'hover:bg-slate-100'
            }`}
          >
            <div className="font-medium">{FEELS[n].label}</div>
            <div className={n === name ? 'text-slate-300' : 'text-slate-500'}>{FEELS[n].note}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
