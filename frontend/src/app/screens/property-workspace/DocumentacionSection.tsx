import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { useDocumentsByProperty, type DocumentDetail } from '@app/screens/documents/useDocuments';

const CHECKLIST: { key: string; label: string }[] = [
  { key: 'autorizacion', label: 'Autorización' },
  { key: 'reserva', label: 'Reserva' },
  { key: 'recibo', label: 'Recibo' },
  { key: 'escritura', label: 'Escritura' },
];

function pick(docs: DocumentDetail[], category: string) {
  const items = docs.filter((d) => d.category === category);
  const signed = items.find((d) => d.signatureState === 'signed' || d.status === 'signed');
  const inProgress = items.find((d) => d.signatureState === 'in_progress' || d.status === 'shared');
  const doc = signed ?? inProgress ?? items[0];
  const state = signed ? 'signed' : items.length ? 'progress' : 'empty';
  return { doc, state } as const;
}

/** Tarjeta "Documentación" dentro de la propiedad: el ciclo de vida documental
 * vive junto a la propiedad (se tilda al firmar, con acceso directo al documento). */
export const DocumentacionSection = ({ propertyId }: { propertyId: string }) => {
  const { data = [], isLoading } = useDocumentsByProperty(propertyId);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="ws-section" data-testid="property-documentacion">
        <p className="vera-detail__muted" data-testid="doc-checklist-loading">Buscando documentos…</p>
      </section>
    );
  }

  return (
    <section className="ws-section" data-testid="property-documentacion">
      <ul className="vera-doclist">
        {CHECKLIST.map(({ key, label }) => {
          const { doc, state } = pick(data, key);
          return (
            <li key={key} className="vera-doclist__item" data-testid={`doc-check-${key}`}>
              <span className="vera-doclist__ic">
                {state === 'signed' ? <CheckCircle2 size={18} className="vera-sig-ic--ok" />
                  : state === 'progress' ? <Clock size={18} className="vera-sig-ic--wait" />
                  : <Circle size={18} className="vera-sig-ic--muted" />}
              </span>
              <span className="vera-doclist__label">{label}</span>
              {doc ? (
                <button
                  type="button"
                  className="vera-doclist__link"
                  onClick={() => navigate(`/documentos/${doc.id}`)}
                  data-testid={`doc-view-${key}`}
                >
                  Ver documento
                </button>
              ) : (
                <button
                  type="button"
                  className="vera-doclist__add"
                  onClick={() => navigate('/documentos/nuevo')}
                  data-testid={`doc-add-${key}`}
                >
                  + Crear
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
