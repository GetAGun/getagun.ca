// Site-wide interface scale. CSS `zoom` is used rather than a transform because
// it changes layout metrics the way browser zoom does: the chrome gets smaller
// *and* the map container gains CSS pixels, so more geography fits on screen and
// MapLibre draws its labels at the new size. A transform would only magnify.

export const SCALES = [0.7, 0.8, 0.9, 1, 1.1] as const;
export const DEFAULT_SCALE = 0.8;

const KEY = 'ui-scale';

export function uiScale(): number {
  const v = Number(localStorage.getItem(KEY));
  return (SCALES as readonly number[]).includes(v) ? v : DEFAULT_SCALE;
}

export function applyUiScale(v: number) {
  document.documentElement.style.zoom = String(v);
  localStorage.setItem(KEY, String(v));
  // The map sizes itself to its container; tell it the container changed.
  window.dispatchEvent(new Event('resize'));
}

/** Next/previous allowed step, clamped to the ends. */
export function stepScale(current: number, dir: 1 | -1): number {
  const i = SCALES.indexOf(current as typeof SCALES[number]);
  const next = Math.min(SCALES.length - 1, Math.max(0, (i === -1 ? SCALES.indexOf(DEFAULT_SCALE) : i) + dir));
  return SCALES[next];
}
