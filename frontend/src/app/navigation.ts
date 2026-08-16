import { createElement, type ReactNode } from 'react';
import { Sun, Bot, Building2, Users, GitBranch, FileText, Clapperboard, Blocks, Activity, UserCog, Calculator, Palmtree, Wallet, PiggyBank } from 'lucide-react';
import { featureFlags } from '@vera/config';

export interface NavRoute {
  id: string;
  label: string;
  path: string;
  icon: ReactNode;
  enabled: boolean;
}

/** Navigation is derived from feature flags — flipping a flag enables an App.
 * Vera Bot is the system's primary messaging App — same hierarchy as Propiedades. */
export const navRoutes: NavRoute[] = [
  {
    id: 'hoy',
    label: 'Hoy',
    path: '/hoy',
    icon: createElement(Sun, { size: 18 }),
    enabled: featureFlags.hoy,
  },
  {
    id: 'vera-bot',
    label: 'Vera Bot',
    path: '/vera-bot',
    icon: createElement(Bot, { size: 18 }),
    enabled: featureFlags.veraBot,
  },
  {
    id: 'propiedades',
    label: 'Propiedades',
    path: '/propiedades',
    icon: createElement(Building2, { size: 18 }),
    enabled: featureFlags.propiedades,
  },
  {
    id: 'personas',
    label: 'Personas',
    path: '/personas',
    icon: createElement(Users, { size: 18 }),
    enabled: featureFlags.personas,
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    path: '/operaciones',
    icon: createElement(GitBranch, { size: 18 }),
    enabled: featureFlags.operaciones,
  },
  {
    id: 'documentos',
    label: 'Documentos',
    path: '/documentos',
    icon: createElement(FileText, { size: 18 }),
    enabled: featureFlags.documentos,
  },
  {
    id: 'tasaciones',
    label: 'Tasaciones',
    path: '/tasaciones',
    icon: createElement(Calculator, { size: 18 }),
    enabled: true,
  },
  {
    id: 'alquileres',
    label: 'Alquileres',
    path: '/alquileres',
    icon: createElement(Palmtree, { size: 18 }),
    enabled: featureFlags.alquileres,
  },
  {
    id: 'liquidaciones',
    label: 'Liquidaciones',
    path: '/liquidaciones',
    icon: createElement(Wallet, { size: 18 }),
    enabled: featureFlags.alquileres,
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    path: '/contabilidad',
    icon: createElement(PiggyBank, { size: 18 }),
    enabled: true,
  },
  {
    id: 'studio',
    label: 'Studio',
    path: '/studio',
    icon: createElement(Clapperboard, { size: 18 }),
    enabled: featureFlags.studio,
  },
  {
    id: 'integraciones',
    label: 'Integraciones',
    path: '/integraciones',
    icon: createElement(Blocks, { size: 18 }),
    enabled: featureFlags.integraciones,
  },
  {
    id: 'event-log',
    label: 'Event Log',
    path: '/eventos',
    icon: createElement(Activity, { size: 18 }),
    enabled: featureFlags.eventLog,
  },
  {
    id: 'equipo',
    label: 'Equipo',
    path: '/equipo',
    icon: createElement(UserCog, { size: 18 }),
    enabled: true,
  },
];
