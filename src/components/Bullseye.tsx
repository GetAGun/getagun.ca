// Expand/collapse marker: a target that gets its centre shot out when the
// section opens. Sits in place of the usual plus/chevron.
export default function Bullseye({ open = false, className = '' }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 overflow-visible ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="8" cy="8" r="6.4" />
      <circle
        cx="8"
        cy="8"
        r="3.3"
        className={`transition-opacity duration-[var(--dur)] ease-[var(--ease)] ${open ? 'opacity-100' : 'opacity-55'}`}
      />
      {/* Sight ticks — they read as a reticle rather than a plain set of rings. */}
      <path d="M8 0v2.1M8 13.9V16M0 8h2.1M13.9 8H16" strokeLinecap="round" />
      <circle
        cx="8"
        cy="8"
        r="1.5"
        stroke="none"
        className={`transition-[fill] duration-[var(--dur)] ease-[var(--ease)] ${open ? 'fill-brand' : 'fill-transparent'}`}
      />
    </svg>
  );
}
