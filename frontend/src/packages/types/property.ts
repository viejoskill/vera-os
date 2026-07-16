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
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyImageAsset {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  isCover: boolean;
  url: string;
}

export interface PropertyDocumentAsset {
  id: string;
  docType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface PropertyDetail extends Property {
  ownerId?: string;
  ownerObservations?: string;
  yearBuilt?: string;
  videoUrl?: string;
  images: PropertyImageAsset[];
  documents: PropertyDocumentAsset[];
}
