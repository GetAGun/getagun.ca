import type { ReactNode } from 'react';
import { useLang } from '../lib/i18n';

// The body copy is unchanged — only its structure is. Each step's prose lives in
// `steps`; the numbering, headings and rails come from the layout below.

interface Doc {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  facts: Array<{ label: string; value: string; note?: string }>;
  steps: Array<{ title: string; body: ReactNode }>;
  caveat: string;
}

const DOCS: Record<'en' | 'fr', Doc> = {
  en: {
    eyebrow: 'Federal licensing · Canada',
    title: 'How to get your firearms licence (PAL)',
    lead: (
      <>
        To legally buy a firearm or ammunition in Canada you need a Possession and
        Acquisition Licence (PAL), issued under the federal Firearms Act and
        administered by the RCMP Canadian Firearms Program. Provincial Chief
        Firearms Officers (CFOs) handle approvals and courses in their
        jurisdiction, and the process is different in Quebec, which adds
        requirements of its own (see step 3).
      </>
    ),
    facts: [
      { label: 'Licence', value: 'PAL', note: 'Possession and Acquisition Licence' },
      { label: 'Issued by', value: 'RCMP', note: 'Canadian Firearms Program' },
      { label: 'Waiting period', value: '28+ days', note: 'Statutory minimum, first-time applicants' },
    ],
    steps: [
      {
        title: 'Take the safety course',
        body: (
          <>
            Complete the <strong>Canadian Firearms Safety Course (CFSC)</strong> and pass its
            written and practical exams. If you also want restricted firearms, take the
            <strong> Canadian Restricted Firearms Safety Course (CRFSC)</strong> as well. Courses
            are scheduled by each province's CFO —{' '}
            <a href="https://rcmp.ca/en/firearms/firearms-safety-training-transport-and-storage/safety-courses" target="_blank" rel="noopener noreferrer">
              find a course through the RCMP's course page
            </a>.
          </>
        ),
      },
      {
        title: 'Apply to the RCMP',
        body: (
          <>
            Apply online through the{' '}
            <a href="https://rcmp.ca/en/firearms/apply-firearms-licence" target="_blank" rel="noopener noreferrer">
              RCMP Canadian Firearms Program
            </a>{' '}
            with your course results, or on paper using the{' '}
            <a href="https://rcmp.ca/en/firearms/firearms-forms-and-reports#s1" target="_blank" rel="noopener noreferrer">
              firearms application forms
            </a>. Expect a background
            check, references, and a mandatory 28-day waiting period for first-time
            applicants. Processing beyond that commonly takes weeks to months.
          </>
        ),
      },
      {
        title: 'Provincial Chief Firearms Officers',
        body: (
          <>
            Your CFO handles course availability, transfers, and authorizations.{' '}
            <a href="https://rcmp.ca/en/firearms/contact-chief-firearms-officer" target="_blank" rel="noopener noreferrer">
              Find your province or territory's CFO here
            </a>. The process is different in Quebec: on top of the federal steps,
            residents must satisfy the province's own requirements through the
            Bureau du contrôleur des armes à feu —{' '}
            <a href="https://www.quebec.ca/en/public-safety-emergencies/firearms" target="_blank" rel="noopener noreferrer">
              see the Quebec-specific requirements
            </a>. In particular, RPAL holders transferring a restricted firearm must
            first complete a separate course mandated by Quebec Loi 9 (which is
            required to join a shooting club in Quebec). Without this prerequisite
            the CFO will not approve the transfer.
          </>
        ),
      },
      {
        title: 'Buy from a verified retailer',
        body: (
          <>
            Once your PAL arrives, any retailer on this map can sell to you.
            Rules and fees change; always confirm details against the official
            RCMP pages linked above.
          </>
        ),
      },
    ],
    caveat: 'Rules and fees change. Confirm every detail against the official RCMP pages linked above.',
  },
  fr: {
    eyebrow: 'Permis fédéral · Canada',
    title: "Comment obtenir son permis d'armes à feu (PPA)",
    lead: (
      <>
        Pour acheter légalement une arme à feu ou des munitions au Canada, il faut
        un permis de possession et d'acquisition (PPA), délivré en vertu de la Loi
        sur les armes à feu et administré par le Programme canadien des armes à feu
        de la GRC. Les contrôleurs des armes à feu (CAF) provinciaux gèrent les
        approbations et les cours dans leur territoire, et la démarche est
        différente au Québec, qui impose des exigences supplémentaires (voir
        l'étape 3).
      </>
    ),
    facts: [
      { label: 'Permis', value: 'PPA', note: "Possession et d'acquisition" },
      { label: 'Délivré par', value: 'GRC', note: 'Programme canadien des armes à feu' },
      { label: "Délai d'attente", value: '28+ jours', note: 'Minimum prévu par la loi, première demande' },
    ],
    steps: [
      {
        title: 'Suivre le cours de sécurité',
        body: (
          <>
            Réussissez le <strong>Cours canadien de sécurité dans le maniement des armes à feu
            (CCSMAF)</strong>, examens écrit et pratique compris. Pour les armes à feu à
            autorisation restreinte, suivez aussi le <strong>CCSMAFAR</strong>. Les cours sont
            organisés par le CAF de chaque province —{' '}
            <a href="https://grc.ca/fr/armes-feu/securite-formation-transport-et-entreposage-armes-feu/cours-securite" target="_blank" rel="noopener noreferrer">
              trouvez un cours via la page de la GRC
            </a>.
          </>
        ),
      },
      {
        title: 'Faire la demande à la GRC',
        body: (
          <>
            Faites votre demande en ligne auprès du{' '}
            <a href="https://grc.ca/fr/armes-feu/presenter-demande-permis-darmes-feu" target="_blank" rel="noopener noreferrer">
              Programme canadien des armes à feu de la GRC
            </a>{' '}
            avec vos résultats de cours, ou sur papier au moyen des{' '}
            <a href="https://grc.ca/fr/armes-feu/formulaires-et-rapports-sur-armes-feu" target="_blank" rel="noopener noreferrer">
              formulaires de demande
            </a>. Prévoyez une
            vérification des antécédents, des références et une période d'attente
            obligatoire de 28 jours pour une première demande. Le traitement prend
            souvent des semaines, voire des mois.
          </>
        ),
      },
      {
        title: 'Contrôleurs des armes à feu provinciaux',
        body: (
          <>
            Votre CAF s'occupe des cours, des cessions et des autorisations.{' '}
            <a href="https://grc.ca/fr/armes-feu/communiquer-avec-controleur-armes-feu" target="_blank" rel="noopener noreferrer">
              Trouvez le CAF de votre province ou territoire ici
            </a>. La démarche est différente au Québec : en plus des étapes
            fédérales, les résidents doivent satisfaire aux exigences propres à la
            province auprès du Bureau du contrôleur des armes à feu —{' '}
            <a href="https://www.quebec.ca/securite-situations-urgence/armes-a-feu" target="_blank" rel="noopener noreferrer">
              consultez les exigences québécoises
            </a>. En particulier, les titulaires d'un permis à autorisation
            restreinte qui procèdent à la cession d'une telle arme doivent d'abord
            réussir une formation distincte imposée par la Loi 9 du Québec (exigée
            pour devenir membre d'un club de tir au Québec). Sans ce préalable, le
            contrôleur des armes à feu n'approuvera pas la cession.
          </>
        ),
      },
      {
        title: 'Acheter chez un détaillant vérifié',
        body: (
          <>
            Une fois votre PPA en main, tout détaillant sur cette carte peut vous
            vendre. Les règles et les frais changent;
            vérifiez toujours les détails sur les pages officielles de la GRC liées
            ci-dessus.
          </>
        ),
      },
    ],
    caveat: 'Les règles et les frais changent. Vérifiez chaque détail sur les pages officielles de la GRC liées ci-dessus.',
  },
};

export default function LicencePage() {
  const { lang } = useLang();
  const doc = DOCS[lang];
  return (
    <div className="doc-page">
      <article className="mx-auto max-w-3xl">
        <p className="eyebrow">{doc.eyebrow}</p>
        <h1 className="mt-2 max-w-[20ch] font-display text-[2.1rem] font-bold uppercase leading-[1.08] tracking-[0.01em] text-ink sm:text-[2.6rem]">
          {doc.title}
        </h1>
        <p className="doc-prose mt-5 border-l-2 border-brand pl-5 text-[17px] leading-[1.65]">{doc.lead}</p>

        {/* The three facts a first-time applicant actually needs up front. */}
        <dl className="stagger mt-8 grid grid-cols-1 gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {doc.facts.map((f, i) => (
            <div key={f.label} className="bg-paper px-4 py-3" style={{ ['--i' as string]: i }}>
              <dt className="eyebrow">{f.label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold leading-none tracking-tight text-ink tabular-nums">{f.value}</dd>
              {f.note && <dd className="mt-1 font-prose text-[12px] leading-snug text-steel">{f.note}</dd>}
            </div>
          ))}
        </dl>

        <ol className="mt-10 border-t border-rule">
          {doc.steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[2.75rem_1fr] gap-x-4 border-b border-rule py-6 sm:grid-cols-[4.5rem_1fr] sm:gap-x-6 sm:py-7">
              <div className="font-display text-[1.6rem] font-bold leading-none text-brand tabular-nums sm:text-[2.2rem]">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h2 className="font-display text-[1.05rem] font-semibold uppercase leading-tight tracking-[0.06em] text-ink sm:text-[1.2rem]">
                  {s.title}
                </h2>
                <div className="doc-prose mt-2">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 font-prose text-[13px] italic leading-relaxed text-steel">{doc.caveat}</p>
      </article>
    </div>
  );
}
