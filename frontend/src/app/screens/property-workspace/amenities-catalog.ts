/**
 * Catálogo canónico de amenities (atributos de la propiedad).
 * Fuente ÚNICA de verdad: las claves (`key`) son las que se persisten en la
 * columna `amenities` (jsonb); las categorías y `label` son solo presentación.
 * Reutilizable por IA, filtros, búsquedas, portales, tasaciones y estadísticas.
 */
export interface AmenityItem {
  key: string;
  label: string;
}

export interface AmenityCategory {
  id: string;
  title: string;
  items: AmenityItem[];
}

export const AMENITY_CATEGORIES: AmenityCategory[] = [
  {
    id: 'servicios',
    title: 'Servicios',
    items: [
      { key: 'agua-corriente', label: 'Agua corriente' },
      { key: 'electricidad', label: 'Electricidad' },
      { key: 'gas-natural', label: 'Gas natural' },
      { key: 'gas-envasado', label: 'Gas envasado' },
      { key: 'cloacas', label: 'Cloacas' },
      { key: 'internet-fibra', label: 'Internet / Fibra' },
      { key: 'cable', label: 'Cable' },
      { key: 'pavimento', label: 'Pavimento' },
      { key: 'alumbrado-publico', label: 'Alumbrado público' },
      { key: 'pozo-de-agua', label: 'Pozo de agua' },
      { key: 'biodigestor', label: 'Biodigestor' },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior',
    items: [
      { key: 'parque', label: 'Parque' },
      { key: 'jardin', label: 'Jardín' },
      { key: 'piscina', label: 'Piscina' },
      { key: 'parrilla', label: 'Parrilla' },
      { key: 'quincho', label: 'Quincho' },
      { key: 'deck', label: 'Deck' },
      { key: 'galeria', label: 'Galería' },
      { key: 'patio', label: 'Patio' },
      { key: 'terraza', label: 'Terraza' },
      { key: 'solarium', label: 'Solárium' },
      { key: 'balcon', label: 'Balcón' },
      { key: 'fogon', label: 'Fogón' },
      { key: 'huerta', label: 'Huerta' },
    ],
  },
  {
    id: 'interior',
    title: 'Interior',
    items: [
      { key: 'aire-acondicionado', label: 'Aire acondicionado' },
      { key: 'calefaccion', label: 'Calefacción' },
      { key: 'losa-radiante', label: 'Losa radiante' },
      { key: 'hogar-chimenea', label: 'Hogar / Chimenea' },
      { key: 'dvh', label: 'DVH' },
      { key: 'blackout', label: 'Blackout' },
      { key: 'vestidor', label: 'Vestidor' },
      { key: 'escritorio', label: 'Escritorio' },
      { key: 'lavadero', label: 'Lavadero' },
      { key: 'dependencia', label: 'Dependencia' },
      { key: 'baulera', label: 'Baulera' },
      { key: 'ascensor', label: 'Ascensor' },
      { key: 'amoblado', label: 'Amoblado' },
    ],
  },
  {
    id: 'seguridad',
    title: 'Seguridad',
    items: [
      { key: 'alarma', label: 'Alarma' },
      { key: 'camaras', label: 'Cámaras' },
      { key: 'porton-automatico', label: 'Portón automático' },
      { key: 'cerco-perimetral', label: 'Cerco perimetral' },
      { key: 'seguridad-24hs', label: 'Seguridad 24 hs' },
      { key: 'barrio-cerrado', label: 'Barrio cerrado' },
      { key: 'portero-electrico', label: 'Portero eléctrico' },
    ],
  },
  {
    id: 'ubicacion-valor',
    title: 'Ubicación / Valor agregado',
    items: [
      { key: 'cerca-del-mar', label: 'Cerca del mar' },
      { key: 'vista-al-bosque', label: 'Vista al bosque' },
      { key: 'vista-abierta', label: 'Vista abierta' },
      { key: 'entorno-forestado', label: 'Entorno forestado' },
      { key: 'esquina', label: 'Esquina' },
      { key: 'calle-sin-salida', label: 'Calle sin salida' },
      { key: 'ideal-renta-turistica', label: 'Ideal renta turística' },
      { key: 'ideal-vivienda-permanente', label: 'Ideal vivienda permanente' },
      { key: 'muy-luminosa', label: 'Muy luminosa' },
      { key: 'apto-mascotas', label: 'Apto mascotas' },
    ],
  },
  {
    id: 'lote',
    title: 'Lote',
    items: [
      { key: 'forestado', label: 'Forestado' },
      { key: 'nivelado', label: 'Nivelado' },
      { key: 'con-alambrado', label: 'Con alambrado' },
      { key: 'lote-irregular', label: 'Lote irregular' },
      { key: 'arbolado', label: 'Arbolado' },
      { key: 'subdivisible', label: 'Subdivisible' },
      { key: 'apto-ph', label: 'Apto PH' },
    ],
  },
];

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  AMENITY_CATEGORIES.flatMap((c) => c.items.map((i) => [i.key, i.label])),
);

/** Human labels for a list of amenity keys (for content generation / display). */
export const amenityLabels = (keys: string[] = []): string[] =>
  keys.map((k) => LABEL_BY_KEY[k]).filter(Boolean);
