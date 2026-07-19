import {
  Mail,
  Sparkles,
  Bot,
  Stars,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  Music,
  HardDrive,
  Cloud,
  Store,
  Palette,
  type LucideIcon,
} from 'lucide-react';

/** VERA Dock — HERRAMIENTAS PERSONALES del profesional (no módulos de VERA).
 * Cada herramienta abre su web real en una pestaña nueva. `brand` resuelve el
 * logo oficial vía BrandRegistry (`/brands/{brand}.png`) y su color; `icon` es
 * el fallback vectorial mientras no exista el PNG oficial.
 * Clasificación de arquitectura: DOCK (no App, no Widget, no Integración). */
export interface DockTool {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  brand: string;
  /** true = el PNG es un ícono a todo color (no se tiñe ni se blanquea). */
  fullColor?: boolean;
}

export const APPS: DockTool[] = [
  { id: 'arturito', label: 'Arturito', icon: Bot, href: 'https://app.arturito.ai', brand: 'arturito', fullColor: true },
  { id: 'gmail', label: 'Gmail', icon: Mail, href: 'https://mail.google.com', brand: 'gmail' },
  { id: 'ia', label: 'IA', icon: Sparkles, href: 'https://chatgpt.com', brand: 'openai' },
  { id: 'claude', label: 'Claude', icon: Bot, href: 'https://claude.ai', brand: 'claude' },
  { id: 'gemini', label: 'Gemini', icon: Stars, href: 'https://gemini.google.com', brand: 'gemini' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, href: 'https://instagram.com', brand: 'instagram' },
  { id: 'meta', label: 'Meta', icon: Facebook, href: 'https://business.facebook.com', brand: 'meta' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, href: 'https://youtube.com', brand: 'youtube' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: 'https://web.whatsapp.com', brand: 'whatsapp' },
  { id: 'spotify', label: 'Spotify', icon: Music, href: 'https://open.spotify.com', brand: 'spotify' },
  { id: 'drive', label: 'Drive', icon: HardDrive, href: 'https://drive.google.com', brand: 'drive' },
  { id: 'dropbox', label: 'Dropbox', icon: Cloud, href: 'https://www.dropbox.com', brand: 'dropbox' },
  { id: 'mercadolibre', label: 'Mercado Libre', icon: Store, href: 'https://www.mercadolibre.com.ar', brand: 'mercadolibre' },
  { id: 'canva', label: 'Canva', icon: Palette, href: 'https://www.canva.com', brand: 'canva', fullColor: true },
];

export const appById = (id: string): DockTool | undefined => APPS.find((a) => a.id === id);
