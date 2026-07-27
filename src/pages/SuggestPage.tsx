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
    return <p className="mx-auto max-w-xl p-8 text-center text-lg">{t('s_thanks')}</p>;
  }

  const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-xl overflow-y-auto p-6">
      <h1 className="text-2xl font-bold">{t('suggest_title')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('suggest_intro')}</p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm">{t('s_kind')}
          <select value={kind} onChange={(e) => setKind(e.target.value as SuggestionKind)} className={field}>
            <option value="new">{t('s_kind_new')}</option>
            <option value="update">{t('s_kind_update')}</option>
            <option value="feedback">{t('s_kind_feedback')}</option>
          </select>
        </label>
        {kind !== 'feedback' && (
          <>
            <label className="text-sm">{kind === 'update' ? t('s_name_update') : t('s_name')}
              <input value={f.name} onChange={(e) => onNameChange(e.target.value)} required maxLength={120} className={field} list={kind === 'update' ? 'retailer-names' : undefined} />
            </label>
            {kind === 'update' && (
              <datalist id="retailer-names">
                {retailerList.map((r) => <option key={r.id} value={r.name} />)}
              </datalist>
            )}
            <label className="text-sm">{t('s_address')}<input value={f.address} onChange={(e) => setField('address', e.target.value)} maxLength={200} className={field} /></label>
            <div className="flex gap-3">
              <label className="flex-1 text-sm">{t('s_city')}<input value={f.city} onChange={(e) => setField('city', e.target.value)} maxLength={80} className={field} /></label>
              <label className="text-sm">{t('s_province')}
                <select value={f.province} onChange={(e) => setField('province', e.target.value)} className={field}>
                  <option value="">—</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm">{t('s_website')}<input value={f.website} onChange={(e) => setField('website', e.target.value)} type="url" pattern="https?://.*" maxLength={200} className={field} placeholder="https://" /></label>
          </>
        )}
        <label className="text-sm">{kind === 'new' ? t('s_note') : t('s_note_required')}
          <textarea value={f.note} onChange={(e) => setField('note', e.target.value)} required={kind !== 'new'} maxLength={1000} rows={kind === 'feedback' ? 6 : 3} className={field} />
        </label>
        <div ref={widget} />
        {!token && (
          <p className={`text-xs ${widgetFailed ? 'text-red-600' : 'text-slate-500'}`}>
            {widgetFailed ? t('s_verify_failed') : t('s_verifying')}
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'sending' || !token}
          className="rounded-md bg-slate-800 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === 'sending' ? t('s_sending') : t('s_submit')}
        </button>
        {status === 'error' && <p className="text-sm text-red-600">{t('s_error')}</p>}
      </form>
    </div>
  );
}
