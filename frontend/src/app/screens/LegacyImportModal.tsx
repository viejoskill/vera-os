import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X, DownloadCloud, CheckCircle2, AlertTriangle, Loader2, Image as ImageIcon, FileText } from 'lucide-react';
import { env } from '@vera/config';

const API = `${env.backendUrl}/api/migration`;

interface Job {
  status: 'running' | 'done' | 'error';
  total: number;
  processed: number;
  created: number;
  updated: number;
  images_done: number;
  docs_done: number;
  items_media_skipped: number;
  current: string;
  errors: string[];
  legacy_column: boolean | null;
  error?: string;
}

/** Migración desde el CRM Legacy — muestra progreso por propiedad, imágenes,
 * resumen final y errores. Idempotente: reejecutar no duplica. */
export const LegacyImportModal = ({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}) => {
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      setJob(null);
      setStarting(false);
      window.clearInterval(timer.current);
    }
  }, [open]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  if (!open) return null;

  const start = async () => {
    setStarting(true);
    setJob(null);
    try {
      const res = await fetch(`${API}/import-legacy`, { method: 'POST' });
      const { job_id } = (await res.json()) as { job_id: string };
      timer.current = window.setInterval(async () => {
        const r = await fetch(`${API}/status/${job_id}`);
        if (!r.ok) return;
        const j = (await r.json()) as Job;
        setJob(j);
        if (j.status !== 'running') {
          window.clearInterval(timer.current);
          if (j.status === 'done') onDone?.();
        }
      }, 1200);
    } catch {
      setJob({ status: 'error', error: 'No se pudo iniciar la migración.' } as Job);
    } finally {
      setStarting(false);
    }
  };

  const pct = job && job.total ? Math.round((job.processed / job.total) * 100) : 0;
  const running = starting || job?.status === 'running';

  return createPortal(
    <div className="vera-import" data-testid="legacy-import-modal" onClick={onClose}>
      <div className="vera-import__panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="vera-import__head">
          <span className="vera-import__title">
            <DownloadCloud size={18} /> Importar desde CRM Varela
          </span>
          <button type="button" className="vera-import__close" data-testid="legacy-import-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </header>

        {!job && !starting && (
          <div className="vera-import__intro">
            <p>Vamos a traer las propiedades del CRM Varela a tu cartera. Es una migración única y podés repetirla sin duplicar.</p>
            <button type="button" className="vera-import__cta" data-testid="legacy-import-start" onClick={start}>
              <DownloadCloud size={16} /> Iniciar migración
            </button>
          </div>
        )}

        {(starting || job) && (
          <div className="vera-import__body">
            <div className="vera-import__bar" data-testid="legacy-import-progress">
              <div className="vera-import__bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="vera-import__status">
              {running ? (
                <span className="vera-import__running">
                  <Loader2 size={14} className="vera-import__spin" />
                  {job ? `Procesando ${job.processed}/${job.total} — ${job.current || '...'}` : 'Conectando con el CRM Varela…'}
                </span>
              ) : job?.status === 'done' ? (
                <span className="vera-import__ok" data-testid="legacy-import-done">
                  <CheckCircle2 size={16} /> Migración completada
                </span>
              ) : (
                <span className="vera-import__err">
                  <AlertTriangle size={16} /> {job?.error || 'La migración falló'}
                </span>
              )}
            </div>

            {job && (
              <div className="vera-import__stats" data-testid="legacy-import-summary">
                <span className="vera-import__stat"><b>{job.created}</b> creadas</span>
                <span className="vera-import__stat"><b>{job.updated}</b> actualizadas</span>
                <span className="vera-import__stat"><ImageIcon size={13} /> <b>{job.images_done}</b> imágenes</span>
                <span className="vera-import__stat"><FileText size={13} /> <b>{job.docs_done}</b> documentos</span>
                {job.errors.length > 0 && (
                  <span className="vera-import__stat vera-import__stat--err"><b>{job.errors.length}</b> errores</span>
                )}
              </div>
            )}

            {job && job.legacy_column === false && (
              <p className="vera-import__hint">
                Nota: el <code>legacy_id</code> se guarda como referencia para no duplicar. Para persistirlo también en la
                tabla de propiedades, corré la migración SQL provista.
              </p>
            )}

            {job && job.errors.length > 0 && (
              <ul className="vera-import__errors" data-testid="legacy-import-errors">
                {job.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}

            {job && job.status !== 'running' && (
              <div className="vera-import__actions">
                {job.status === 'error' && (
                  <button type="button" className="vera-import__cta" data-testid="legacy-import-retry" onClick={start}>
                    Reintentar
                  </button>
                )}
                <button type="button" className="vera-import__secondary" data-testid="legacy-import-finish" onClick={onClose}>
                  Cerrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  ) as unknown as ReactElement;
};
