import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PROVINCES, type Retailer, type SuggestionKind } from '../../shared/const';
import { getRetailers, postSuggestion } from '../lib/api';
import { useT } from '../lib/i18n';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string;

export default function SuggestPage() {
  const t = useT();
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [token, setToken] = useState('');
  const [kind, setKind] = useState<SuggestionKind>('new');
  const [widgetFailed, setWidgetFailed] = useState(false);
  const [retailerList, setRetailerList] = useState<Retailer[]>([]);
  const [f, setF] = useState({ name: '', address: '', city: '', province: '', website: '', note: '' });
  const setField = (k: keyof typeof f, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  // Retailers for the update-mode datalist + autofill — public data, already edge-cached
  useEffect(() => {
    if (kind === 'update' && retailerList.length === 0) {
      getRetailers().then((rs) => setRetailerList([...rs].sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
    }
  }, [kind, retailerList.length]);

  // Picking a listed retailer (exact name match) prefills its current details for correction
  const onNameChange = (v: string) => {
    const m = kind === 'update' ? retailerList.find((r) => r.name === v) : undefined;
    if (m) {
      setF((prev) => ({ ...prev, name: v, address: m.address, city: m.city, province: m.province, website: m.website ?? '' }));
    } else {
      setField('name', v);
    }
  };
  const widget = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const widgetId = useRef<string>('');

  useEffect(() => {
    const render = () => {
      if (rendered.current || !widget.current || !window.turnstile) return;
      rendered.current = true;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: SITEKEY,
        callback: setToken,
        'expired-callback': () => setToken(''),
        'error-callback': () => setWidgetFailed(true),
      });
    };
    if (window.turnstile) { render(); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://challenges.cloudflare.com/turnstile/"]');
    if (existing) { existing.addEventListener('load', render); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await postSuggestion({
        kind,
        name: (kind !== 'feedback' && f.name) || undefined,
        address: (kind !== 'feedback' && f.address) || undefined,
        city: (kind !== 'feedback' && f.city) || undefined,
        province: (kind !== 'feedback' && f.province) || undefined,
        website: (kind !== 'feedback' && f.website) || undefined,
        note: f.note || undefined,
        turnstileToken: token,
      });
      setStatus('done');
    } catch {
      setToken('');
      window.turnstile?.reset(widgetId.current);
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="doc-page">
        <div className="mx-auto max-w-xl border-l-2 border-brand bg-white px-6 py-8">
          <p className="eyebrow">{t('suggest_eyebrow')}</p>
          <p className="mt-2 font-prose text-[17px] leading-relaxed text-ink">{t('s_thanks')}</p>
        </div>
      </div>
    );
  }

  const field = 'field';
  const KINDS: Array<{ v: SuggestionKind; label: string }> = [
    { v: 'new', label: t('s_kind_new') },
    { v: 'update', label: t('s_kind_update') },
    { v: 'feedback', label: t('s_kind_feedback') },
  ];

  return (
    <div className="doc-page">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <p className="eyebrow">{t('suggest_eyebrow')}</p>
          <h1 className="mt-2 font-display text-[2.1rem] font-bold uppercase leading-[1.08] text-ink sm:text-[2.6rem]">
            {t('suggest_title')}
          </h1>
          <p className="doc-prose mt-4 max-w-[62ch]">{t('suggest_intro')}</p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
        <fieldset>
          <legend className="field-label">{t('s_kind')}</legend>
          {/* Three named choices beat a dropdown: the whole scope is visible at once. */}
          <div className="mt-1.5 grid gap-px border border-rule bg-rule sm:grid-cols-3">
            {KINDS.map((k) => (
              <button
                key={k.v}
                type="button"
                onClick={() => setKind(k.v)}
                aria-pressed={kind === k.v}
                className={`px-3 py-2.5 text-left font-display text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors duration-[var(--dur-fast)] ${
                  kind === k.v ? 'bg-ink text-white' : 'bg-white text-steel hover:text-ink'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>
        {kind !== 'feedback' && (
          <>
            <label className="field-label">{kind === 'update' ? t('s_name_update') : t('s_name')}
              <input value={f.name} onChange={(e) => onNameChange(e.target.value)} required maxLength={120} className={field} list={kind === 'update' ? 'retailer-names' : undefined} />
            </label>
            {kind === 'update' && (
              <datalist id="retailer-names">
                {retailerList.map((r) => <option key={r.id} value={r.name} />)}
              </datalist>
            )}
            <label className="field-label">{t('s_address')}<input value={f.address} onChange={(e) => setField('address', e.target.value)} maxLength={200} className={field} /></label>
            <div className="flex gap-4">
              <label className="field-label flex-1">{t('s_city')}<input value={f.city} onChange={(e) => setField('city', e.target.value)} maxLength={80} className={field} /></label>
              <label className="field-label">{t('s_province')}
                <select value={f.province} onChange={(e) => setField('province', e.target.value)} className={field}>
                  <option value="">—</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="field-label">{t('s_website')}<input value={f.website} onChange={(e) => setField('website', e.target.value)} type="url" pattern="https?://.*" maxLength={200} className={field} placeholder="https://" /></label>
          </>
        )}
        <label className="field-label">{kind === 'new' ? t('s_note') : t('s_note_required')}
          <textarea value={f.note} onChange={(e) => setField('note', e.target.value)} required={kind !== 'new'} maxLength={1000} rows={kind === 'feedback' ? 6 : 3} className={field} />
        </label>
        <div ref={widget} />
        {!token && (
          <p className={`font-prose text-[13px] ${widgetFailed ? 'text-brand-deep' : 'text-steel'}`}>
            {widgetFailed ? t('s_verify_failed') : t('s_verifying')}
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'sending' || !token}
          className="bg-brand px-5 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.12em] text-white transition-colors duration-[var(--dur-fast)] hover:bg-brand-deep active:scale-[var(--press)] disabled:cursor-not-allowed disabled:bg-steel/40"
        >
          {status === 'sending' ? t('s_sending') : t('s_submit')}
        </button>
        {status === 'error' && <p className="font-prose text-[14px] text-brand-deep">{t('s_error')}</p>}
      </form>
        </div>

        <aside className="lg:pt-14">
          <div className="border-t-2 border-ink pt-4">
            <h2 className="eyebrow text-ink">{t('s_how_title')}</h2>
            <ol className="mt-3 space-y-3">
              {[t('s_how_1'), t('s_how_2'), t('s_how_3')].map((line, i) => (
                <li key={i} className="flex gap-3 font-prose text-[13px] leading-snug text-steel">
                  <span className="font-display text-[12px] font-semibold text-brand tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
