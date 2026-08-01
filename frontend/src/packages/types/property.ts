/** Shared domain types for the property portfolio. */

export type PropertyStatus = 'active' | 'reserved' | 'sold' | 'draft';
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
  code: string;
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
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string;
  formattedAddress?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  rooms?: number;
  toilettes?: number;
  lotAreaM2?: number;
  semiCoveredAreaM2?: number;
  floors?: number;
  floorNumber?: number | null;
  parkingCovered?: number;
  parkingUncovered?: number;
  orientation?: string;
  condition?: string;
  amenities?: string[];
  radar?: boolean;
  ownerId?: string;
  publications?: Record<string, { status: string; lastSync?: string | null }>;
  /** URL pública CANÓNICA (fuente única). `null` si la propiedad no está publicada. */
  publicUrl?: string | null;
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

export interface PropertyVisit {
  id: string;
  propertyId: string;
  date: string;
  time: string;
  interested: string;
  agent: string;
  comment: string;
  notifyOwner: boolean;
  createdAt: string;
}

export interface VisitInput {
  date: string;
  time: string;
  interested: string;
  agent: string;
  comment: string;
  notifyOwner: boolean;
}
