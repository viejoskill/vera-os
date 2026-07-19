import { createElement, type ReactNode } from 'react';
import { Sun, Bot, Building2, Users, GitBranch, Clapperboard, Blocks } from 'lucide-react';
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
];
