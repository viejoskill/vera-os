import { Clock, LogOut } from 'lucide-react';
import { Button } from '@vera/ui';
import { useAuth } from './AuthProvider';
import logoHorizontal from '../../assets/brand/logo-horizontal.png';

/** Shown to authenticated users who are not yet approved for the workspace. */
export const PendingApproval = () => {
  const { session, signOut } = useAuth();
  return (
    <div className="vera-login" data-testid="pending-approval-screen">
      <div className="vera-login__mood" aria-hidden="true">
        <span className="vera-login__glow vera-login__glow--1" />
        <span className="vera-login__glow vera-login__glow--2" />
      </div>
      <div className="vera-login__panel">
        <div className="vera-login__brand">
          <img className="vera-login__logo" src={logoHorizontal} alt="VERA OS" />
        </div>
        <div className="vera-login__intro">
          <div className="vera-pending__icon"><Clock size={22} /></div>
          <h1 className="vera-login__title">Cuenta pendiente de aprobación</h1>
          <p className="vera-login__subtitle">
            Tu cuenta ({session?.user?.email}) fue creada correctamente. Un administrador
            debe habilitarte el acceso a VERA. Te avisaremos cuando esté lista.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          className="vera-login__submit"
          data-testid="pending-signout"
          onClick={() => signOut()}
        >
          <LogOut size={16} /> Cerrar sesión
        </Button>
        <p className="vera-login__foot">Sistema Operativo Comercial</p>
      </div>
    </div>
  );
};

export default PendingApproval;
