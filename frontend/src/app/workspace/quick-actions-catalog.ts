import {
  Globe,
  Bot,
  Mail,
  Cloud,
  Plus,
  Clapperboard,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/** Una Acción Rápida es una ACCIÓN (no un acceso a app): empezar a trabajar
 * apenas abrís VERA. Puede navegar dentro de VERA, abrir una integración
 * (consumiendo su URL desde Integraciones) o abrir el Sitio Web principal. */
export type QuickActionKind = 'site' | 'integration' | 'route';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  kind: QuickActionKind;
  /** Para 'integration': clave en el catálogo de Integraciones (fuente de la URL). */
  integrationKey?: string;
  /** Para 'route': ruta interna de VERA. */
  route?: string;
  defaultPinned?: boolean;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'sitio-web', label: 'Abrir Sitio Web', icon: Globe, kind: 'site', defaultPinned: true },
  { id: 'arturito', label: 'Arturito', icon: Bot, kind: 'integration', integrationKey: 'arturito', defaultPinned: true },
  { id: 'gmail', label: 'Gmail', icon: Mail, kind: 'integration', integrationKey: 'gmail', defaultPinned: true },
  { id: 'dropbox', label: 'Dropbox', icon: Cloud, kind: 'integration', integrationKey: 'dropbox', defaultPinned: true },
  { id: 'nueva-propiedad', label: 'Nueva Propiedad', icon: Plus, kind: 'route', route: '/propiedades/nueva', defaultPinned: true },
  { id: 'studio', label: 'Studio', icon: Clapperboard, kind: 'route', route: '/studio', defaultPinned: true },
  { id: 'responder-whatsapp', label: 'Responder WhatsApp', icon: MessageCircle, kind: 'integration', integrationKey: 'whatsapp' },
  { id: 'generar-publicacion', label: 'Generar publicación', icon: Sparkles, kind: 'route', route: '/studio' },
];

export const quickActionById = (id: string): QuickAction | undefined =>
  QUICK_ACTIONS.find((a) => a.id === id);
