/**
 * Catálogo de canales de publicación (proveedores). Fuente única de verdad para la
 * UI. Escalable: agregar un proveedor es sumar una entrada. `enabled` indica los que
 * ya se pueden operar hoy; el resto se muestran como "Próximamente".
 */
export interface Channel {
  id: string;
  label: string;
  enabled: boolean;
}

export const CHANNELS: Channel[] = [
  { id: 'web-varela', label: 'Web Varela', enabled: true },
  { id: 'mercadolibre', label: 'Mercado Libre', enabled: true },
  { id: 'zonaprop', label: 'Zonaprop', enabled: false },
  { id: 'argenprop', label: 'Argenprop', enabled: false },
  { id: 'instagram', label: 'Instagram', enabled: false },
  { id: 'facebook', label: 'Facebook', enabled: false },
];

export type PublicationStatus = 'none' | 'published' | 'pending' | 'error' | 'syncing';

export const STATUS_META: Record<PublicationStatus, { label: string; dot: string }> = {
  none: { label: 'Nunca publicada', dot: 'none' },
  published: { label: 'Publicada', dot: 'published' },
  pending: { label: 'Pendiente de actualizar', dot: 'pending' },
  error: { label: 'Error', dot: 'error' },
  syncing: { label: 'Sincronizando', dot: 'syncing' },
};

export const relativeTime = (iso?: string | null): string => {
  if (!iso) return 'Sin publicar';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Hace instantes';
  if (min < 60) return `Hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days === 1 ? '' : 's'}`;
};
