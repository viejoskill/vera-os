import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle, MessageCircle } from 'lucide-react';
import { api, fmtDate, waLink } from '@app/screens/rentals/api';
import '@app/screens/rentals/rentals.css';

type Info = { estado: string; propertyTitulo?: string; checkIn?: string; checkOut?: string; huesped?: string; whatsappAgencia?: string };

/** Página a la que vuelve el huésped después de pagar en Mercado Pago. Verifica el pago y ofrece avisar por WhatsApp. */
export const ReservaResultado = () => {
  const [sp] = useSearchParams();
  const rid = sp.get('external_reference') || sp.get('reservaId') || '';
  const paymentId = sp.get('payment_id') || sp.get('collection_id') || undefined;
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rid) { setLoading(false); return; }
    api.verifyPayment(rid, paymentId).then(setInfo).catch(() => setInfo(null)).finally(() => setLoading(false));
  }, [rid, paymentId]);

  const pagado = info?.estado === 'pagado';
  const waNum = (info?.whatsappAgencia || '').replace(/\D/g, '');
  const waFull = waNum ? (waNum.startsWith('54') ? waNum : `549${waNum}`) : '';
  const msg = `¡Hola! Soy ${info?.huesped || ''}, ya aboné la seña de la reserva de ${info?.propertyTitulo || 'la propiedad'} del ${fmtDate(info?.checkIn)} al ${fmtDate(info?.checkOut)}. Adjunto el comprobante.`;

  return (
    <div className="rt-pub" data-testid="pago-resultado">
      <div className="rt-result">
        {loading ? <p className="rt__loading">Verificando el pago…</p> : (
          <>
            {pagado ? (
              <>
                <CheckCircle2 size={56} className="rt-result__ok" />
                <h1>¡Pago recibido!</h1>
                <p>Registramos tu seña de <strong>{info?.propertyTitulo}</strong>{info?.checkIn ? ` (${fmtDate(info?.checkIn)} → ${fmtDate(info?.checkOut)})` : ''}. ¡Tu reserva quedó confirmada!</p>
              </>
            ) : info?.estado === 'rechazado' ? (
              <>
                <XCircle size={56} className="rt-result__err" />
                <h1>El pago no se pudo procesar</h1>
                <p>Podés volver a intentarlo o escribirnos para coordinar el pago de otra forma.</p>
              </>
            ) : (
              <>
                <Clock size={56} className="rt-result__pend" />
                <h1>Estamos confirmando tu pago</h1>
                <p>Puede demorar unos minutos en acreditarse. Si ya pagaste, avisanos por WhatsApp y lo verificamos.</p>
              </>
            )}

            {waFull && (
              <a className="rt-result__wa" href={waLink(waFull, msg)} target="_blank" rel="noreferrer" data-testid="pago-wa">
                <MessageCircle size={18} /> Avisar por WhatsApp que ya pagué
              </a>
            )}
            <Link to="/reservar" className="rt-result__back" data-testid="pago-volver">Volver a las propiedades</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default ReservaResultado;
