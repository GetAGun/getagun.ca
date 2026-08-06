import { useEffect, useState } from 'react';
import type { Faq } from '../../shared/const';
import { getFaqs } from '../lib/api';
import { useLang, useT } from '../lib/i18n';
import { Rich } from '../lib/richtext';

export default function FaqPage() {
  const t = useT();
  const { lang } = useLang();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    getFaqs().then(setFaqs).catch(() => setError(true));
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6 pb-12">
      <h1 className="text-2xl font-bold">{t('faq_title')}</h1>
      {error && <p className="mt-4 text-sm text-red-600">{t('load_error')}</p>}
      {!error && faqs.length === 0 && <p className="mt-4 text-sm text-slate-500">{t('faq_empty')}</p>}
      <div className="mt-4 divide-y divide-slate-200">
        {faqs.map((f) => (
          <details key={f.id} className="py-3">
            <summary className="cursor-pointer select-none text-lg font-medium">
              {lang === 'fr' && f.question_fr ? f.question_fr : f.question_en}
            </summary>
            <Rich
              className="mt-2 whitespace-pre-line text-base leading-7 text-slate-700"
              text={lang === 'fr' && f.answer_fr ? f.answer_fr : f.answer_en}
            />
          </details>
        ))}
      </div>
    </div>
  );
}
