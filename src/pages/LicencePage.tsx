import { useLang } from '../lib/i18n';

const A = 'text-blue-600 hover:underline';
const H2 = 'mt-6 text-xl font-bold';
const P = 'mt-2 text-sm leading-6';

const content = {
  en: (
    <>
      <h1 className="text-2xl font-bold">How to get your firearms licence (PAL)</h1>
      <p className={P}>
        To legally buy a firearm or ammunition in Canada you need a Possession and
        Acquisition Licence (PAL), issued under the federal Firearms Act and
        administered by the RCMP Canadian Firearms Program. Provincial Chief
        Firearms Officers (CFOs) handle approvals and courses in their
        jurisdiction, and the process is different in Quebec, which adds
        requirements of its own (see step 3).
      </p>
      <h2 className={H2}>1. Take the safety course</h2>
      <p className={P}>
        Complete the <strong>Canadian Firearms Safety Course (CFSC)</strong> and pass its
        written and practical exams. If you also want restricted firearms, take the
        <strong> Canadian Restricted Firearms Safety Course (CRFSC)</strong> as well. Courses
        are scheduled by each province's CFO —{' '}
        <a className={A} href="https://rcmp.ca/en/firearms/firearms-safety-training-transport-and-storage/safety-courses" target="_blank" rel="noopener noreferrer">
          find a course through the RCMP's course page
        </a>.
      </p>
      <h2 className={H2}>2. Apply to the RCMP</h2>
      <p className={P}>
        Apply online through the{' '}
        <a className={A} href="https://rcmp.ca/en/firearms/apply-firearms-licence" target="_blank" rel="noopener noreferrer">
          RCMP Canadian Firearms Program
        </a>{' '}
        with your course results, or on paper using the{' '}
        <a className={A} href="https://rcmp.ca/en/firearms/firearms-forms-and-reports#s1" target="_blank" rel="noopener noreferrer">
          firearms application forms
        </a>. Expect a background
        check, references, and a mandatory 28-day waiting period for first-time
        applicants. Processing beyond that commonly takes weeks to months.
      </p>
      <h2 className={H2}>3. Provincial Chief Firearms Officers</h2>
      <p className={P}>
        Your CFO handles course availability, transfers, and authorizations.{' '}
        <a className={A} href="https://rcmp.ca/en/firearms/contact-chief-firearms-officer" target="_blank" rel="noopener noreferrer">
          Find your province or territory's CFO here
        </a>. The process is different in Quebec: on top of the federal steps,
        residents must satisfy the province's own requirements through the
        Bureau du contrôleur des armes à feu —{' '}
        <a className={A} href="https://www.quebec.ca/en/public-safety-emergencies/firearms" target="_blank" rel="noopener noreferrer">
          see the Quebec-specific requirements
        </a>.
      </p>
      <h2 className={H2}>4. Buy from a verified retailer</h2>
      <p className={P}>
        Once your PAL arrives, any retailer on this map can sell to you.
        Rules and fees change; always confirm details against the official
        RCMP pages linked above.
      </p>
    </>
  ),
  fr: (
    <>
      <h1 className="text-2xl font-bold">Comment obtenir son permis d'armes à feu (PPA)</h1>
      <p className={P}>
        Pour acheter légalement une arme à feu ou des munitions au Canada, il faut
        un permis de possession et d'acquisition (PPA), délivré en vertu de la Loi
        sur les armes à feu et administré par le Programme canadien des armes à feu
        de la GRC. Les contrôleurs des armes à feu (CAF) provinciaux gèrent les
        approbations et les cours dans leur territoire, et la démarche est
        différente au Québec, qui impose des exigences supplémentaires (voir
        l'étape 3).
      </p>
      <h2 className={H2}>1. Suivre le cours de sécurité</h2>
      <p className={P}>
        Réussissez le <strong>Cours canadien de sécurité dans le maniement des armes à feu
        (CCSMAF)</strong>, examens écrit et pratique compris. Pour les armes à feu à
        autorisation restreinte, suivez aussi le <strong>CCSMAFAR</strong>. Les cours sont
        organisés par le CAF de chaque province —{' '}
        <a className={A} href="https://grc.ca/fr/armes-feu/securite-formation-transport-et-entreposage-armes-feu/cours-securite" target="_blank" rel="noopener noreferrer">
          trouvez un cours via la page de la GRC
        </a>.
      </p>
      <h2 className={H2}>2. Faire la demande à la GRC</h2>
      <p className={P}>
        Faites votre demande en ligne auprès du{' '}
        <a className={A} href="https://grc.ca/fr/armes-feu/presenter-demande-permis-darmes-feu" target="_blank" rel="noopener noreferrer">
          Programme canadien des armes à feu de la GRC
        </a>{' '}
        avec vos résultats de cours, ou sur papier au moyen des{' '}
        <a className={A} href="https://grc.ca/fr/armes-feu/formulaires-et-rapports-sur-armes-feu" target="_blank" rel="noopener noreferrer">
          formulaires de demande
        </a>. Prévoyez une
        vérification des antécédents, des références et une période d'attente
        obligatoire de 28 jours pour une première demande. Le traitement prend
        souvent des semaines, voire des mois.
      </p>
      <h2 className={H2}>3. Contrôleurs des armes à feu provinciaux</h2>
      <p className={P}>
        Votre CAF s'occupe des cours, des cessions et des autorisations.{' '}
        <a className={A} href="https://grc.ca/fr/armes-feu/communiquer-avec-controleur-armes-feu" target="_blank" rel="noopener noreferrer">
          Trouvez le CAF de votre province ou territoire ici
        </a>. La démarche est différente au Québec : en plus des étapes
        fédérales, les résidents doivent satisfaire aux exigences propres à la
        province auprès du Bureau du contrôleur des armes à feu —{' '}
        <a className={A} href="https://www.quebec.ca/securite-situations-urgence/armes-a-feu" target="_blank" rel="noopener noreferrer">
          consultez les exigences québécoises
        </a>.
      </p>
      <h2 className={H2}>4. Acheter chez un détaillant vérifié</h2>
      <p className={P}>
        Une fois votre PPA en main, tout détaillant sur cette carte peut vous
        vendre. Les règles et les frais changent;
        vérifiez toujours les détails sur les pages officielles de la GRC liées
        ci-dessus.
      </p>
    </>
  ),
};

export default function LicencePage() {
  const { lang } = useLang();
  return <div className="mx-auto max-w-2xl overflow-y-auto p-6 pb-12">{content[lang]}</div>;
}
