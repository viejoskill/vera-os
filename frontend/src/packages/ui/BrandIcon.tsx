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
}

/** BrandIcon — muestra el logo oficial (`/brands/{brand}.png`) si existe;
 * si no, cae automáticamente al ícono vectorial. Cuando se suban los PNG
 * oficiales, el cambio es automático (sin tocar Dock ni pantallas). */
export const BrandIcon = ({ brand, fallback: Fallback, size = 20, alt = '' }: BrandIconProps) => {
  const src = brandSrc(brand);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <Fallback size={size} aria-hidden={!alt} />;

  return (
    <img
      className="vera-brand-icon"
      src={src}
      width={size}
      height={size}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
};
