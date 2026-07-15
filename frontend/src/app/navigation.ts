import { createElement, type ReactNode } from 'react';
import { Sun, Building2, GitBranch, Clapperboard } from 'lucide-react';
import { featureFlags } from '@vera/config';

export interface NavRoute {
  id: string;
  label: string;
  path: string;
  icon: ReactNode;
  enabled: boolean;
}

/** Navigation is derived from feature flags — flipping a flag enables an App. */
export const navRoutes: NavRoute[] = [
  {
    id: 'hoy',
    label: 'Hoy',
    path: '/hoy',
    icon: createElement(Sun, { size: 18 }),
    enabled: featureFlags.hoy,
  },
  {
    id: 'propiedades',
    label: 'Propiedades',
    path: '/propiedades',
    icon: createElement(Building2, { size: 18 }),
    enabled: featureFlags.propiedades,
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
];
