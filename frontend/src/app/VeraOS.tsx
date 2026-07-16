import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import { PropertiesScreen } from '@app/screens/PropertiesScreen';
import { PropertyWorkspace } from '@app/screens/property-workspace';
import { TodayScreen } from '@app/screens/TodayScreen';
import { LoginScreen } from '@app/screens/LoginScreen';
import { PlaceholderScreen } from '@app/screens/PlaceholderScreen';
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
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/hoy" replace />} />
              <Route path="hoy" element={<TodayScreen />} />
              <Route path="propiedades" element={<PropertiesScreen />} />
              <Route path="propiedades/nueva" element={<PropertyWorkspace />} />
              <Route path="propiedades/:id" element={<PropertyWorkspace />} />
              <Route path="operaciones" element={<PlaceholderScreen title="Operaciones" />} />
              <Route path="studio" element={<PlaceholderScreen title="Studio" />} />
              <Route path="*" element={<Navigate to="/hoy" replace />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
