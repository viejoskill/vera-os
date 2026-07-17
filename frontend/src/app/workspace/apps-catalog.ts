import {
  Mail,
  Sparkles,
  Instagram,
  Calendar,
  HardDrive,
  MessageCircle,
  Music,
  type LucideIcon,
} from 'lucide-react';

/** VERA Dock — HERRAMIENTAS PERSONALES del profesional (no módulos de VERA).
 * Cada herramienta abre su web real en una pestaña nueva. El Dock pertenece al
 * usuario; sumar una herramienta = agregar una entrada.
 * Clasificación de arquitectura: DOCK (no App, no Widget, no Integración). */
export interface DockTool {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export const APPS: DockTool[] = [
  { id: 'gmail', label: 'Gmail', icon: Mail, href: 'https://mail.google.com' },
  { id: 'ia', label: 'IA', icon: Sparkles, href: 'https://chatgpt.com' },
  { id: 'instagram', label: 'Instagram', icon: Instagram, href: 'https://instagram.com' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, href: 'https://calendar.google.com' },
  { id: 'drive', label: 'Drive', icon: HardDrive, href: 'https://drive.google.com' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: 'https://web.whatsapp.com' },
  { id: 'spotify', label: 'Spotify', icon: Music, href: 'https://open.spotify.com' },
];

export const appById = (id: string): DockTool | undefined => APPS.find((a) => a.id === id);
