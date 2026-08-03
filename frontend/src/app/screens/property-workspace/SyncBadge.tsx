import { Globe, ShoppingBag, CheckCircle2, AlertTriangle } from 'lucide-react';
import { relativeTime } from './channels-catalog';

type PubRecord = { status?: string; lastSync?: string | null } | undefined;
type Publications = Record<string, { status: string; lastSync?: string | null }> | undefined;

const Chip = ({
  icon,
  label,
  record,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  record: PubRecord;
  testid: string;
}) => {
  const status = record?.status;
  if (status !== 'published' && status !== 'inconsistent' && status !== 'error') return null;
  const ok = status === 'published';
  const when = ok && record?.lastSync ? relativeTime(record.lastSync) : '';
  return (
    <span
      className={`vera-sync-chip vera-sync-chip--${ok ? 'ok' : 'warn'}`}
      data-testid={testid}
      title={ok ? `Sincronizado ${when}` : 'Sincronización pendiente — reintentá guardando'}
    >
      {icon}
      <span className="vera-sync-chip__label">{label}</span>
      {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
      {when && <span className="vera-sync-chip__time">{when}</span>}
    </span>
  );
};

/** Cartelito de sincronización: muestra si la propiedad está reflejada en Web Varela
 *  y Mercado Libre, con el momento del último envío. Se actualiza tras cada Guardar. */
export const SyncBadge = ({ publications }: { publications: Publications }) => {
  const web = publications?.['web-varela'];
  const ml = publications?.['mercadolibre'];
  const anyOn = ['published', 'inconsistent', 'error'].includes(web?.status ?? '') ||
    ['published', 'inconsistent', 'error'].includes(ml?.status ?? '');
  if (!anyOn) return null;
  return (
    <div className="vera-sync-badge" data-testid="sync-badge">
      <Chip icon={<Globe size={13} />} label="Web" record={web} testid="sync-chip-web" />
      <Chip icon={<ShoppingBag size={13} />} label="ML" record={ml} testid="sync-chip-ml" />
    </div>
  );
};
