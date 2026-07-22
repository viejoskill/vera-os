import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, CircleDashed, Clock, Eye, FileText, History,
  Link2, Mail, MessageCircle, PenLine, X,
} from 'lucide-react';
import { Badge, Button } from '@vera/ui';
import { PERSON_ROLE_LABELS } from '@vera/types';
import {
  useDocument, useDocumentHistory, useSendSignature, useSetSignatureMethod,
  type DocumentParticipant,
} from './useDocuments';

const DOC_STATUS: Record<string, string> = {
  draft: 'Borrador', generated: 'Generado', shared: 'Compartido', signed: 'Firmado', archived: 'Archivado',
};
const SIG_STATE: Record<string, string> = {
  none: 'Sin firmas', pending: 'Pendiente', in_progress: 'En proceso', signed: 'Firmado', rejected: 'Rechazado',
};
const PART_STATUS: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviado', viewed: 'Visto', signed: 'Firmado', rejected: 'Rechazado', expired: 'Vencido',
};
const METHOD_LABEL: Record<string, string> = { presencial: 'Presencial', digital: 'Digital' };
const EVENT_LABEL: Record<string, string> = {
  'document.created': 'Documento creado',
  'document.signature.method_set': 'Método de firma definido',
  'document.shared': 'Documento compartido',
  'document.participant.sent': 'Enlace de firma enviado',
  'document.participant.viewed': 'Documento visto por el firmante',
  'document.participant.signed': 'Firmado por un participante',
  'document.participant.rejected': 'Firma rechazada',
  'document.signed': 'Documento firmado (completo)',
  'document.edited': 'Documento editado',
  'document.generated': 'Documento generado',
  'document.archived': 'Documento archivado',
};

function roleLabel(role?: string | null): string {
  if (!role) return '';
  return PERSON_ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

function partIcon(status: string) {
  if (status === 'signed') return <Check size={16} className="vera-sig-ic--ok" />;
  if (status === 'rejected' || status === 'expired') return <X size={16} className="vera-sig-ic--bad" />;
  if (status === 'viewed') return <Eye size={16} className="vera-sig-ic--wait" />;
  if (status === 'sent') return <Clock size={16} className="vera-sig-ic--wait" />;
  return <CircleDashed size={16} className="vera-sig-ic--muted" />;
}

/** Pantalla de detalle del documento — centro de operaciones (estado, firmantes,
 * timeline, acciones). El usuario firma un Documento, no un PDF. */
export const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDocument(id);
  const history = useDocumentHistory(id);
  const setMethod = useSetSignatureMethod(id ?? '');
  const send = useSendSignature(id ?? '');
  const [flash, setFlash] = useState<string>('');

  if (doc.isLoading) return <div className="vera-screen"><p className="vera-docs__empty">Cargando documento…</p></div>;
  if (doc.isError || !doc.data)
    return (
      <div className="vera-screen">
        <div className="vera-docs__empty" data-testid="document-not-found">
          <FileText size={24} />
          <p>Documento no encontrado.</p>
          <Button variant="secondary" onClick={() => navigate('/documentos')}>Volver a Documentos</Button>
        </div>
      </div>
    );

  const d = doc.data;
  const allowedMethods = d.templateSnapshot?.signatureMethods ?? [];
  const participants = d.participants ?? [];

  const notify = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(''), 2500);
  };

  const handleSend = async (p: DocumentParticipant, channel: 'whatsapp' | 'email' | 'link') => {
    const res = await send.mutateAsync({ participantId: p.id, channel, baseUrl: window.location.origin });
    if (channel === 'whatsapp' && res.whatsappUrl) window.open(res.whatsappUrl, '_blank');
    else if (channel === 'email' && res.mailtoUrl) window.open(res.mailtoUrl, '_blank');
    else if (channel === 'link') {
      await navigator.clipboard.writeText(res.url).catch(() => undefined);
      notify('Enlace de firma copiado');
    }
    if (channel !== 'link') notify('Enlace listo para enviar');
  };

  return (
    <div className="vera-screen" data-testid="document-detail">
      <div className="vera-wizard__head">
        <button type="button" className="vera-wizard__back" onClick={() => navigate('/documentos')} data-testid="detail-back">
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="vera-wizard__title" data-testid="detail-title">{d.title || 'Documento'}</h1>
          <p className="vera-wizard__sub">{d.category} · {d.templateKey} v{d.templateVersion}</p>
        </div>
      </div>

      <div className="vera-detail__grid">
        {/* Columna izquierda: estado + firmantes */}
        <div className="vera-detail__col">
          <div className="vera-detail__card" data-testid="detail-status-card">
            <div className="vera-detail__stat">
              <span className="vera-detail__stat-label">Estado</span>
              <Badge tone="muted" data-testid="detail-doc-status">{DOC_STATUS[d.status] ?? d.status}</Badge>
            </div>
            <div className="vera-detail__stat">
              <span className="vera-detail__stat-label">Firma</span>
              <Badge tone={d.signatureState === 'signed' ? 'primary' : 'muted'} data-testid="detail-sig-state">
                {SIG_STATE[d.signatureState] ?? d.signatureState}
              </Badge>
            </div>
            <div className="vera-detail__stat">
              <span className="vera-detail__stat-label">Método de firma</span>
              {d.signatureMethod ? (
                <Badge tone="muted" data-testid="detail-method">{METHOD_LABEL[d.signatureMethod] ?? d.signatureMethod}</Badge>
              ) : allowedMethods.length ? (
                <div className="vera-detail__method-pick" data-testid="detail-method-pick">
                  {allowedMethods.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className="vera-chip"
                      disabled={setMethod.isPending}
                      onClick={() => setMethod.mutate(m)}
                      data-testid={`detail-set-method-${m}`}
                    >
                      {METHOD_LABEL[m] ?? m}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="vera-detail__muted">Sin firma</span>
              )}
            </div>
          </div>

          <div className="vera-detail__card" data-testid="detail-participants">
            <h2 className="vera-review__title"><PenLine size={16} /> Firmantes</h2>
            {participants.length === 0 && <p className="vera-detail__muted">Este documento no requiere firmas.</p>}
            {participants.map((p) => (
              <div key={p.id} className="vera-sig-row" data-testid={`participant-${p.id}`}>
                <span className="vera-sig-row__ic">{partIcon(p.signatureStatus)}</span>
                <div className="vera-sig-row__main">
                  <span className="vera-sig-row__name">{p.personName ?? 'Persona'}</span>
                  <span className="vera-sig-row__meta">
                    {roleLabel(p.role)}{p.signatureRequired ? '' : ' · opcional'} · {PART_STATUS[p.signatureStatus] ?? p.signatureStatus}
                  </span>
                </div>
                {p.signatureStatus !== 'signed' && d.status !== 'archived' && (
                  <div className="vera-sig-row__actions">
                    <button type="button" className="vera-icon-btn" title="Enviar por WhatsApp"
                      onClick={() => handleSend(p, 'whatsapp')} data-testid={`send-whatsapp-${p.id}`}>
                      <MessageCircle size={16} />
                    </button>
                    <button type="button" className="vera-icon-btn" title="Enviar por email"
                      onClick={() => handleSend(p, 'email')} data-testid={`send-email-${p.id}`}>
                      <Mail size={16} />
                    </button>
                    <button type="button" className="vera-icon-btn" title="Copiar enlace de firma"
                      onClick={() => handleSend(p, 'link')} data-testid={`send-link-${p.id}`}>
                      <Link2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="vera-detail__card" data-testid="detail-actions">
            <h2 className="vera-review__title">Acciones</h2>
            <div className="vera-detail__action-row">
              <Button variant="secondary" disabled title="Próximamente" data-testid="action-generate-pdf">
                <FileText size={16} /> Generar PDF
              </Button>
              <span className="vera-badge-soon">Próximamente</span>
            </div>
          </div>
        </div>

        {/* Columna derecha: timeline */}
        <div className="vera-detail__col">
          <div className="vera-detail__card" data-testid="detail-timeline">
            <h2 className="vera-review__title"><History size={16} /> Historial</h2>
            {history.isLoading && <p className="vera-detail__muted">Cargando historial…</p>}
            {history.data?.length === 0 && <p className="vera-detail__muted">Sin eventos todavía.</p>}
            <ol className="vera-timeline">
              {history.data?.map((e, i) => (
                <li key={e.id ?? i} className="vera-timeline__item" data-testid={`timeline-${e.type}`}>
                  <span className="vera-timeline__dot" />
                  <div>
                    <span className="vera-timeline__label">{EVENT_LABEL[e.type] ?? e.type}</span>
                    {(e.createdAt || e.occurredAt) && (
                      <span className="vera-timeline__at">
                        {new Date((e.createdAt || e.occurredAt) as string).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {flash && <div className="vera-flash" data-testid="detail-flash">{flash}</div>}
    </div>
  );
};

export default DocumentDetail;
