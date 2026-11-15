import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PublicListing } from '@app/public/PublicListing';
import { TasarPublico } from '@app/public/TasarPublico';
import { PublicPropertyDetail } from '@app/public/PublicPropertyDetail';
import { PublicHome } from '@app/public/PublicHome';
import { LegacyFichaRedirect } from '@app/public/LegacyFichaRedirect';
import { ZonaLanding } from '@app/public/ZonaLanding';
import { LANDINGS } from '@app/public/landingConfigs';
import { SignScreen } from '@app/public/SignScreen';
import { PoliticaPrivacidad } from '@app/public/PoliticaPrivacidad';
import { NotFoundPublic } from '@app/public/NotFoundPublic';

// Chunks aparte: el CRM (/veraos) y la web pública de alquileres (/alquileres) no se
// descargan para un visitante del sitio público institucional (ni viceversa).
const OsRoutes = lazy(() => import('@app/OsRoutes'));
const RentalsPublicRoutes = lazy(() => import('@app/RentalsPublicRoutes'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

/** Sitio público institucional (home, cartera, ficha, tasación, firma). */
const PublicSiteRoutes = () => (
  <Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/inicio" element={<PublicHome />} />
    <Route path="/web" element={<PublicListing />} />
    <Route path="/web/:id" element={<PublicPropertyDetail />} />
    <Route path="/ficha/:slug" element={<LegacyFichaRedirect />} />
    <Route path="/tasar" element={<TasarPublico />} />
    <Route path="/venta/costa-del-este" element={<ZonaLanding config={LANDINGS.hub} />} />
    <Route path="/venta/casas-costa-del-este" element={<ZonaLanding config={LANDINGS.casas} />} />
    <Route path="/venta/lotes-costa-del-este" element={<ZonaLanding config={LANDINGS.lotes} />} />
    <Route path="/venta/ph-costa-del-este" element={<ZonaLanding config={LANDINGS.ph} />} />
    <Route path="/firma/:token" element={<SignScreen />} />
    <Route path="/privacidad" element={<PoliticaPrivacidad />} />
    <Route path="*" element={<NotFoundPublic />} />
  </Routes>
);

/**
 * VERA OS root. Un solo dominio, ruteo por PATH:
 *   /            -> web pública institucional
 *   /veraos/*    -> el OS (login + app)
 *   /alquileres/* -> web pública de alquileres
 * El subdominio alquileres.* se mantiene por compatibilidad (avisos de ML ya publicados).
 */
export const VeraOS = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Compatibilidad: subdominio de alquileres ya en uso (links viejos de ML).
  if (host.startsWith('alquileres.')) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={null}>
            <RentalsPublicRoutes />
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  const inOs = path === '/veraos' || path.startsWith('/veraos/');
  const inRentals = path === '/alquileres' || path.startsWith('/alquileres/');

  return (
    <QueryClientProvider client={queryClient}>
      {inOs ? (
        <BrowserRouter basename="/veraos">
          <Suspense fallback={null}>
            <OsRoutes />
          </Suspense>
        </BrowserRouter>
      ) : inRentals ? (
        <BrowserRouter basename="/alquileres">
          <Suspense fallback={null}>
            <RentalsPublicRoutes />
          </Suspense>
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <PublicSiteRoutes />
        </BrowserRouter>
      )}
    </QueryClientProvider>
  );
};
