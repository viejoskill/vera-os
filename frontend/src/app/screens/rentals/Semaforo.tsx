import { procesoReserva, diasTexto, type Reservation } from './api';

const NIVEL_CLS: Record<string, string> = {
  ok: 'rt-sem--ok',
  atencion: 'rt-sem--warn',
  urgente: 'rt-sem--urgent',
  neutro: 'rt-sem--muted',
};

/** Semáforo interno de una reserva: puntos por paso + qué falta ahora. */
export const ReservaSemaforo = ({ reserva }: { reserva: Reservation }) => {
  const p = procesoReserva(reserva);
  if (p.nivel === 'neutro' || p.pasos.length === 0) return null;
  const dias = p.dias !== null && p.dias >= 0 ? diasTexto(p.dias) : '';
  const label = p.completo
    ? 'Todo listo'
    : `${p.falta}${dias && p.nivel !== 'ok' ? ` · ${dias}` : ''}`;
  const tip = p.pasos.map((s) => `${s.done ? '✓' : '○'} ${s.label}`).join('\n');
  return (
    <div className={`rt-sem ${NIVEL_CLS[p.nivel]}`} title={tip} data-testid={`rt-sem-${reserva.id}`}>
      <span className="rt-sem__dots" aria-hidden>
        {p.pasos.map((s) => (
          <span key={s.key} className={`rt-sem__dot ${s.done ? 'is-done' : ''}`} />
        ))}
      </span>
      <span className="rt-sem__txt" data-testid={`rt-sem-txt-${reserva.id}`}>{label}</span>
    </div>
  );
};
