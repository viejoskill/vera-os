import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import { PropertiesScreen } from '@app/screens/PropertiesScreen';
import { PropertyWorkspace } from '@app/screens/property-workspace';
import { PeopleScreen } from '@app/screens/people/PeopleScreen';
import { PersonDetail } from '@app/screens/people/PersonDetail';
import { EventLogScreen } from '@app/screens/EventLogScreen';
import { OperacionesScreen } from '@app/screens/OperacionesScreen';
import { DocumentsScreen } from '@app/screens/documents/DocumentsScreen';
import { DocumentWizard } from '@app/screens/documents/DocumentWizard';
import { DocumentDetail } from '@app/screens/documents/DocumentDetail';
import { WorkspaceHome } from '@app/workspace/WorkspaceHome';
import { VeraBotWorkspace } from '@app/vera-bot';
import { IntegrationsScreen } from '@app/integraciones';
import { LoginScreen } from '@app/screens/LoginScreen';
import { StudioScreen } from '@app/screens/StudioScreen';
import { TeamScreen } from '@app/screens/TeamScreen';
import { TasacionesScreen } from '@app/screens/TasacionesScreen';
import { AlquileresScreen } from '@app/screens/rentals/AlquileresScreen';
import { KeysBoardScreen } from '@app/screens/KeysBoardScreen';
import { RentalWorkspace } from '@app/screens/rentals/RentalWorkspace';
import { LiquidacionesScreen } from '@app/screens/rentals/LiquidacionesScreen';
import { ContabilidadScreen } from '@app/screens/ContabilidadScreen';
import { PublicListing } from '@app/public/PublicListing';
import { TasarPublico } from '@app/public/TasarPublico';
import { ReservarPublico } from '@app/public/ReservarPublico';
import { ReservarPropiedad } from '@app/public/ReservarPropiedad';
import { ReservaResultado } from '@app/public/ReservaResultado';
import { PublicPropertyDetail } from '@app/public/PublicPropertyDetail';
import { PublicHome } from '@app/public/PublicHome';
import { LegacyFichaRedirect } from '@app/public/LegacyFichaRedirect';
import { ZonaLanding } from '@app/public/ZonaLanding';
import { LANDINGS } from '@app/public/landingConfigs';
import { SignScreen } from '@app/public/SignScreen';
import { AuthProvider } from '@app/auth/AuthProvider';
import { RequireAuth } from '@app/auth/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

/** El OS interno (login + app). Se monta bajo el basename /veraos, así todos sus
 *  links absolutos (/hoy, /propiedades…) quedan como /veraos/... sin tocar nada interno. */
const OsRoutes = () => (
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/hoy" replace />} />
          <Route path="hoy" element={<WorkspaceHome />} />
          <Route path="propiedades" element={<PropertiesScreen />} />
          <Route path="propiedades/nueva" element={<PropertyWorkspace />} />
          <Route path="propiedades/:id" element={<PropertyWorkspace />} />
          <Route path="vera-bot" element={<VeraBotWorkspace />} />
          <Route path="personas" element={<PeopleScreen />} />
          <Route path="personas/:id" element={<PersonDetail />} />
          <Route path="eventos" element={<EventLogScreen />} />
          <Route path="operaciones" element={<OperacionesScreen />} />
          <Route path="documentos" element={<DocumentsScreen />} />
          <Route path="documentos/nuevo" element={<DocumentWizard />} />
          <Route path="documentos/:id" element={<DocumentDetail />} />
          <Route path="studio" element={<StudioScreen />} />
          <Route path="integraciones" element={<IntegrationsScreen />} />
          <Route path="equipo" element={<TeamScreen />} />
          <Route path="tasaciones" element={<TasacionesScreen />} />
          <Route path="llaves" element={<KeysBoardScreen />} />
          <Route path="alquileres" element={<AlquileresScreen />} />
          <Route path="alquileres/nueva" element={<RentalWorkspace />} />
          <Route path="alquileres/:id" element={<RentalWorkspace />} />
          <Route path="liquidaciones" element={<LiquidacionesScreen />} />
          <Route path="contabilidad" element={<ContabilidadScreen />} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Route>
      </Route>
    </Routes>
  </AuthProvider>
);

/** Web pública de alquileres temporarios (reservas). Se monta bajo /alquileres. */
const RentalsPublicRoutes = () => (
  <Routes>
    <Route path="/" element={<ReservarPublico />} />
    <Route path="/reservar/:slug" element={<ReservarPropiedad />} />
    <Route path="/pago/resultado" element={<ReservaResultado />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

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
    <Route path="*" element={<Navigate to="/" replace />} />
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
          <RentalsPublicRoutes />
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
          <OsRoutes />
        </BrowserRouter>
      ) : inRentals ? (
        <BrowserRouter basename="/alquileres">
          <RentalsPublicRoutes />
        </BrowserRouter>
      ) : (
        <BrowserRouter>
          <PublicSiteRoutes />
        </BrowserRouter>
      )}
    </QueryClientProvider>
  );
};
