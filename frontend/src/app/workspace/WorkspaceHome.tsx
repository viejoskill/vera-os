import { VeraChat } from './VeraChat';

/**
 * "Hoy" — pantalla enfocada: una sola ventana de conversación con VERA (Claude),
 * donde el usuario puede preguntar cualquier cosa del sistema y de la inmobiliaria.
 * Simpleza por sobre densidad.
 */
export const WorkspaceHome = () => (
  <div className="vera-home vera-home--focus" data-testid="workspace-home">
    <VeraChat />
  </div>
);

export default WorkspaceHome;
