import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export interface VariacionItem { label: string; variacion: number | null; }

/** Fila compacta con la variación de ocupación de cada mes vs. el mismo mes del año anterior. */
export const VariacionRow = ({ items, anio }: { items: VariacionItem[]; anio: number }) => (
  <div className="rt-ocup__variacion" data-testid="rt-ocup-variacion-row">
    <span className="rt-ocup__variacion-caption">vs. {anio - 1}:</span>
    {items.map((it, i) => (
      <div key={i} className="rt-ocup__variacion-item" data-testid={`rt-ocup-variacion-${i}`}>
        <span className="rt-ocup__variacion-mes">{it.label}</span>
        {it.variacion == null ? (
          <span className="rt-ocup__variacion-val rt-ocup__variacion-val--na"><Minus size={10} /> s/d</span>
        ) : it.variacion > 0 ? (
          <span className="rt-ocup__variacion-val rt-ocup__variacion-val--up"><ArrowUp size={10} /> {it.variacion.toFixed(1)}pts</span>
        ) : it.variacion < 0 ? (
          <span className="rt-ocup__variacion-val rt-ocup__variacion-val--down"><ArrowDown size={10} /> {Math.abs(it.variacion).toFixed(1)}pts</span>
        ) : (
          <span className="rt-ocup__variacion-val">0.0pts</span>
        )}
      </div>
    ))}
  </div>
);

export default VariacionRow;
