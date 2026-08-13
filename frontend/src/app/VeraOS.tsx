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
import { PlaceholderScreen } from '@app/screens/PlaceholderScreen';
import { StudioScreen } from '@app/screens/StudioScreen';
import { TeamScreen } from '@app/screens/TeamScreen';
import { TasacionesScreen } from '@app/screens/TasacionesScreen';
import { AlquileresScreen } from '@app/screens/rentals/AlquileresScreen';
import { RentalWorkspace } from '@app/screens/rentals/RentalWorkspace';
import { PublicListing } from '@app/public/PublicListing';
import { TasarPublico } from '@app/public/TasarPublico';
import { ReservarPublico } from '@app/public/ReservarPublico';
import { ReservarPropiedad } from '@app/public/ReservarPropiedad';
import { PublicPropertyDetail } from '@app/public/PublicPropertyDetail';
import { SignScreen } from '@app/public/SignScreen';
import { AuthProvider } from '@app/auth/AuthProvider';
import { RequireAuth } from '@app/auth/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

/** VERA OS root: providers + router + shell. */
export const VeraOS = () => {
  // Subdominio de marca para alquileres: sirve SOLO la web pública de reservas,
  // sin login ni el OS (alquileres.varelapropiedadescde.com.ar).
  const isRentalsHost = typeof window !== 'undefined' && window.location.hostname.startsWith('alquileres.');
  if (isRentalsHost) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<ReservarPublico />} />
            <Route path="/reservar" element={<ReservarPublico />} />
            <Route path="/reservar/:slug" element={<ReservarPropiedad />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    );
  }
  return (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/web" element={<PublicListing />} />
          <Route path="/web/:id" element={<PublicPropertyDetail />} />
          <Route path="/tasar" element={<TasarPublico />} />
          <Route path="/reservar" element={<ReservarPublico />} />
          <Route path="/reservar/:slug" element={<ReservarPropiedad />} />
          <Route path="/firma/:token" element={<SignScreen />} />
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
              <Route path="alquileres" element={<AlquileresScreen />} />
              <Route path="alquileres/nueva" element={<RentalWorkspace />} />
              <Route path="alquileres/:id" element={<RentalWorkspace />} />
              <Route path="*" element={<Navigate to="/hoy" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
  );
};
