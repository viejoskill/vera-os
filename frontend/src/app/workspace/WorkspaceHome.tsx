import { Radio, CalendarRange } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VeraChat } from './VeraChat';
import { Dock } from './Dock';
import { AudioWidget, CalendarWidget } from './widgets';
import { DigestSummaryCard } from '@app/screens/rentals/DigestSummaryCard';

/**
 * "Hoy" — foco en la conversación con VERA (Claude), acompañada de las dos
 * herramientas personales que el usuario usa a diario (radio y calendario) y el
 * dock de accesos. Sin insights ni objetivos: simpleza.
 */
export const WorkspaceHome = () => {
  const navigate = useNavigate();
  return (
    <div className="vera-home vera-home--focus" data-testid="workspace-home">
      <div className="vera-home__grid">
        <VeraChat />
        <aside className="vera-home__side" data-testid="workspace-side">
          <DigestSummaryCard onVerBandeja={() => navigate('/alquileres?tab=bot')} />
          <div className="vera-widget">
            <div className="vera-widget__head">
              <span className="vera-widget__title"><Radio size={15} /> Radio</span>
            </div>
            <div className="vera-widget__body"><AudioWidget /></div>
          </div>
          <div className="vera-widget">
            <div className="vera-widget__head">
              <span className="vera-widget__title"><CalendarRange size={15} /> Calendario</span>
            </div>
            <div className="vera-widget__body"><CalendarWidget /></div>
          </div>
        </aside>
      </div>
      <Dock />
    </div>
  );
};

export default WorkspaceHome;
