import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@vera/ui';
import { useDocuments } from './useDocuments';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', generated: 'Generado', shared: 'Compartido', signed: 'Firmado', archived: 'Archivado',
};

export const DocumentsList = () => {
  const { data = [], isLoading, isError } = useDocuments();
  const navigate = useNavigate();

  if (isLoading) return <p className="vera-docs__empty">Cargando documentos…</p>;
  if (isError)
    return (
      <div className="vera-docs__empty" data-testid="documents-error">
        <FileText size={24} />
        <p>Aún no hay tablas de Documentos. Ejecutá el SQL de <code>documents/schema.sql</code> en Supabase.</p>
      </div>
    );
  if (data.length === 0)
    return (
      <div className="vera-docs__empty" data-testid="documents-empty">
        <FileText size={24} />
        <p>Todavía no hay documentos. Un documento es una instancia creada a partir de una versión de template.</p>
      </div>
    );

  return (
    <div className="vera-docs__list" data-testid="documents-list">
      {data.map((d) => (
        <button
          type="button"
          key={d.id}
          className="vera-docs__row vera-docs__row--btn"
          onClick={() => navigate(`/documentos/${d.id}`)}
          data-testid={`document-${d.id}`}
        >
          <span className="vera-docs__icon"><FileText size={16} /></span>
          <div className="vera-docs__main">
            <span className="vera-docs__name">{d.title || 'Documento'} {d.number ? `#${d.number}` : ''}</span>
            <span className="vera-docs__meta">{d.category} · {d.templateKey} v{d.templateVersion}</span>
          </div>
          <Badge tone="muted">{STATUS_LABEL[d.status] ?? d.status}</Badge>
        </button>
      ))}
    </div>
  );
};
