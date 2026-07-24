import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Copy, Check, X, MessageCircle } from 'lucide-react';
import { Button, Input, Textarea } from '@vera/ui';
import { visitService, buildOwnerMessage, whatsappLink, peopleService } from '@vera/services';
import type { VisitInput } from '@vera/types';
import { useAuthUser } from '@app/auth/useAuthUser';

const todayISO = () => new Date().toISOString().slice(0, 10);

interface Props {
  propertyId: string;
  address: string;
  ownerId?: string;
  onClose: () => void;
  onRegistered?: () => void;
}

/** Modal único de "Registrar visita" (reusable desde la lista y el workspace).
 * Si el propietario tiene teléfono cargado, ofrece enviar el aviso por WhatsApp
 * en un clic; si no, genera el mensaje para copiar. VERA nunca envía sola. */
export const VisitModal = ({ propertyId, address, ownerId, onClose, onRegistered }: Props) => {
  const queryClient = useQueryClient();
  const { displayName } = useAuthUser();
  const [owner, setOwner] = useState<{ fullName: string; primaryPhone: string } | null>(null);
  const [form, setForm] = useState<VisitInput>({
    date: todayISO(), time: '', interested: '', agent: displayName || '', comment: '', notifyOwner: true,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (ownerId) {
      peopleService.get(ownerId).then((p) => {
        if (alive) setOwner({ fullName: p.fullName, primaryPhone: p.primaryPhone });
      }).catch(() => setOwner(null));
    }
    return () => { alive = false; };
  }, [ownerId]);

  const phone = owner?.primaryPhone?.trim() || '';
  const hasPhone = phone.length >= 6;
  const update = (patch: Partial<VisitInput>) => setForm((f) => ({ ...f, ...patch }));

  const buildMsg = () =>
    buildOwnerMessage({ address, comment: form.comment, ownerName: owner?.fullName, agent: form.agent });

  const mutation = useMutation({
    mutationFn: (input: VisitInput) => visitService.create(propertyId, input),
    onSuccess: async (_v, input) => {
      await queryClient.invalidateQueries({ queryKey: ['visits', propertyId] });
      if (input.notifyOwner) {
        const msg = buildMsg();
        if (hasPhone) {
          window.open(whatsappLink(phone, msg), '_blank', 'noopener');
          onRegistered?.();
          onClose();
          return;
        }
        setMessage(msg); // sin teléfono → mostramos el mensaje para copiar
        onRegistered?.();
        return;
      }
      onRegistered?.();
      onClose();
    },
  });

  const copyMessage = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };

  const previewName = useMemo(() => owner?.fullName || 'el propietario', [owner]);

  return (
    <div className="vera-modal" role="dialog" aria-modal="true" data-testid="visit-modal" onClick={(e) => e.stopPropagation()}>
      <div className="vera-modal__backdrop" onClick={onClose} />
      <div className="vera-modal__panel">
        <div className="vera-modal__head">
          <h3 className="vera-modal__title"><CalendarDays size={17} /> Registrar visita</h3>
          <button type="button" className="vera-modal__close" aria-label="Cerrar" data-testid="visit-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {message ? (
          <div className="vera-modal__body">
            <div className="vera-owner-msg" data-testid="owner-message">
              <span className="vera-field__label">Mensaje para {previewName}</span>
              <p className="vera-owner-msg__text">{message}</p>
              <Button variant="secondary" size="sm" data-testid="copy-message-btn" onClick={copyMessage}>
                {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar mensaje</>}
              </Button>
              <p className="vera-owner-msg__hint">El propietario no tiene teléfono cargado. Copiá el mensaje y enviáselo por tu medio habitual.</p>
            </div>
            <div className="vera-modal__foot">
              <Button variant="primary" size="md" data-testid="visit-done" onClick={onClose}>Listo</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="vera-modal__body">
              <div className="vera-form-grid">
                <Input label="Fecha" type="date" data-testid="visit-date" value={form.date} onChange={(e) => update({ date: e.target.value })} />
                <Input label="Hora" type="time" data-testid="visit-time" value={form.time} onChange={(e) => update({ time: e.target.value })} />
              </div>
              <Input label="Nombre del interesado" placeholder="Ej.: Juan García" data-testid="visit-interested" value={form.interested} onChange={(e) => update({ interested: e.target.value })} />
              <Input label="Agente" placeholder="Ej.: Sofía Martín" data-testid="visit-agent" value={form.agent} onChange={(e) => update({ agent: e.target.value })} />
              <Textarea label="Comentario para el propietario" placeholder="Qué se conversó, impresiones, próximos pasos… (se incluye en el aviso)" data-testid="visit-comment" value={form.comment} onChange={(e) => update({ comment: e.target.value })} />

              <div className={`vera-visit-notify${hasPhone ? ' vera-visit-notify--wa' : ''}`} data-testid="visit-notify-box">
                <div className="vera-visit-notify__info">
                  <span className="vera-visit-notify__title">
                    <MessageCircle size={15} /> {hasPhone ? 'Enviar WhatsApp al propietario' : 'Avisar al propietario'}
                  </span>
                  <span className="vera-visit-notify__sub">
                    {hasPhone
                      ? `${owner?.fullName} · ${phone}`
                      : ownerId
                        ? 'El propietario no tiene teléfono cargado — generamos el mensaje para copiar.'
                        : 'Sin propietario asignado — generamos el mensaje para copiar.'}
                  </span>
                </div>
                <label className="vera-visit-notify__check" data-testid="visit-notify">
                  <input type="checkbox" checked={form.notifyOwner} onChange={(e) => update({ notifyOwner: e.target.checked })} />
                  {hasPhone ? 'Enviar' : 'Generar'}
                </label>
              </div>
            </div>
            <div className="vera-modal__foot">
              <Button variant="ghost" size="md" data-testid="visit-cancel" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" size="md" data-testid="visit-submit" disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
                {mutation.isPending ? 'Registrando…' : 'Registrar visita'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VisitModal;
