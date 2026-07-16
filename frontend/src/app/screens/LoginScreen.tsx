import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Input, Button } from '@vera/ui';
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      setMessage('No pudimos ingresar. Revisá el email y la contraseña.');
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="vera-login" data-testid="login-screen">
      <div className="vera-login__mood" aria-hidden="true">
        <span className="vera-login__glow vera-login__glow--1" />
        <span className="vera-login__glow vera-login__glow--2" />
      </div>

      <div className="vera-login__panel">
        <div className="vera-login__brand">
          <span className="vera-login__brand-mark">V</span>
          <span className="vera-login__brand-name">
            VERA <span>OS</span>
          </span>
        </div>

        <div className="vera-login__intro">
          <h1 className="vera-login__title">Tu operación, en un solo lugar.</h1>
          <p className="vera-login__subtitle">Ingresá para continuar donde lo dejaste.</p>
        </div>

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
