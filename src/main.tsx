import '@fontsource/rajdhani/600.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { LangProvider } from './lib/i18n';
import LicencePage from './pages/LicencePage';
import FaqPage from './pages/FaqPage';
import MapPage from './pages/MapPage';
import SuggestPage from './pages/SuggestPage';
import AdminPage from './pages/AdminPage';
import './index.css';

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
    </LangProvider>
  </React.StrictMode>,
);
