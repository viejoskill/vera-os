import { Clock, LogOut, Ban } from 'lucide-react';
import { Button } from '@vera/ui';
import { useAuth } from './AuthProvider';
import logoHorizontal from '../../assets/brand/logo-horizontal.png';

/** Shown to authenticated users without active access (sin alta todavía, o cuenta desactivada). */
export const PendingApproval = () => {
  const { session, profile, signOut } = useAuth();
  const disabled = Boolean(profile && !profile.active);

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
          <div className="vera-pending__icon">{disabled ? <Ban size={22} /> : <Clock size={22} />}</div>
          <h1 className="vera-login__title" data-testid="pending-title">
            {disabled ? 'Cuenta desactivada' : 'Cuenta sin acceso'}
          </h1>
          <p className="vera-login__subtitle">
            {disabled
              ? `La cuenta ${session?.user?.email} fue desactivada por un administrador.`
              : `La cuenta ${session?.user?.email} todavía no tiene acceso a VERA OS. Pedile a un administrador que te cree el usuario desde Usuarios y Roles.`}
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
