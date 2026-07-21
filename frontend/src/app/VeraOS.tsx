import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import { PropertiesScreen } from '@app/screens/PropertiesScreen';
import { PropertyWorkspace } from '@app/screens/property-workspace';
import { PeopleScreen } from '@app/screens/people/PeopleScreen';
import { PersonDetail } from '@app/screens/people/PersonDetail';
import { EventLogScreen } from '@app/screens/EventLogScreen';
import { WorkspaceHome } from '@app/workspace/WorkspaceHome';
import { VeraBotWorkspace } from '@app/vera-bot';
import { IntegrationsScreen } from '@app/integraciones';
import { LoginScreen } from '@app/screens/LoginScreen';
import { PlaceholderScreen } from '@app/screens/PlaceholderScreen';
import { PublicListing } from '@app/public/PublicListing';
import { PublicPropertyDetail } from '@app/public/PublicPropertyDetail';
import { AuthProvider } from '@app/auth/AuthProvider';
import { RequireAuth } from '@app/auth/RequireAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

/** VERA OS root: providers + router + shell. */
export const VeraOS = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/web" element={<PublicListing />} />
          <Route path="/web/:id" element={<PublicPropertyDetail />} />
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
              <Route path="operaciones" element={<PlaceholderScreen title="Operaciones" />} />
              <Route path="studio" element={<PlaceholderScreen title="Studio" />} />
              <Route path="integraciones" element={<IntegrationsScreen />} />
              <Route path="*" element={<Navigate to="/hoy" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
