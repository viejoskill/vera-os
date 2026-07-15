import { useState } from 'react';
import { Bed, Bath, Maximize, MapPin, Sparkles, Search } from 'lucide-react';
import { Card, Input, Button } from '@vera/ui';
import { appConfig } from '@vera/config';
import type { Property, PropertyStatus } from '@vera/types';
import { useProperties } from '@app/hooks/useProperties';
import { useDailyBriefing } from '@app/hooks/useDailyBriefing';

type StatusFilter = PropertyStatus | 'all';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'reserved', label: 'Reservadas' },
  { id: 'sold', label: 'Vendidas' },
];

const STATUS_META: Record<PropertyStatus, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'vera-badge--active' },
  reserved: { label: 'Reservada', className: 'vera-badge--reserved' },
  sold: { label: 'Vendida', className: 'vera-badge--sold' },
};

function formatPrice(property: Property): string {
  const symbol = property.currency === 'USD' ? 'US$' : '$';
  const amount = new Intl.NumberFormat(appConfig.locale).format(property.price);
  return `${symbol} ${amount}${property.operation === 'alquiler' ? ' /mes' : ''}`;
}

const PropertyCard = ({ property }: { property: Property }) => {
  const meta = STATUS_META[property.status];
  return (
    <Card interactive className="vera-prop" data-testid={`property-card-${property.id}`}>
      <div className="vera-prop__media">
        <img src={property.coverImage} alt={property.title} loading="lazy" />
        <span className={`vera-badge ${meta.className}`}>{meta.label}</span>
      </div>
      <div className="vera-prop__body">
        <span className="vera-prop__price">{formatPrice(property)}</span>
        <h3 className="vera-prop__title">{property.title}</h3>
        <div className="vera-prop__location">
          <MapPin size={14} />
          <span>
            {property.neighborhood}, {property.city}
          </span>
        </div>
        <div className="vera-prop__specs">
          {property.bedrooms > 0 && (
            <span>
              <Bed size={15} /> {property.bedrooms}
            </span>
          )}
          <span>
            <Bath size={15} /> {property.bathrooms}
          </span>
          <span>
            <Maximize size={15} /> {property.areaM2} m²
          </span>
        </div>
      </div>
    </Card>
  );
};

export const PropertiesScreen = () => {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const briefing = useDailyBriefing();
  const { data: properties, isLoading } = useProperties({ status, query });

  return (
    <div className="vera-screen">
      <Card className="vera-briefing">
        <span className="vera-briefing__icon">
          <Sparkles size={18} />
        </span>
        <div className="vera-briefing__content">
          <div className="vera-briefing__label">
            VERA AI
            <span className="vera-briefing__mock">demo</span>
          </div>
          <p className="vera-briefing__text">
            {briefing.isLoading ? 'Generando resumen del día…' : briefing.data}
          </p>
        </div>
      </Card>

      <div className="vera-toolbar">
        <div className="vera-toolbar__search">
          <Search size={16} className="vera-toolbar__search-icon" />
          <Input
            placeholder="Buscar por título, barrio o dirección…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar propiedades"
            data-testid="property-search-input"
          />
        </div>
        <div className="vera-toolbar__filters">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              data-testid={`filter-${f.id}`}
              variant={status === f.id ? 'primary' : 'ghost'}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="vera-muted">Cargando propiedades…</p>
      ) : properties && properties.length > 0 ? (
        <div className="vera-properties-grid">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <p className="vera-muted">No hay propiedades para este filtro.</p>
      )}
    </div>
  );
};
