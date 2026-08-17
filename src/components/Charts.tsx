import { useState } from 'react';
import { PROVINCE_POP, TERRITORIES, type ChartData } from '../../shared/const';
import { useLang } from '../lib/i18n';

// Interactive versions of the two published charts. They read the same numbers
// the worker draws its SVGs from (/api/charts), so the figures can't diverge.

const T = {
  en: {
    perCapitaTitle: 'Gun stores per 100,000 residents',
    ctTitle: 'Canadian Tire locations stocking firearms',
    prov: 'Prov/Terr', stores: 'Stores', pop: 'Population', per: 'Per 100k',
    canada: 'Canada', terrNote: 'Territories are ranked separately, on their own bar scale — very small populations produce rates many times the provincial range.',
    stocks: 'stocks firearms', notStocks: 'does not', of: 'of',
  },
  fr: {
    perCapitaTitle: 'Magasins par 100 000 habitants',
    ctTitle: 'Canadian Tire vendant des armes à feu',
    prov: 'Prov./Terr.', stores: 'Magasins', pop: 'Population', per: 'Par 100 000',
    canada: 'Canada', terrNote: 'Les territoires sont classés séparément, avec leur propre échelle — leurs très faibles populations produisent des taux bien supérieurs à ceux des provinces.',
    stocks: 'vend des armes à feu', notStocks: "n'en vend pas", of: 'sur',
  },
};

const fmt = (n: number, lang: 'en' | 'fr') => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA');
const fmt1 = (n: number, lang: 'en' | 'fr') => (lang === 'fr' ? n.toFixed(1).replace('.', ',') : n.toFixed(1));
// French sets a non-breaking space before the percent sign.
const pct = (part: number, whole: number, lang: 'en' | 'fr') => {
  const v = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return lang === 'fr' ? `${v}\u00a0%` : `${v}%`;
};

export function PerCapitaChart({ data }: { data: ChartData }) {
  const { lang } = useLang();
  const t = T[lang];
  const [active, setActive] = useState<string | null>(null);

  const rate = (p: string) => ((data.counts[p] ?? 0) / PROVINCE_POP[p]) * 1e5;
  const provs = Object.keys(PROVINCE_POP).filter((p) => !TERRITORIES.includes(p)).sort((a, b) => rate(b) - rate(a));
  const terrs = [...TERRITORIES].sort((a, b) => rate(b) - rate(a));
  const totalStores = Object.values(data.counts).reduce((s, n) => s + n, 0);
  const totalPop = Object.values(PROVINCE_POP).reduce((s, n) => s + n, 0);
  const provMax = Math.max(...provs.map(rate));
  const terrMax = Math.max(...terrs.map(rate));

  const Row = ({ p, max }: { p: string; max: number }) => {
    const on = active === p;
    const r = rate(p);
    return (
      <tr
        onMouseEnter={() => setActive(p)}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(p)}
        onBlur={() => setActive(null)}
        tabIndex={0}
        className={`border-b border-rule/70 outline-none transition-colors duration-[var(--dur-fast)] ${on ? 'bg-ink/[0.045]' : ''}`}
      >
        <th scope="row" className="py-1.5 pr-2 text-left font-display text-[13px] font-semibold text-ink">{p}</th>
        <td className="py-1.5 pr-3 text-right font-prose text-[13px] tabular-nums text-ink/80">{fmt(data.counts[p] ?? 0, lang)}</td>
        <td className="hidden py-1.5 pr-4 text-right font-prose text-[13px] tabular-nums text-steel sm:table-cell">{fmt(PROVINCE_POP[p], lang)}</td>
        <td className="w-1/2 py-1.5">
          <span className="flex items-center gap-2">
            <span className="relative block h-[10px] flex-1 bg-ink/[0.06]">
              <span
                className="absolute inset-y-0 left-0 transition-[width,background-color] duration-[var(--dur)] ease-[var(--ease)]"
                style={{ width: `${(r / max) * 100}%`, background: on ? '#a8141a' : '#e6262a' }}
              />
            </span>
            <span className={`w-10 shrink-0 text-right font-display text-[13px] font-semibold tabular-nums transition-colors duration-[var(--dur-fast)] ${on ? 'text-brand-deep' : 'text-ink/70'}`}>
              {fmt1(r, lang)}
            </span>
          </span>
        </td>
      </tr>
    );
  };

  return (
    <figure className="not-prose my-6 border-t-2 border-ink pt-3">
      <figcaption className="eyebrow mb-2 text-ink">{t.perCapitaTitle}</figcaption>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-rule">
            <th className="pb-1 text-left font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">{t.prov}</th>
            <th className="pb-1 pr-3 text-right font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">{t.stores}</th>
            <th className="hidden pb-1 pr-4 text-right font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-steel sm:table-cell">{t.pop}</th>
            <th className="pb-1 text-left font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-steel">{t.per}</th>
          </tr>
        </thead>
        <tbody>
          {provs.map((p) => <Row key={p} p={p} max={provMax} />)}
          <tr className="border-b-2 border-ink/70 bg-ink/[0.03]">
            <th scope="row" className="py-1.5 pr-2 text-left font-display text-[13px] font-bold text-ink">{t.canada}</th>
            <td className="py-1.5 pr-3 text-right font-prose text-[13px] font-semibold tabular-nums text-ink">{fmt(totalStores, lang)}</td>
            <td className="hidden py-1.5 pr-4 text-right font-prose text-[13px] tabular-nums text-steel sm:table-cell">{fmt(totalPop, lang)}</td>
            <td className="py-1.5 pl-2 font-display text-[13px] font-bold tabular-nums text-ink">{fmt1((totalStores / totalPop) * 1e5, lang)}</td>
          </tr>
          {terrs.map((p) => <Row key={p} p={p} max={terrMax} />)}
        </tbody>
      </table>
      <p className="mt-2 font-prose text-[12px] italic leading-snug text-steel">{t.terrNote}</p>
    </figure>
  );
}

export function CtChart({ data }: { data: ChartData }) {
  const { lang } = useLang();
  const t = T[lang];
  const [active, setActive] = useState<string | null>(null);
  const rows = [...data.ct].sort((a, b) => b.yes + b.no - (a.yes + a.no));
  const max = Math.max(...rows.map((r) => r.yes + r.no), 1);

  return (
    <figure className="not-prose my-6 border-t-2 border-ink pt-3">
      <figcaption className="eyebrow mb-1 text-ink">{t.ctTitle}</figcaption>
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-prose text-[12px] text-steel">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 bg-brand" />{t.stocks}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 bg-ink/15" />{t.notStocks}</span>
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const total = r.yes + r.no;
          const on = active === r.prov;
          return (
            <div
              key={r.prov}
              tabIndex={0}
              onMouseEnter={() => setActive(r.prov)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(r.prov)}
              onBlur={() => setActive(null)}
              className={`flex items-center gap-2 px-1 py-0.5 outline-none transition-colors duration-[var(--dur-fast)] ${on ? 'bg-ink/[0.045]' : ''}`}
            >
              <span className="w-8 shrink-0 font-display text-[13px] font-semibold text-ink">{r.prov}</span>
              <span className="relative flex h-4 flex-1 bg-ink/[0.05]" style={{ maxWidth: `${(total / max) * 100}%` }}>
                <span
                  className="h-full transition-[background-color] duration-[var(--dur-fast)]"
                  style={{ width: `${(r.yes / total) * 100}%`, background: on ? '#a8141a' : '#e6262a' }}
                />
                <span className="h-full flex-1 bg-ink/15" />
              </span>
              <span className={`shrink-0 font-display text-[12px] tabular-nums transition-colors duration-[var(--dur-fast)] ${on ? 'text-ink' : 'text-steel'}`}>
                {on ? `${fmt(r.yes, lang)} ${t.of} ${fmt(total, lang)}` : fmt(r.yes, lang)}
              </span>
              {/* Share matters as much as the count: 34% of Alberta's stock firearms
                  against 35% of Ontario's, on very different totals. */}
              <span className={`w-11 shrink-0 text-right font-display text-[12px] font-semibold tabular-nums transition-colors duration-[var(--dur-fast)] ${on ? 'text-brand-deep' : 'text-ink/55'}`}>
                {pct(r.yes, total, lang)}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
