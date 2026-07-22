import { FileText, Layers } from 'lucide-react';
import { Badge } from '@vera/ui';
import { useTemplates } from './useDocuments';

const STATUS_TONE: Record<string, 'default' | 'primary' | 'muted'> = {
  active: 'primary', draft: 'muted', deprecated: 'muted', archived: 'muted',
};

export const TemplatesList = () => {
  const { data = [], isLoading, isError } = useTemplates();

  if (isLoading) return <p className="vera-docs__empty">Cargando templates…</p>;
  if (isError)
    return (
      <div className="vera-docs__empty" data-testid="templates-error">
        <Layers size={24} />
        <p>Aún no hay tablas de Documentos. Ejecutá el SQL de <code>documents/schema.sql</code> en Supabase.</p>
      </div>
    );
  if (data.length === 0)
    return (
      <div className="vera-docs__empty" data-testid="templates-empty">
        <Layers size={24} />
        <p>Todavía no hay templates. Un template define un tipo de documento (versionado).</p>
      </div>
    );

  return (
    <div className="vera-docs__list" data-testid="templates-list">
      {data.map((t) => (
        <div key={t.id} className="vera-docs__row" data-testid={`template-${t.id}`}>
          <span className="vera-docs__icon"><FileText size={16} /></span>
          <div className="vera-docs__main">
            <span className="vera-docs__name">{t.name}</span>
            <span className="vera-docs__meta">{t.category} · {t.templateKey}</span>
          </div>
          <Badge tone="muted">v{t.version}</Badge>
          <Badge tone={STATUS_TONE[t.status] ?? 'muted'}>{t.status}</Badge>
        </div>
      ))}
    </div>
  );
};
