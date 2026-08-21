import { z } from 'zod';

export const propertyFormSchema = z.object({
  title: z.string(),
  operation: z.enum(['venta', 'alquiler']),
  type: z.string().min(1, 'Elegí un tipo'),
  price: z.string().min(1, 'Ingresá el precio'),
  currency: z.string().min(1),
  address: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  googlePlaceId: z.string(),
  formattedAddress: z.string(),
  // Características objetivas
  rooms: z.string(),
  bedrooms: z.string(),
  bathrooms: z.string(),
  toilettes: z.string(),
  areaM2: z.string(),
  lotAreaM2: z.string(),
  semiCoveredAreaM2: z.string(),
  floors: z.string(),
  floorNumber: z.string(),
  parkingCovered: z.string(),
  parkingUncovered: z.string(),
  orientation: z.string(),
  condition: z.string(),
  yearBuilt: z.string(),
  // Amenities (atributos) — lista plana de claves canónicas
  amenities: z.array(z.string()),
  radar: z.boolean(),
  autoStamp: z.boolean(),
  description: z.string(),
  ownerId: z.string(),
  ownerObservations: z.string(),
  videoUrl: z.string(),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const defaultPropertyForm: PropertyFormValues = {
  title: '',
  operation: 'venta',
  type: 'departamento',
  price: '',
  currency: 'USD',
  address: '',
  neighborhood: '',
  city: 'Buenos Aires',
  province: '',
  postalCode: '',
  country: '',
  latitude: null,
  longitude: null,
  googlePlaceId: '',
  formattedAddress: '',
  rooms: '',
  bedrooms: '',
  bathrooms: '',
  toilettes: '',
  areaM2: '',
  lotAreaM2: '',
  semiCoveredAreaM2: '',
  floors: '',
  floorNumber: '',
  parkingCovered: '',
  parkingUncovered: '',
  orientation: '',
  condition: '',
  yearBuilt: '',
  amenities: [],
  radar: false,
  autoStamp: true,
  description: '',
  ownerId: '',
  ownerObservations: '',
  videoUrl: '',
};

export const PROPERTY_TYPE_OPTIONS = [
  { value: 'departamento', label: 'Departamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'ph', label: 'PH' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'local', label: 'Local' },
];

export const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'ARS', label: 'ARS' },
];

export const CONDITION_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'a-estrenar', label: 'A estrenar' },
  { value: 'excelente', label: 'Excelente' },
  { value: 'muy-bueno', label: 'Muy bueno' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'a-reciclar', label: 'A reciclar' },
];

export const ORIENTATION_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  { value: 'N', label: 'Norte' },
  { value: 'S', label: 'Sur' },
  { value: 'E', label: 'Este' },
  { value: 'O', label: 'Oeste' },
  { value: 'NE', label: 'Noreste' },
  { value: 'NO', label: 'Noroeste' },
  { value: 'SE', label: 'Sudeste' },
  { value: 'SO', label: 'Sudoeste' },
];

// Tipos donde "Piso" tiene sentido (nunca para casa/terreno/campo).
export const FLOOR_TYPES = ['departamento', 'oficina', 'local'];
