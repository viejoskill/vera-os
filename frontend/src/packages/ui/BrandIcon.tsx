import { useEffect, useState, type ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { brandSrc, brandColor } from '@vera/config';

export interface BrandIconProps {
  /** Clave del BrandRegistry (p.ej. "gmail"). Si falta o el PNG no existe, usa el fallback. */
  brand?: string;
  /** Ícono vectorial de fallback (lucide) mientras no exista el PNG oficial. */
  fallback: LucideIcon;
  size?: number;
  alt?: string;
  /**
   * Tratamiento monocromático (blanco) cuando la marca NO tiene color definido.
   * Si la marca tiene color oficial (BrandColors), se pinta con ese color.
   * Pasar `mono={false}` para respetar un PNG a todo color en el futuro.
   */
  mono?: boolean;
}

/** BrandIcon — muestra el logo oficial (`/brands/{brand}.png`):
 * - Con color de marca definido → silueta teñida con ese color (máscara).
 * - Sin color → silueta blanca (mono) sobre tema oscuro.
 * - Si el PNG no existe/falla → ícono vectorial de fallback. */
export const BrandIcon = ({ brand, fallback: Fallback, size = 20, alt = '', mono = true }: BrandIconProps): ReactElement => {
  const src = brandSrc(brand);
  const color = mono ? brandColor(brand) : undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) return <Fallback size={size} aria-hidden={!alt} />;

  if (color) {
    return (
      <>
        <span
          className="vera-brand-icon vera-brand-icon--tint"
          role="img"
          aria-label={alt || undefined}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            WebkitMaskImage: `url("${src}")`,
            maskImage: `url("${src}")`,
          }}
        />
        <img src={src} alt="" aria-hidden="true" onError={() => setFailed(true)} style={{ display: 'none' }} />
      </>
    );
  }

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
