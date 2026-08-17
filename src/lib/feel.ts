// Motion presets. Everything timing-related in the UI reads from these custom
// properties, so a whole "feel" swaps by setting variables on <html> — no
// component knows which preset is active.
//
// Try them locally with ?feel=calm | snappy | fluid (a switcher appears).

export interface Feel {
  label: string;
  note: string;
  vars: Record<string, string>;
  /** MapLibre paint-transition duration, ms — pin resize and choropleth fade. */
  paintMs: number;
  /** flyTo easing: lower speed is a longer, gentler camera move. */
  fly: { speed: number; curve: number };
}

export const FEELS: Record<string, Feel> = {
  current: {
    label: 'Current',
    note: 'What is live today — 150–200ms, snap-in panels, no map easing.',
    vars: {
      '--dur-fast': '150ms',
      '--dur': '180ms',
      '--dur-slow': '200ms',
      '--ease': 'cubic-bezier(0, 0, 0.2, 1)',
      '--press': '0.97',
      '--stagger': '0ms',
      '--rise': '4px',
    },
    paintMs: 0,
    fly: { speed: 1.2, curve: 1.42 },
  },
  calm: {
    label: 'Calm',
    note: 'Slower and deliberate. Long ease-out, gentle fades, no bounce.',
    vars: {
      '--dur-fast': '180ms',
      '--dur': '280ms',
      '--dur-slow': '420ms',
      '--ease': 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      '--press': '0.985',
      '--stagger': '18ms',
      '--rise': '6px',
    },
    paintMs: 320,
    fly: { speed: 0.7, curve: 1.2 },
  },
  snappy: {
    label: 'Snappy',
    note: 'Immediate and crisp. Short durations, firm press feedback.',
    vars: {
      '--dur-fast': '90ms',
      '--dur': '120ms',
      '--dur-slow': '160ms',
      '--ease': 'cubic-bezier(0.3, 0, 0.2, 1)',
      '--press': '0.95',
      '--stagger': '8ms',
      '--rise': '3px',
    },
    paintMs: 140,
    fly: { speed: 1.6, curve: 1.6 },
  },
  fluid: {
    label: 'Fluid',
    note: 'Organic. Slight overshoot on controls, staggered reveals, eased camera.',
    vars: {
      '--dur-fast': '160ms',
      '--dur': '240ms',
      '--dur-slow': '380ms',
      '--ease': 'cubic-bezier(0.34, 1.36, 0.64, 1)',
      '--press': '0.96',
      '--stagger': '28ms',
      '--rise': '8px',
    },
    paintMs: 260,
    fly: { speed: 0.9, curve: 1.3 },
  },
};

export type FeelName = keyof typeof FEELS;

const KEY = 'ui-feel';

export function feelName(): FeelName {
  const q = new URLSearchParams(window.location.search).get('feel');
  if (q && q in FEELS) return q;
  const saved = localStorage.getItem(KEY);
  return saved && saved in FEELS ? saved : 'current';
}

export function applyFeel(name: FeelName) {
  const f = FEELS[name] ?? FEELS.current;
  for (const [k, v] of Object.entries(f.vars)) document.documentElement.style.setProperty(k, v);
  document.documentElement.dataset.feel = name;
  localStorage.setItem(KEY, name);
}

export const currentFeel = (): Feel => FEELS[feelName()] ?? FEELS.current;

/** True when ?feel is in the URL — gates the on-screen switcher. */
export const feelSwitcherEnabled = () => new URLSearchParams(window.location.search).has('feel');
