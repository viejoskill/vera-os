import {
  Mail,
  Sparkles,
  Instagram,
  HardDrive,
  MessageCircle,
  Music,
  Store,
  type LucideIcon,
} from 'lucide-react';

/** VERA Dock — HERRAMIENTAS PERSONALES del profesional (no módulos de VERA).
 * Cada herramienta abre su web real en una pestaña nueva. `brand` resuelve el
 * logo oficial vía BrandRegistry (`/brands/{brand}.png`); `icon` es el fallback
 * vectorial mientras no exista el PNG oficial.
 * Clasificación de arquitectura: DOCK (no App, no Widget, no Integración). */
export interface DockTool {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  brand: string;
}

export const APPS: DockTool[] = [
  { id: 'gmail', label: 'Gmail', icon: Mail, href: 'https://mail.google.com', brand: 'gmail' },
  { id: 'ia', label: 'IA', icon: Sparkles, href: 'https://chatgpt.com', brand: 'openai' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, href: 'https://instagram.com', brand: 'instagram' },
  { id: 'mercadolibre', label: 'Mercado Libre', icon: Store, href: 'https://www.mercadolibre.com.ar', brand: 'mercadolibre' },
  { id: 'drive', label: 'Drive', icon: HardDrive, href: 'https://drive.google.com', brand: 'drive' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: 'https://web.whatsapp.com', brand: 'whatsapp' },
  { id: 'spotify', label: 'Spotify', icon: Music, href: 'https://open.spotify.com', brand: 'spotify' },
];

export const appById = (id: string): DockTool | undefined => APPS.find((a) => a.id === id);
