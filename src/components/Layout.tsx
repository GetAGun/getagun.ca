import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Bullseye from './Bullseye';
import { SCALES, applyUiScale, stepScale, uiScale } from '../lib/ui-scale';
import { useLang, useT } from '../lib/i18n';

// One line by default; the full privacy statement is one click away rather than
// four lines of permanent furniture at the bottom of every page.
function SiteFooter() {
  const t = useT();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  return (
    <footer className="shrink-0 bg-ink px-4 py-1.5 text-[11px] text-white/45 sm:px-6">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/suggest" className="flex items-center gap-1.5 transition-colors duration-[var(--dur-fast)] hover:text-white">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand" />
          {t('wip_notice')}
        </Link>
        <span aria-hidden="true" className="text-white/20">|</span>
        <span>{t('footer_short')}</span>
        <details className="group" onToggle={(e) => setPrivacyOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 transition-colors duration-[var(--dur-fast)] hover:text-white [&::-webkit-details-marker]:hidden">
            <Bullseye open={privacyOpen} className="text-white/40" />
            <span className="underline decoration-white/30 underline-offset-2">{t('footer_more')}</span>
          </summary>
          <p className="mx-auto max-w-3xl py-2 text-center leading-relaxed text-white/40">{t('footer_privacy')}</p>
        </details>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { lang, setLang } = useLang();
  const [scale, setScale] = useState(uiScale);
  // Apply in an effect and step functionally, so rapid clicks accumulate instead
  // of each one reading the scale captured at render.
  useEffect(() => { applyUiScale(scale); }, [scale]);
  const t = useT();
  const { pathname } = useLocation();
  const isMap = pathname === '/';

  // Tracked caps with a red rule under the active item — signage, not buttons.
  const nav = ({ isActive }: { isActive: boolean }) =>
    `relative shrink-0 whitespace-nowrap px-1 py-2 font-display text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors duration-[var(--dur-fast)] sm:px-1.5 sm:text-[13px] ${
      isActive
        ? 'text-white after:absolute after:inset-x-1 after:-bottom-px after:h-[2px] after:bg-brand'
        : 'text-white/55 hover:text-white'
    }`;

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b-2 border-brand bg-ink">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 sm:px-6 sm:py-2.5">
          <Link to="/" className="order-1 flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-auto sm:h-9" />
            <span className="leading-none">
              <span className="block font-display text-lg font-bold uppercase tracking-[0.06em] text-white sm:text-xl">
                GetAGun<span className="text-brand">.ca</span>
              </span>
              <span className="mt-0.5 hidden text-[11px] leading-none text-white/45 sm:block">{t('tagline')}</span>
            </span>
          </Link>

          <nav className="order-3 flex w-full items-center gap-3 overflow-x-auto sm:order-2 sm:ml-auto sm:w-auto sm:gap-4 sm:overflow-visible">
            <NavLink to="/" end className={nav}>{t('nav_map')}</NavLink>
            <NavLink to="/licence" className={nav}>
              <span className="sm:hidden">{t('nav_licence_short')}</span>
              <span className="hidden sm:inline">{t('nav_licence')}</span>
            </NavLink>
            <NavLink to="/faq" className={nav}>{t('nav_faq')}</NavLink>
            <NavLink to="/suggest" className={nav}>{t('nav_suggest')}</NavLink>
            {/* static page, not an SPA route */}
            <a href={lang === 'fr' ? '/sheets/retailers-by-category-fr' : '/sheets/retailers-by-category'} className={nav({ isActive: false })}>
              <span className="sm:hidden">{t('nav_sheet_short')}</span>
              <span className="hidden sm:inline">{t('nav_sheet')}</span>
            </a>
          </nav>

          <div className="order-2 ml-auto flex items-center gap-3 sm:order-3 sm:ml-4">
            {/* Interface size: scales the chrome and the map together, unlike
                browser zoom which leaves the map's own sizing alone. */}
            <div className="flex items-center overflow-hidden rounded-sm border border-white/20 font-display text-[11px] font-semibold tracking-[0.06em]">
              {([-1, 1] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setScale((prev) => stepScale(prev, dir))}
                  aria-label={dir === -1 ? t('scale_down') : t('scale_up')}
                  disabled={dir === -1 ? scale === SCALES[0] : scale === SCALES[SCALES.length - 1]}
                  className={`px-1.5 py-1 text-white/60 transition-colors duration-[var(--dur-fast)] hover:text-white disabled:opacity-25 disabled:hover:text-white/60 ${dir === 1 ? 'order-3' : ''}`}
                >
                  {dir === -1 ? '\u2212' : '+'}
                </button>
              ))}
              <span className="order-2 min-w-[2.6rem] px-0.5 text-center tabular-nums text-white/80" title={t('scale_label')}>
                {Math.round(scale * 100)}%
              </span>
            </div>
            {/* Segmented pair reads as a state, not a button that might do something else. */}
            <div className="flex overflow-hidden rounded-sm border border-white/20 font-display text-[11px] font-semibold tracking-[0.1em]">
              {(['en', 'fr'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-2 py-1 uppercase transition-colors duration-[var(--dur-fast)] ${
                    lang === l ? 'bg-white text-ink' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <a
              href="https://github.com/GetAGun/getagun.ca"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-white/45 transition-colors duration-[var(--dur-fast)] hover:text-white"
            >
              <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* The footer belongs to the map: it explains how search and location are handled.
          The document pages end with their own content instead. */}
      <main key={pathname} className={`min-h-0 flex-1 animate-[page-in_var(--dur)_var(--ease)] ${isMap ? '' : 'flex flex-col overflow-y-auto'}`}>
        <Outlet />
      </main>
      {isMap && <SiteFooter />}
    </div>
  );
}
