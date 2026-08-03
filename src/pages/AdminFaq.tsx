import { useEffect, useState, type FormEvent } from 'react';
import type { Faq } from '../../shared/const';
import { admin, type FaqForm } from '../lib/api';
import { Rich } from '../lib/richtext';

const EMPTY: FaqForm = { question_en: '', answer_en: '', question_fr: null, answer_fr: null, position: 0 };
const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';

export default function AdminFaq() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [form, setForm] = useState<FaqForm>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const reload = () => admin.getFaqs().then(setFaqs).catch(() => setMsg('Failed to load FAQs'));
  useEffect(() => { reload(); }, []);

  const set = <K extends keyof FaqForm>(k: K, v: FaqForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      if (editingId === null) await admin.createFaq(form);
      else await admin.updateFaq(editingId, form);
      setForm(EMPTY); setEditingId(null);
      reload();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const edit = (f: Faq) => {
    setEditingId(f.id);
    setForm({ question_en: f.question_en, answer_en: f.answer_en, question_fr: f.question_fr, answer_fr: f.answer_fr, position: f.position });
  };

  const remove = async (f: Faq) => {
    if (!confirm(`Delete FAQ "${f.question_en}"?`)) return;
    try { await admin.deleteFaq(f.id); reload(); }
    catch (err) { setMsg(err instanceof Error ? err.message : 'Delete failed'); }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold">{editingId === null ? 'Add FAQ' : `Edit FAQ #${editingId}`}</h2>
      {msg && <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
      <form onSubmit={save} className="mt-3 flex flex-col gap-3">
        <label className="text-sm">Question (English)
          <input value={form.question_en} onChange={(e) => set('question_en', e.target.value)} required maxLength={300} className={field} />
        </label>
        <label className="text-sm">Answer (English)
          <textarea value={form.answer_en} onChange={(e) => set('answer_en', e.target.value)} required maxLength={5000} rows={4} className={field} />
        </label>
        <p className="-mt-2 text-xs text-slate-500">
          Formatting: [link text](https://example.com or /path), ![image caption](/path.png), **bold**, *italic*. Blank line = new paragraph.
        </p>
        {form.answer_en && (
          <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none text-xs font-medium text-slate-500">Preview</summary>
            <Rich className="mt-1 whitespace-pre-line leading-6" text={form.answer_en} />
            {form.answer_fr && <Rich className="mt-2 whitespace-pre-line border-t border-slate-200 pt-2 leading-6" text={form.answer_fr} />}
          </details>
        )}
        <label className="text-sm">Question (French — optional, falls back to English)
          <input value={form.question_fr ?? ''} onChange={(e) => set('question_fr', e.target.value || null)} maxLength={300} className={field} />
        </label>
        <label className="text-sm">Answer (French — optional)
          <textarea value={form.answer_fr ?? ''} onChange={(e) => set('answer_fr', e.target.value || null)} maxLength={5000} rows={4} className={field} />
        </label>
        <label className="w-40 text-sm">Position (sort order)
          <input type="number" min={0} max={9999} value={form.position} onChange={(e) => set('position', Number(e.target.value))} className={field} />
        </label>
        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            {editingId === null ? 'Add FAQ' : 'Save changes'}
          </button>
          {editingId !== null && (
            <button type="button" onClick={() => { setForm(EMPTY); setEditingId(null); }} className="rounded-md px-4 py-2 text-sm hover:bg-slate-100">
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="mt-8 text-lg font-semibold">FAQs ({faqs.length})</h2>
      <ul className="mt-2 divide-y divide-slate-200">
        {faqs.map((f) => (
          <li key={f.id} className="flex items-start gap-3 py-2 text-sm">
            <span className="mt-0.5 w-10 shrink-0 text-xs text-slate-400">#{f.position}</span>
            <div className="min-w-0 flex-1">
              <span className="font-medium">{f.question_en}</span>
              {!f.question_fr && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">no FR</span>}
              <p className="truncate text-xs text-slate-500">{f.answer_en}</p>
            </div>
            <button onClick={() => edit(f)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">Edit</button>
            <button onClick={() => remove(f)} className="rounded bg-red-100 px-2 py-1 text-xs hover:bg-red-200">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
