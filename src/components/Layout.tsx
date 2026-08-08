import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLang, useT } from '../lib/i18n';

export default function Layout() {
  const { lang, setLang } = useLang();
  const t = useT();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isMap = pathname === '/';
  const nav = ({ isActive }: { isActive: boolean }) =>
    `flex-1 text-center sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-sm font-medium transition-colors duration-150 active:scale-[.97] ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'}`;
  return (
    <div className="flex h-full flex-col">
      {/* Mobile: logo+FR row, then full-width nav row, then WIP line. Desktop: one row via order-*. */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-900 px-3 py-2 sm:px-4">
        <Link to="/" className="order-1 flex items-center gap-2 font-display text-xl font-semibold tracking-wide text-white">
          <img src="/logo.png" alt="" className="h-8 w-auto" />
          GetAGun<span className="text-[#e6262a]">.ca</span>
        </Link>
        <span className="hidden text-xs text-slate-400 lg:order-2 lg:block">{t('tagline')}</span>
        <a
          href="https://github.com/GetAGun/getagun.ca"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="order-2 ml-auto p-1 text-slate-400 transition-colors duration-150 hover:text-white sm:order-5 sm:ml-0"
        >
          <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
          </svg>
        </a>
        <button
          onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
          className="order-2 rounded-md border border-slate-600 px-2 py-1 text-sm text-slate-200 transition-colors duration-150 hover:bg-slate-700 active:scale-95 sm:order-5 sm:ml-0"
          aria-label={lang === 'en' ? 'Passer au français' : 'Switch to English'}
        >
          {lang === 'en' ? 'FR' : 'EN'}
        </button>
        <nav className="order-3 flex w-full items-center gap-1 sm:order-4 sm:ml-auto sm:w-auto">
          <NavLink to="/" end className={nav}>{t('nav_map')}</NavLink>
          <NavLink to="/licence" className={nav}>{t('nav_licence')}</NavLink>
          <NavLink to="/faq" className={nav}>{t('nav_faq')}</NavLink>
          <NavLink to="/suggest" className={nav}>{t('nav_suggest')}</NavLink>
          {/* static page, not an SPA route */}
          <a href={lang === 'fr' ? '/sheets/retailers-by-category-fr' : '/sheets/retailers-by-category'} className={nav({ isActive: false })}>
            {t('nav_sheet')}
          </a>
        </nav>
        {isMap && (
          <Link
            to="/suggest"
            className="order-4 w-full rounded-full bg-amber-500/20 px-2.5 py-0.5 text-center text-xs text-amber-300 hover:bg-amber-500/30 sm:order-3 sm:w-auto sm:text-left"
          >
            {t('wip_notice')}
          </Link>
        )}
      </header>
      {/* Map pins the footer; other pages scroll it in after their content so it never overlaps. */}
      <main key={pathname} className={`min-h-0 flex-1 animate-[page-in_.18s_ease-out] ${isMap ? '' : 'flex flex-col overflow-y-auto'}`}>
        <Outlet />
        {!isAdmin && !isMap && (
          <footer className="mt-auto bg-slate-900 px-4 py-2 text-center text-xs text-slate-400">
            {t('footer_privacy')}
          </footer>
        )}
      </main>
      {isMap && (
        <footer className="bg-slate-900 px-4 py-2 text-center text-xs text-slate-400">
          {t('footer_privacy')}
        </footer>
      )}
    </div>
  );
}
