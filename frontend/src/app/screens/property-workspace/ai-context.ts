import type { AiPropertyContext } from '@vera/repositories';
import { amenityLabels } from './amenities-catalog';
import type { PropertyFormValues } from './form-schema';

const num = (v: string): number | null => {
  const n = Number((v || '').trim());
  return v?.trim() && n > 0 ? n : null;
};

const COAST = /costa|mar del|pinamar|villa gesell|monte hermoso|las toninas|san bernardo|carilo|cariló/i;

/** Maps the workspace form into the AI knowledge-base context (single source). */
export const buildAiContext = (v: PropertyFormValues): AiPropertyContext => ({
  type: v.type,
  operation: v.operation,
  city: v.city,
  neighborhood: v.neighborhood,
  address: v.address,
  title: v.title,
  description: v.description,
  rooms: num(v.rooms),
  bedrooms: num(v.bedrooms),
  bathrooms: num(v.bathrooms),
  toilettes: num(v.toilettes),
  areaM2: num(v.areaM2),
  semiCoveredAreaM2: num(v.semiCoveredAreaM2),
  lotAreaM2: num(v.lotAreaM2),
  floors: num(v.floors),
  floorNumber: num(v.floorNumber),
  parkingCovered: num(v.parkingCovered),
  parkingUncovered: num(v.parkingUncovered),
  orientation: v.orientation,
  condition: v.condition,
  yearBuilt: v.yearBuilt,
  amenities: amenityLabels(v.amenities),
  nearSea: v.amenities.includes('cerca-del-mar') || COAST.test(`${v.city} ${v.neighborhood}`),
});
