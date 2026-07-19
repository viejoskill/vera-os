import type { LucideIcon } from 'lucide-react';

/** Categorías del Centro de Integraciones (agrupan las tarjetas). */
export type IntegrationCategory =
  | 'mensajeria'
  | 'correo'
  | 'almacenamiento'
  | 'ia'
  | 'publicacion'
  | 'presencia';

/** Cómo se determina el estado de salud de la integración. */
export type HealthMode = 'real' | 'none';

export interface Integration {
  /** Id estable (clave de estado local y de health-check). */
  key: string;
  name: string;
  /** Clave de BrandRegistry para el logo oficial. */
  brand?: string;
  /** true = el logo es un ícono a todo color (no se tiñe ni se blanquea). */
  brandFullColor?: boolean;
  /** Ícono vectorial de fallback. */
  icon: LucideIcon;
  category: IntegrationCategory;
  description: string;
  /** Destino a abrir al Configurar (web propia del servicio). */
  url?: string;
  /** 'real' → chequeo de alcance vía backend; 'none' → sin health por ahora. */
  healthMode: HealthMode;
  /** Estado inicial de conexión (Arturito viene conectado por defecto). */
  defaultConnected?: boolean;
}

/** Respuesta del backend `/api/integrations/{key}/health`. */
export interface IntegrationHealth {
  provider: string;
  status: 'operational' | 'degraded' | 'down';
  http_status: number | null;
  latency_ms: number;
  checked_at: string;
}

/** Estado local (simulado, persistido) de una integración. */
export interface IntegrationState {
  connected: boolean;
  lastSyncAt: string | null;
}
