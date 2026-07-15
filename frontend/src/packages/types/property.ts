/** Shared domain types for the property portfolio. */

export type PropertyStatus = 'active' | 'reserved' | 'sold';
export type PropertyOperation = 'venta' | 'alquiler';
export type PropertyType =
  | 'departamento'
  | 'casa'
  | 'ph'
  | 'terreno'
  | 'oficina'
  | 'local';

export interface Property {
  id: string;
  title: string;
  operation: PropertyOperation;
  type: PropertyType;
  price: number;
  currency: string;
  address: string;
  neighborhood: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  status: PropertyStatus;
  coverImage: string;
  description: string;
  createdAt: string;
}
