import { z } from 'zod';

export const propertyFormSchema = z.object({
  title: z.string().min(3, 'Ingresá un título de al menos 3 caracteres'),
  operation: z.enum(['venta', 'alquiler']),
  type: z.string().min(1, 'Elegí un tipo'),
  price: z.string().min(1, 'Ingresá el precio'),
  currency: z.string().min(1),
  address: z.string(),
  neighborhood: z.string(),
  city: z.string(),
  bedrooms: z.string(),
  bathrooms: z.string(),
  areaM2: z.string(),
  description: z.string(),
  amenities: z.array(z.string()),
  ownerId: z.string(),
  ownerObservations: z.string(),
  yearBuilt: z.string(),
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
  bedrooms: '',
  bathrooms: '',
  areaM2: '',
  description: '',
  amenities: [],
  ownerId: '',
  ownerObservations: '',
  yearBuilt: '',
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

export const AMENITY_OPTIONS = [
  'Cochera',
  'Balcón',
  'Pileta',
  'Parrilla',
  'Amenities',
  'Seguridad 24h',
];
