import { useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Search, Check } from 'lucide-react';
import { AMENITY_CATEGORIES } from './amenities-catalog';
import type { PropertyFormValues } from './form-schema';

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Amenities (ATRIBUTOS) por categoría, con buscador en tiempo real. Se guardan
 * como lista plana de claves canónicas. Concepto distinto de las características
 * objetivas. VERA propone: acá el profesional marca lo que corresponde.
 */
export const AmenitiesSection = () => {
  const { watch, setValue } = useFormContext<PropertyFormValues>();
  const selected = watch('amenities');
  const [term, setTerm] = useState('');

  const toggle = (key: string) => {
    const next = selected.includes(key)
      ? selected.filter((a) => a !== key)
      : [...selected, key];
    setValue('amenities', next, { shouldDirty: true });
  };

  const q = normalize(term.trim());
  const categories = useMemo(
    () =>
      AMENITY_CATEGORIES.map((cat) => ({
        ...cat,
        items: q ? cat.items.filter((i) => normalize(i.label).includes(q)) : cat.items,
      })).filter((cat) => cat.items.length > 0),
    [q],
  );

  return (
    <div className="vera-amenities">
      <div className="vera-amenities__search">
        <Search size={16} />
        <input
          type="text"
          className="vera-amenities__search-input"
          placeholder="Buscar característica…"
          data-testid="amenities-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        {selected.length > 0 && (
          <span className="vera-amenities__count" data-testid="amenities-count">
            {selected.length} seleccionada{selected.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="vera-muted" data-testid="amenities-empty">
          No encontramos características con “{term}”.
        </p>
      ) : (
        categories.map((cat) => (
          <div key={cat.id} className="vera-amenities__category" data-testid={`amenities-cat-${cat.id}`}>
            <h4 className="vera-amenities__title">{cat.title}</h4>
            <div className="vera-amenities__grid">
              {cat.items.map((item) => {
                const active = selected.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`vera-amenity ${active ? 'vera-amenity--active' : ''}`.trim()}
                    data-testid={`amenity-${item.key}`}
                    aria-pressed={active}
                    onClick={() => toggle(item.key)}
                  >
                    <span className="vera-amenity__box">{active && <Check size={13} />}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
