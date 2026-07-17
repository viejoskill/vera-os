import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { brandSrc } from '@vera/config';

export interface BrandIconProps {
  /** Clave del BrandRegistry (p.ej. "gmail"). Si falta o el PNG no existe, usa el fallback. */
  brand?: string;
  /** Ícono vectorial de fallback (lucide) mientras no exista el PNG oficial. */
  fallback: LucideIcon;
  size?: number;
  alt?: string;
  /**
   * Tratamiento monocromático: pinta el glifo (silueta) en blanco para que se
   * lea nítido sobre tema oscuro. Default true (set de íconos mono actual).
   * Pasar `mono={false}` para logos a todo color en el futuro.
   */
  mono?: boolean;
}

/** BrandIcon — muestra el logo oficial (`/brands/{brand}.png`) si existe;
 * si no, cae automáticamente al ícono vectorial. Cuando se suban los PNG
 * oficiales, el cambio es automático (sin tocar Dock ni pantallas). */
export const BrandIcon = ({ brand, fallback: Fallback, size = 20, alt = '', mono = true }: BrandIconProps) => {
  const src = brandSrc(brand);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <Fallback size={size} aria-hidden={!alt} />;

  return (
    <img
      className={`vera-brand-icon ${mono ? 'vera-brand-icon--mono' : ''}`.trim()}
      src={src}
      width={size}
      height={size}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
};
