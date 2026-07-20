import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  Search,
  Plus,
  Building2,
  MoreHorizontal,
  FolderOpen,
  Copy,
  Archive,
  RotateCcw,
  SlidersHorizontal,
  DownloadCloud,
} from 'lucide-react';
import { Card, Input, Button } from '@vera/ui';
import { appConfig } from '@vera/config';
import { propertyService } from '@vera/services';
import type { Property, PropertyStatus } from '@vera/types';
import { useProperties } from '@app/hooks/useProperties';
import { PropertyFilters, emptyFilters, countActiveFilters, type AdvFilters } from './PropertyFilters';
import { LegacyImportModal } from './LegacyImportModal';

type StatusFilter = PropertyStatus | 'all' | 'archived';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'active', label: 'Activas' },
  { id: 'reserved', label: 'Reservadas' },
  { id: 'sold', label: 'Vendidas' },
  { id: 'archived', label: 'Archivadas' },
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

/** Address as the primary identifier. No empty separators; city-only if no address. */
function locationLine(p: Property): string {
  if (p.address) return [p.address, p.city, p.neighborhood].filter(Boolean).join(' · ');
  return p.city || '';
}

interface CardActions {
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDuplicate: (id: string) => void;
}

const PropertyCard = ({ property, actions }: { property: Property; actions: CardActions }) => {
  const meta = STATUS_META[property.status];
  const [imgFailed, setImgFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showImage = property.coverImage && !imgFailed;

  const runAction = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    fn();
  };

  return (
    <Card
      interactive
      className="vera-prop"
      data-testid={`property-card-${property.id}`}
      onClick={() => actions.onOpen(property.id)}
    >
      <div className="vera-prop__media">
        {showImage ? (
          <img src={property.coverImage} alt={property.title} loading="lazy" onError={() => setImgFailed(true)} />
        ) : (
          <div className="vera-prop__media-empty" data-testid={`property-noimage-${property.id}`}>
            <Building2 size={28} />
          </div>
        )}
        <span className={`vera-badge ${meta.className}`}>{meta.label}</span>

        <div className="vera-prop__menu">
          <button
            type="button"
            className="vera-prop__menu-btn"
            aria-label="Acciones"
            data-testid={`card-menu-${property.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="vera-menu" data-testid={`card-menu-list-${property.id}`}>
              <button type="button" className="vera-menu__item" data-testid={`menu-open-${property.id}`} onClick={runAction(() => actions.onOpen(property.id))}>
                <FolderOpen size={14} /> Abrir
              </button>
              <button type="button" className="vera-menu__item" data-testid={`menu-duplicate-${property.id}`} onClick={runAction(() => actions.onDuplicate(property.id))}>
                <Copy size={14} /> Duplicar
              </button>
              {property.archived ? (
                <button type="button" className="vera-menu__item" data-testid={`menu-restore-${property.id}`} onClick={runAction(() => actions.onRestore(property.id))}>
                  <RotateCcw size={14} /> Restaurar
                </button>
              ) : (
                <button type="button" className="vera-menu__item" data-testid={`menu-archive-${property.id}`} onClick={runAction(() => actions.onArchive(property.id))}>
                  <Archive size={14} /> Archivar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="vera-prop__body">
        <div className="vera-prop__toprow">
          <span className="vera-prop__price">{formatPrice(property)}</span>
          {property.code && (
            <span className="vera-prop__code" data-testid={`property-code-${property.id}`}>
              {property.code}
            </span>
          )}
        </div>
        <h3 className="vera-prop__title">{property.title}</h3>
        {locationLine(property) && (
          <div className="vera-prop__location">
            <MapPin size={14} />
            <span>{locationLine(property)}</span>
          </div>
        )}
        {(property.bedrooms > 0 || property.bathrooms > 0 || property.areaM2 > 0) && (
          <div className="vera-prop__specs">
            {property.bedrooms > 0 && (
              <span>
                <Bed size={15} /> {property.bedrooms}
              </span>
            )}
            {property.bathrooms > 0 && (
              <span>
                <Bath size={15} /> {property.bathrooms}
              </span>
            )}
            {property.areaM2 > 0 && (
              <span>
                <Maximize size={15} /> {property.areaM2} m²
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export const PropertiesScreen = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState<AdvFilters>(emptyFilters);

  // Fetch once per status (cached); text search filters instantly on the client.
  const { data: properties, isLoading } = useProperties({ status });

  const q = query.trim().toLowerCase();
  const activeFilters = countActiveFilters(filters);
  const visible = useMemo(() => {
    if (!properties) return [];
    const min = filters.minPrice ? Number(filters.minPrice) : null;
    const max = filters.maxPrice ? Number(filters.maxPrice) : null;
    const minBeds = filters.minBedrooms ? Number(filters.minBedrooms) : null;
    return properties.filter((p) => {
      if (q && !`${p.title} ${p.neighborhood} ${p.city} ${p.address}`.toLowerCase().includes(q)) return false;
      if (filters.type && p.type !== filters.type) return false;
      if (filters.operation && p.operation !== filters.operation) return false;
      if (min !== null && p.price < min) return false;
      if (max !== null && p.price > max) return false;
      if (minBeds !== null && (p.bedrooms ?? 0) < minBeds) return false;
      if (filters.amenities.length) {
        const has = p.amenities ?? [];
        if (!filters.amenities.every((a) => has.includes(a))) return false;
      }
      return true;
    });
  }, [properties, q, filters]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['properties'] });

  const actions: CardActions = {
    onOpen: (id) => navigate(`/propiedades/${id}`),
    onArchive: async (id) => {
      await propertyService.archive(id);
      invalidate();
    },
    onRestore: async (id) => {
      await propertyService.restore(id);
      invalidate();
    },
    onDuplicate: async (id) => {
      const created = await propertyService.duplicate(id);
      invalidate();
      if (created) navigate(`/propiedades/${created.id}`);
    },
  };

  return (
    <div className="vera-screen">
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
        <Button size="md" variant="ghost" data-testid="import-legacy-button" onClick={() => setShowImport(true)}>
          <DownloadCloud size={16} /> Importar desde CRM Varela
        </Button>
        <Button size="md" data-testid="new-property-button" onClick={() => navigate('/propiedades/nueva')}>
          <Plus size={16} /> Nueva propiedad
        </Button>
      </div>

      <div className="vera-toolbar__secondary">
        <Button
          size="sm"
          variant={showFilters || activeFilters > 0 ? 'primary' : 'ghost'}
          data-testid="toggle-filters"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={15} /> Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
        </Button>
      </div>

      {showFilters && (
        <PropertyFilters filters={filters} onChange={setFilters} onClear={() => setFilters(emptyFilters)} />
      )}

      {isLoading ? (
        <p className="vera-muted">Cargando propiedades…</p>
      ) : visible.length > 0 ? (
        <div className="vera-properties-grid">
          {visible.map((p) => (
            <PropertyCard key={p.id} property={p} actions={actions} />
          ))}
        </div>
      ) : q ? (
        <p className="vera-muted" data-testid="properties-empty">
          No encontramos propiedades para “{query}”.
        </p>
      ) : activeFilters > 0 ? (
        <p className="vera-muted" data-testid="properties-empty">
          Ninguna propiedad coincide con los filtros aplicados.
        </p>
      ) : status === 'archived' ? (
        <p className="vera-muted" data-testid="properties-empty">
          No hay propiedades archivadas.
        </p>
      ) : (
        <div className="vera-empty" data-testid="properties-empty">
          <span className="vera-empty__icon">
            <Building2 size={26} />
          </span>
          <p className="vera-empty__title">Todavía no cargaste ninguna propiedad.</p>
          <p className="vera-muted">Empecemos por la primera. Es rápido.</p>
          <Button size="md" data-testid="empty-new-property" onClick={() => navigate('/propiedades/nueva')}>
            <Plus size={16} /> Cargar mi primera propiedad
          </Button>
        </div>
      )}

      <LegacyImportModal open={showImport} onClose={() => setShowImport(false)} onDone={() => invalidate()} />
    </div>
  );
};
