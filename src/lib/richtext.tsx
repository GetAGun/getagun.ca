// Minimal formatting for admin-authored text: [label](https://url), ![alt](/img.png),
// **bold**, *italic*. Input is HTML-escaped first; only tags generated here reach the DOM.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SAFE_HREF = /^(https?:\/\/|\/)/;

export function richtextHtml(src: string): string {
  const anchors: string[] = [];
  // Images before links — the image syntax contains the link syntax.
  let out = escapeHtml(src).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, alt: string, imgSrc: string) => {
    if (!SAFE_HREF.test(imgSrc)) return whole;
    anchors.push(`<img src="${imgSrc}" alt="${alt}" loading="lazy" class="mt-2 max-w-full rounded-md border border-slate-200" />`);
    return `\u0000${anchors.length - 1}\u0000`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
    if (!SAFE_HREF.test(href)) return whole;
    anchors.push(`<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">${label}</a>`);
    return `\u0000${anchors.length - 1}\u0000`;
  });
  out = out
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, i: string) => anchors[Number(i)]);
  return out;
}

export function Rich({ text, className }: { text: string; className?: string }) {
  return <p className={className} dangerouslySetInnerHTML={{ __html: richtextHtml(text) }} />;
}
