import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ArrowRight } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import { env } from '@vera/config';
import logoHorizontal from '../../assets/brand/logo-horizontal.png';
import { supabase } from '../auth/supabase-client';
import { useAuth } from '../auth/AuthProvider';

const MIN_LENGTH = 10;

/** Pantalla obligatoria de cambio de clave de primer ingreso (clave temporal). */
export const ChangePasswordScreen = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < MIN_LENGTH) {
      setMessage(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSubmitting(false);
      setMessage('No pudimos actualizar la contraseña. Probá de nuevo.');
      return;
    }
    await fetch(`${env.backendUrl}/api/auth/change-password-done`, { method: 'POST' });
    await refreshProfile();
    setSubmitting(false);
    navigate('/hoy', { replace: true });
  };

  return (
    <div className="vera-login" data-testid="change-password-screen">
      <div className="vera-login__mood" aria-hidden="true">
        <span className="vera-login__glow vera-login__glow--1" />
        <span className="vera-login__glow vera-login__glow--2" />
      </div>
      <div className="vera-login__panel">
        <div className="vera-login__brand">
          <img className="vera-login__logo" src={logoHorizontal} alt="VERA OS" />
        </div>
        <div className="vera-login__intro">
          <div className="vera-pending__icon"><KeyRound size={22} /></div>
          <h1 className="vera-login__title">Elegí tu contraseña</h1>
          <p className="vera-login__subtitle">
            Por seguridad, tenés que cambiar la contraseña temporal antes de seguir. Mínimo {MIN_LENGTH} caracteres.
          </p>
        </div>
        <form className="vera-login__form" onSubmit={submit}>
          <Input
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            data-testid="change-password-new"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_LENGTH}
          />
          <Input
            label="Confirmar contraseña"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            data-testid="change-password-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={MIN_LENGTH}
          />
          {message && (
            <p className="vera-login__message" data-testid="change-password-message" role="alert">
              {message}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="vera-login__submit"
            data-testid="change-password-submit"
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar y continuar'}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </form>
        <p className="vera-login__foot">Sistema Operativo Comercial</p>
      </div>
    </div>
  );
};

export default ChangePasswordScreen;
