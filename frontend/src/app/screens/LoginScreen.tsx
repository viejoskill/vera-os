import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import logoHorizontal from '../../assets/brand/logo-horizontal.png';
import { supabase } from '../auth/supabase-client';
import { useAuth } from '../auth/AuthProvider';

interface FromState {
  from?: { pathname: string; search?: string };
}

type Mode = 'signin' | 'signup';

export const LoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, ready, bootAuthed } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    setNotice(null);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setSubmitting(false);
      if (error) {
        setMessage('No pudimos ingresar. Revisá el email y la contraseña.');
        return;
      }
      navigate(redirectTo, { replace: true });
      return;
    }

    // sign up
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message || 'No pudimos crear la cuenta.');
      return;
    }
    if (data.session) {
      // Confirmación de email desactivada → sesión inmediata.
      navigate(redirectTo, { replace: true });
      return;
    }
    setNotice('¡Listo! Revisá tu email para confirmar la cuenta. Después, un administrador te habilita el acceso.');
  };

  const googleSignIn = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
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
          <h1 className="vera-login__title">
            {mode === 'signin' ? 'Tu operación, en un solo lugar.' : 'Creá tu cuenta en VERA.'}
          </h1>
          <p className="vera-login__subtitle">
            {mode === 'signin'
              ? 'Ingresá para continuar donde lo dejaste.'
              : 'Registrate y un administrador te habilitará el acceso.'}
          </p>
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
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
          {notice && (
            <p className="vera-login__notice" data-testid="login-notice" role="status">
              {notice}
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
            {submitting
              ? mode === 'signin' ? 'Ingresando…' : 'Creando…'
              : mode === 'signin' ? 'Ingresar a VERA' : 'Crear cuenta'}
            {!submitting && <ArrowRight size={16} />}
          </Button>
        </form>

        <button
          type="button"
          className="vera-login__switch"
          data-testid="login-toggle-mode"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setMessage(null);
            setNotice(null);
          }}
        >
          {mode === 'signin'
            ? '¿No tenés cuenta? Registrate'
            : '¿Ya tenés cuenta? Ingresá'}
        </button>

        <p className="vera-login__foot">Sistema Operativo Comercial</p>
      </div>
    </div>
  );
};
