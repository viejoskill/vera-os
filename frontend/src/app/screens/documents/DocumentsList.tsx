import { useState } from 'react';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@vera/ui';
import { useDocuments, useDeleteDocument } from './useDocuments';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', generated: 'Generado', shared: 'Compartido', signed: 'Firmado', archived: 'Archivado',
};

export const DocumentsList = () => {
  const { data = [], isLoading, isError } = useDocuments();
  const remove = useDeleteDocument();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleDelete = async (id: string, title: string) => {
    const label = title || 'este documento';
    if (!window.confirm(`¿Eliminar «${label}»? Esta acción es permanente.`)) return;
    setDeletingId(id);
    try {
      await remove.mutateAsync(id);
    } catch {
      window.alert('No se pudo eliminar el documento. Intentá de nuevo.');
    } finally {
      setDeletingId(null);
    }
  };

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
        <div className="vera-docs__row" key={d.id} data-testid={`document-${d.id}`}>
          <button
            type="button"
            className="vera-docs__rowmain"
            onClick={() => navigate(`/documentos/${d.id}`)}
            data-testid={`document-open-${d.id}`}
          >
            <span className="vera-docs__icon"><FileText size={16} /></span>
            <div className="vera-docs__main">
              <span className="vera-docs__name">{d.title || 'Documento'} {d.number ? `#${d.number}` : ''}</span>
              <span className="vera-docs__meta">{d.category} · {d.templateKey} v{d.templateVersion}</span>
            </div>
          </button>
          <Badge tone="muted">{STATUS_LABEL[d.status] ?? d.status}</Badge>
          <button
            type="button"
            className="vera-docs__delete"
            title="Eliminar documento"
            aria-label="Eliminar documento"
            disabled={deletingId === d.id}
            onClick={() => handleDelete(d.id, `${d.title || 'Documento'}${d.number ? ` #${d.number}` : ''}`)}
            data-testid={`document-delete-${d.id}`}
          >
            {deletingId === d.id ? <Loader2 size={16} className="vera-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      ))}
    </div>
  );
};
