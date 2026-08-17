import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import FeelSwitcher from './components/FeelSwitcher';
import { applyFeel, feelName, feelSwitcherEnabled } from './lib/feel';
import { applyUiScale, uiScale } from './lib/ui-scale';
import { LangProvider } from './lib/i18n';
import LicencePage from './pages/LicencePage';
import FaqPage from './pages/FaqPage';
import MapPage from './pages/MapPage';
import SuggestPage from './pages/SuggestPage';
import AdminPage from './pages/AdminPage';
import './index.css';

applyFeel(feelName());
applyUiScale(uiScale());
// Paper grain is the shipped treatment; ?skin=stamp|ledger|none previews the others.
const skin = new URLSearchParams(window.location.search).get('skin') ?? 'grain';
if (skin !== 'none') document.documentElement.dataset.skin = skin;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<MapPage />} />
            <Route path="/licence" element={<LicencePage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/suggest" element={<SuggestPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      {feelSwitcherEnabled() && <FeelSwitcher />}
    </LangProvider>
  </React.StrictMode>,
);
