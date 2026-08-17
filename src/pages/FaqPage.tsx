import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartData, Faq } from '../../shared/const';
import Bullseye from '../components/Bullseye';
import { CtChart, PerCapitaChart } from '../components/Charts';
import { getCharts, getFaqs, getMeta } from '../lib/api';
import { useLang, useT } from '../lib/i18n';
import { Rich } from '../lib/richtext';

// Two published charts are embedded in answers as images. Swap those for the
// interactive versions; any other image still renders through Rich.
const CHARTS: Record<string, 'percapita' | 'ct'> = {
  '/sheets/gun-stores-per-capita-wide.svg': 'percapita',
  '/sheets/gun-stores-per-capita-wide-fr.svg': 'percapita',
  '/sheets/ct-firearms-by-province.svg': 'ct',
  '/sheets/ct-firearms-by-province-fr.svg': 'ct',
};

type Part = { kind: 'text'; value: string } | { kind: 'chart'; value: 'percapita' | 'ct' };

function splitAnswer(text: string): Part[] {
  const re = /!\[[^\]]*\]\(([^)\s]+)\)/g;
  const parts: Part[] = [];
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const chart = CHARTS[m[1]];
    if (!chart) continue;
    if (m.index > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'chart', value: chart });
    last = m.index + m[0].length;
  }
  parts.push({ kind: 'text', value: text.slice(last) });
  return parts.filter((p) => p.kind === 'chart' || p.value.trim().length > 0);
}

export default function FaqPage() {
  const t = useT();
  const { lang } = useLang();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [asOf, setAsOf] = useState('');
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const refs = useRef<Record<number, HTMLDetailsElement | null>>({});

  useEffect(() => {
    getFaqs().then(setFaqs).catch(() => setError(true));
    getMeta().then((m) => setAsOf(m.asOf)).catch(() => {});
  }, []);

  const answer = (f: Faq) => (lang === 'fr' && f.answer_fr ? f.answer_fr : f.answer_en);
  const question = (f: Faq) => (lang === 'fr' && f.question_fr ? f.question_fr : f.question_en);
  const parsed = useMemo(() => faqs.map((f) => splitAnswer(answer(f))), [faqs, lang]);
  const needsCharts = parsed.some((ps) => ps.some((p) => p.kind === 'chart'));

  useEffect(() => {
    if (!needsCharts || charts) return;
    getCharts().then(setCharts).catch(() => {});
  }, [needsCharts, charts]);

  const toggle = (id: number, isOpen: boolean) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(id); else next.delete(id);
      return next;
    });

  // Index entries toggle: clicking an open question closes it again. Only scroll
  // when opening — jumping the page on close would move what you just clicked.
  const jump = (id: number) => {
    const wasOpen = open.has(id);
    setOpen((prev) => {
      const next = new Set(prev);
      if (wasOpen) next.delete(id); else next.add(id);
      return next;
    });
    if (!wasOpen) {
      requestAnimationFrame(() => refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  const allOpen = faqs.length > 0 && open.size === faqs.length;

  return (
    <div className="doc-page">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">{t('faq_eyebrow')}</p>
        <h1 className="mt-2 font-display text-[2.1rem] font-bold uppercase leading-[1.08] text-ink sm:text-[2.6rem]">
          {t('faq_title')}
        </h1>

        {faqs.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-prose text-[13px] text-steel">
            <span className="tabular-nums">{faqs.length} {t('faq_count')}</span>
            {asOf && (
              <>
                <span aria-hidden="true" className="text-rule">|</span>
                <span>
                  {t('data_as_of')}{' '}
                  {new Date(asOf.replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-rule">|</span>
            <button
              onClick={() => setOpen(allOpen ? new Set() : new Set(faqs.map((f) => f.id)))}
              className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep underline decoration-brand/40 underline-offset-[3px] transition-colors duration-[var(--dur-fast)] hover:decoration-brand"
            >
              {allOpen ? t('faq_collapse') : t('faq_expand')}
            </button>
          </p>
        )}

        {error && <p className="mt-6 font-prose text-[15px] text-brand-deep">{t('load_error')}</p>}
        {!error && faqs.length === 0 && <p className="mt-6 font-prose text-[15px] text-steel">{t('faq_empty')}</p>}

        {faqs.length > 0 && (
          <div className="mt-8 grid gap-10 lg:grid-cols-[13rem_minmax(0,1fr)]">
            {/* Index — with this many entries, the list is worth having up front. */}
            <nav aria-label={t('faq_index')} className="hidden lg:block">
              <div className="sticky top-6 border-t border-rule pt-3">
                <p className="eyebrow mb-2">{t('faq_index')}</p>
                <ol className="space-y-1.5">
                  {faqs.map((f, i) => (
                    <li
                      key={f.id}
                      className={`flex gap-2 border-l-2 py-1 pl-2 transition-colors duration-[var(--dur)] ${
                        open.has(f.id) ? 'border-brand bg-white' : 'border-transparent'
                      }`}
                    >
                      <span className={`font-display text-[11px] font-semibold tabular-nums transition-colors duration-[var(--dur-fast)] ${open.has(f.id) ? 'text-brand' : 'text-brand/60'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <button
                        onClick={() => jump(f.id)}
                        aria-expanded={open.has(f.id)}
                        aria-controls={`q${i + 1}`}
                        className={`text-left font-prose text-[12.5px] leading-snug transition-colors duration-[var(--dur-fast)] hover:text-ink ${
                          open.has(f.id) ? 'font-semibold text-ink' : 'text-steel'
                        }`}
                      >
                        {question(f)}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </nav>

            <div className="stagger min-w-0 border-t border-rule">
              {faqs.map((f, i) => {
                const isOpen = open.has(f.id);
                return (
                  <details
                    key={f.id}
                    id={`q${i + 1}`}
                    ref={(el) => { refs.current[f.id] = el; }}
                    open={isOpen}
                    onToggle={(e) => toggle(f.id, (e.target as HTMLDetailsElement).open)}
                    style={{ ['--i' as string]: i }}
                    className={`group border-b border-rule transition-colors duration-[var(--dur)] ${isOpen ? 'bg-white/55' : ''}`}
                  >
                    <summary className={`flex cursor-pointer list-none items-baseline gap-3 py-4 pl-2 pr-2 transition-colors duration-[var(--dur)] sm:gap-5 [&::-webkit-details-marker]:hidden ${isOpen ? 'border-b border-rule bg-ink/[0.05]' : ''}`}>
                      <span className={`w-6 shrink-0 font-display text-[13px] font-semibold tabular-nums transition-colors duration-[var(--dur-fast)] sm:w-8 ${isOpen ? 'text-brand' : 'text-brand/70'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <h2 className="flex-1 font-display text-[1.05rem] font-semibold leading-snug text-ink transition-colors duration-[var(--dur-fast)] group-hover:text-brand-deep sm:text-[1.2rem]">
                        {question(f)}
                      </h2>
                      <Bullseye open={isOpen} className={`mt-1 transition-colors duration-[var(--dur-fast)] ${isOpen ? 'text-ink' : 'text-steel'}`} />
                    </summary>
                    <div className="ml-9 pb-6 pr-2 sm:ml-[3.25rem]">
                      {parsed[i]?.map((part, j) =>
                        part.kind === 'text' ? (
                          <Rich key={j} className="doc-prose max-w-[64ch] whitespace-pre-line" text={part.value} />
                        ) : charts ? (
                          part.value === 'percapita'
                            ? <PerCapitaChart key={j} data={charts} />
                            : <CtChart key={j} data={charts} />
                        ) : (
                          <p key={j} className="my-6 font-prose text-[13px] text-steel">…</p>
                        ),
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
