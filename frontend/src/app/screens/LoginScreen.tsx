import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import { env } from '@vera/config';
import logoHorizontal from '../../assets/brand/logo-horizontal.png';
import { supabase } from '../auth/supabase-client';
import { useAuth } from '../auth/AuthProvider';

interface FromState {
  from?: { pathname: string; search?: string };
}

export const LoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, ready, bootAuthed } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as FromState | null)?.from;
  const redirectTo = from ? `${from.pathname}${from.search ?? ''}` : '/hoy';

  // Returning user with a live session → straight into "Hoy", no login flash.
  if (session) return <Navigate to={redirectTo} replace />;
  // Stored session still hydrating → render nothing (imperceptible) instead of a flash.
  if (!ready && bootAuthed) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const cleanEmail = email.trim();

    const lockCheck = await fetch(`${env.backendUrl}/api/auth/login-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    }).then((r) => (r.ok ? r.json() : { locked: false }));

    if (lockCheck.locked) {
      setSubmitting(false);
      const mins = Math.ceil((lockCheck.retryAfterSeconds ?? 0) / 60) || 1;
      setMessage(`Demasiados intentos fallidos. Probá de nuevo en ${mins} minuto(s).`);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setSubmitting(false);
    if (error) {
      fetch(`${env.backendUrl}/api/auth/login-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      }).catch(() => {});
      setMessage('No pudimos ingresar. Revisá el email y la contraseña.');
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  const googleSignIn = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/veraos/login` },
    });
    if (error) setMessage('No pudimos iniciar con Google.');
  };

  return (
    <div className="vera-login" data-testid="login-screen">
      <div className="vera-login__mood" aria-hidden="true">
        <span className="vera-login__glow vera-login__glow--1" />
        <span className="vera-login__glow vera-login__glow--2" />
      </div>

      <div className="vera-login__panel">
        <div className="vera-login__brand">
          <img className="vera-login__logo" src={logoHorizontal} alt="VERA OS" />
        </div>

        <div className="vera-login__intro">
          <h1 className="vera-login__title">Tu operación, en un solo lugar.</h1>
          <p className="vera-login__subtitle">Ingresá para continuar donde lo dejaste.</p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          className="vera-login__google"
          data-testid="login-google"
          onClick={googleSignIn}
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt=""
            width={18}
            height={18}
          />
          Continuar con Google
        </Button>

        <div className="vera-login__divider"><span>o con tu email</span></div>

        <form className="vera-login__form" onSubmit={submit}>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            data-testid="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            data-testid="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {message && (
            <p className="vera-login__message" data-testid="login-message" role="alert">
              {message}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="vera-login__submit"
            data-testid="login-submit"
            disabled={submitting}
          >
            {submitting ? 'Ingresando…' : 'Ingresar a VERA'}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </form>

        <p className="vera-login__foot">Sistema Operativo Comercial</p>
      </div>
    </div>
  );
};
