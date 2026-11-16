import { Routes, Route, Navigate } from 'react-router-dom';
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
import { UsersRolesScreen } from '@app/screens/users-roles/UsersRolesScreen';
import { ChangePasswordScreen } from '@app/screens/ChangePasswordScreen';
import { TasacionesScreen } from '@app/screens/TasacionesScreen';
import { AlquileresScreen } from '@app/screens/rentals/AlquileresScreen';
import { KeysBoardScreen } from '@app/screens/KeysBoardScreen';
import { RentalBotSimulator } from '@app/screens/rentals/RentalBotSimulator';
import { RentalBotTraining } from '@app/screens/rentals/RentalBotTraining';
import { RentalWorkspace } from '@app/screens/rentals/RentalWorkspace';
import { LiquidacionesScreen } from '@app/screens/rentals/LiquidacionesScreen';
import { ContabilidadScreen } from '@app/screens/ContabilidadScreen';
import { EstadisticasScreen } from '@app/screens/EstadisticasScreen';
import { AuthProvider } from '@app/auth/AuthProvider';
import { RequireAuth } from '@app/auth/RequireAuth';

/** El OS interno (login + app). Se monta bajo el basename /veraos, así todos sus
 *  links absolutos (/hoy, /propiedades…) quedan como /veraos/... sin tocar nada interno.
 *  Vive en su propio archivo (y se carga con React.lazy desde VeraOS.tsx) para que todo
 *  este código del CRM quede en un chunk aparte y no infle el bundle del sitio público. */
const OsRoutes = () => (
  <AuthProvider>
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route element={<RequireAuth />}>
        <Route path="cambiar-clave" element={<ChangePasswordScreen />} />
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
          <Route path="equipo" element={<UsersRolesScreen />} />
          <Route path="tasaciones" element={<TasacionesScreen />} />
          <Route path="llaves" element={<KeysBoardScreen />} />
          <Route path="bot-alquileres" element={<RentalBotSimulator />} />
          <Route path="entrenar-vera" element={<RentalBotTraining />} />
          <Route path="alquileres" element={<AlquileresScreen />} />
          <Route path="alquileres/nueva" element={<RentalWorkspace />} />
          <Route path="alquileres/:id" element={<RentalWorkspace />} />
          <Route path="liquidaciones" element={<LiquidacionesScreen />} />
          <Route path="contabilidad" element={<ContabilidadScreen />} />
          <Route path="estadisticas" element={<EstadisticasScreen />} />
          <Route path="*" element={<Navigate to="/hoy" replace />} />
        </Route>
      </Route>
    </Routes>
  </AuthProvider>
);

export default OsRoutes;
