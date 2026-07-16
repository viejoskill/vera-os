import { useNavigate } from 'react-router-dom';
import { Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@vera/ui';

/** Cared-for screen for Apps that are not live yet (reached via direct URL). */
export const PlaceholderScreen = ({ title }: { title: string }) => {
  const navigate = useNavigate();
  return (
    <div className="vera-screen">
      <div className="vera-empty" data-testid="placeholder-screen">
        <span className="vera-empty__icon">
          <Clock size={26} />
        </span>
        <p className="vera-empty__title">{title} está en camino.</p>
        <p className="vera-muted">
          La estamos construyendo con cuidado. Te avisaremos apenas esté lista para usar.
        </p>
        <Button size="md" data-testid="placeholder-back" onClick={() => navigate('/hoy')}>
          <ArrowLeft size={16} /> Volver a Inicio
        </Button>
      </div>
    </div>
  );
};
