/**
 * WorkspaceConfig — fuente ÚNICA de la identidad del Workspace.
 * Toda la interfaz consume esta configuración: nunca hardcodear nombre, tagline,
 * logos ni acento. Cambiar de vertical (Real Estate → Legal, Water, Health…) es
 * cambiar SOLO este objeto, sin tocar el código de la UI.
 */
import logoHorizontal from '../../assets/brand/logo-horizontal.png';
import symbol from '../../assets/brand/vera-symbol.png';

export type WorkspaceTheme = 'dark' | 'light';

export interface WorkspaceConfig {
  name: string;
  logo: string;
  symbol: string;
  tagline: string;
  theme: WorkspaceTheme;
  accent: string;
}

export const workspaceConfig: WorkspaceConfig = {
  name: 'VERA OS',
  logo: logoHorizontal,
  symbol,
  tagline: 'REAL ESTATE INTELLIGENCE',
  theme: 'dark',
  accent: '#F6E63A',
};
