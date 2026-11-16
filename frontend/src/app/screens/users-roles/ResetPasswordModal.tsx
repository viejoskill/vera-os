import { useEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { usersApi } from './api';
import { SecretReveal } from './SecretReveal';

export const ResetPasswordModal = ({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
}) => {
  const [method, setMethod] = useState<'temporary' | 'email'>('temporary');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ method: string; temporaryPassword?: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod('temporary');
    setError('');
    setResult(null);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await usersApi.resetPassword(email, method);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos resetear la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="reset-password-modal">
      <div className="vera-modal__backdrop" onClick={onClose} />
      <div className="vera-modal__panel">
        <header className="vera-modal__head">
          <span className="vera-modal__title"><KeyRound size={18} /> Resetear contraseña</span>
          <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="reset-password-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="vera-modal__body vera-form">
          <p>Usuario: <strong>{email}</strong></p>
          {result ? (
            result.method === 'temporary' ? (
              <SecretReveal label="Contraseña temporal nueva" value={result.temporaryPassword ?? ''} />
            ) : (
              <p data-testid="reset-password-email-sent">Le enviamos un email de recuperación a {email}.</p>
            )
          ) : (
            <div className="vera-field">
              <label className="vera-radio-row">
                <input type="radio" checked={method === 'temporary'} onChange={() => setMethod('temporary')} data-testid="reset-password-method-temp" />
                Generar contraseña temporal (deberá cambiarla al ingresar)
              </label>
              <label className="vera-radio-row">
                <input type="radio" checked={method === 'email'} onChange={() => setMethod('email')} data-testid="reset-password-method-email" />
                Enviar email de recuperación
              </label>
            </div>
          )}
          {error && <p className="vera-modal__error" data-testid="reset-password-error">{error}</p>}
        </div>
        <footer className="vera-modal__foot">
          {result ? (
            <Button variant="primary" size="md" data-testid="reset-password-done" onClick={onClose}>Listo</Button>
          ) : (
            <>
              <Button variant="ghost" size="md" data-testid="reset-password-cancel" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" size="md" disabled={saving} data-testid="reset-password-submit" onClick={submit}>
                {saving ? (<><Loader2 size={15} className="vera-spin" /> Procesando…</>) : 'Confirmar'}
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
