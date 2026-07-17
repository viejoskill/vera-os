import {
  Building2,
  Briefcase,
  Users,
  Camera,
  Bot,
  Sparkles,
  Mail,
  type LucideIcon,
} from 'lucide-react';

/** VERA Workspace apps. `ready` marks apps already usable; the rest are Workspace
 * tools that will connect in later sprints (integrations phase). Escalable: sumar
 * una app es agregar una entrada. */
export interface WorkspaceApp {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  ready: boolean;
}

export const APPS: WorkspaceApp[] = [
  { id: 'propiedades', label: 'Propiedades', icon: Building2, route: '/propiedades', ready: true },
  { id: 'operaciones', label: 'Operaciones', icon: Briefcase, route: '/operaciones', ready: false },
  { id: 'personas', label: 'Personas', icon: Users, route: '/personas', ready: false },
  { id: 'studio', label: 'Studio', icon: Camera, ready: false },
  { id: 'vera-bot', label: 'Vera Bot', icon: Bot, ready: false },
  { id: 'ia', label: 'IA', icon: Sparkles, ready: false },
  { id: 'gmail', label: 'Gmail', icon: Mail, ready: false },
];

export const appById = (id: string): WorkspaceApp | undefined => APPS.find((a) => a.id === id);
