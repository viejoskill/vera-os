import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Select } from '@vera/ui';
import { PROPERTY_TYPE_OPTIONS } from './property-workspace/form-schema';
import { AMENITY_CATEGORIES } from './property-workspace/amenities-catalog';

export interface AdvFilters {
  type: string;
  operation: string;
  minPrice: string;
  maxPrice: string;
  minBedrooms: string;
  amenities: string[];
}

export const emptyFilters: AdvFilters = {
  type: '',
  operation: '',
  minPrice: '',
  maxPrice: '',
  minBedrooms: '',
  amenities: [],
};

export const countActiveFilters = (f: AdvFilters): number =>
  (f.type ? 1 : 0) +
  (f.operation ? 1 : 0) +
  (f.minPrice ? 1 : 0) +
  (f.maxPrice ? 1 : 0) +
  (f.minBedrooms ? 1 : 0) +
  f.amenities.length;

const TYPE_OPTS = [{ value: '', label: 'Todos los tipos' }, ...PROPERTY_TYPE_OPTIONS];
const OPERATION_OPTS = [
  { value: '', label: 'Venta y alquiler' },
  { value: 'venta', label: 'Venta' },
  { value: 'alquiler', label: 'Alquiler' },
];
const BEDROOM_OPTS = [
  { value: '', label: 'Cualquiera' },
  { value: '1', label: '1+ dorm.' },
  { value: '2', label: '2+ dorm.' },
  { value: '3', label: '3+ dorm.' },
  { value: '4', label: '4+ dorm.' },
];

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const ALL_AMENITIES = AMENITY_CATEGORIES.flatMap((c) => c.items);

export const PropertyFilters = ({
  filters,
  onChange,
  onClear,
}: {
  filters: AdvFilters;
  onChange: (f: AdvFilters) => void;
  onClear: () => void;
}) => {
  const [amenityQuery, setAmenityQuery] = useState('');
  const set = (patch: Partial<AdvFilters>) => onChange({ ...filters, ...patch });

  const toggleAmenity = (key: string) => {
    const next = filters.amenities.includes(key)
      ? filters.amenities.filter((a) => a !== key)
      : [...filters.amenities, key];
    set({ amenities: next });
  };

  const q = normalize(amenityQuery.trim());
  const amenityList = useMemo(
    () => (q ? ALL_AMENITIES.filter((a) => normalize(a.label).includes(q)) : ALL_AMENITIES),
    [q],
  );
  const active = countActiveFilters(filters);

  return (
    <div className="vera-filters" data-testid="property-filters">
      <div className="vera-filters__row">
        <Select label="Tipo" options={TYPE_OPTS} data-testid="filter-type" value={filters.type} onChange={(e) => set({ type: e.target.value })} />
        <Select label="Operación" options={OPERATION_OPTS} data-testid="filter-operation" value={filters.operation} onChange={(e) => set({ operation: e.target.value })} />
        <Select label="Dormitorios" options={BEDROOM_OPTS} data-testid="filter-bedrooms" value={filters.minBedrooms} onChange={(e) => set({ minBedrooms: e.target.value })} />
        <Input label="Precio mín." inputMode="numeric" placeholder="0" data-testid="filter-min-price" value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value.replace(/\D/g, '') })} />
        <Input label="Precio máx." inputMode="numeric" placeholder="Sin límite" data-testid="filter-max-price" value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value.replace(/\D/g, '') })} />
      </div>

      <div className="vera-field">
        <span className="vera-field__label">Amenities</span>
        <div className="vera-filters__amenity-search">
          <Search size={15} />
          <input
            type="text"
            className="vera-amenities__search-input"
            placeholder="Buscar amenity…"
            data-testid="filter-amenity-search"
            value={amenityQuery}
            onChange={(e) => setAmenityQuery(e.target.value)}
          />
        </div>
        <div className="vera-filters__amenities">
          {amenityList.map((a) => {
            const on = filters.amenities.includes(a.key);
            return (
              <button
                key={a.key}
                type="button"
                className={`vera-chip ${on ? 'vera-chip--active' : ''}`.trim()}
                data-testid={`filter-amenity-${a.key}`}
                aria-pressed={on}
                onClick={() => toggleAmenity(a.key)}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {active > 0 && (
        <button type="button" className="vera-ai-action" data-testid="clear-filters" onClick={onClear}>
          <X size={13} /> Limpiar filtros ({active})
        </button>
      )}
    </div>
  );
};
