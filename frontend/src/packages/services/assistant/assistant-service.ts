import type { VeraInsights } from '@vera/types';

export interface AssistantFormValues {
  title?: string;
  type?: string;
  price?: string;
  neighborhood?: string;
  bedrooms?: string;
  bathrooms?: string;
  areaM2?: string;
  description?: string;
}

export interface AssistantInput {
  values: AssistantFormValues;
  photoCount: number;
  detectedRooms: string[];
}

const MIN_DESCRIPTION = 120;
const MIN_PHOTOS = 5;

/**
 * VeraAssistantService — simulated publication intelligence. Pure, deterministic logic
 * (no external calls). Produces the insights shown in the Vera side panel.
 */
export class VeraAssistantService {
  analyze({ values, photoCount, detectedRooms }: AssistantInput): VeraInsights {
    const hasDescription = (values.description?.trim().length ?? 0) >= MIN_DESCRIPTION;

    const missingFields: string[] = [];
    if (!values.title?.trim()) missingFields.push('Título');
    if (!values.price?.trim()) missingFields.push('Precio');
    if (!values.neighborhood?.trim()) missingFields.push('Barrio');
    if (!values.areaM2?.trim()) missingFields.push('Superficie (m²)');
    if (!hasDescription) missingFields.push('Descripción (mín. 120 caracteres)');
    if (photoCount < MIN_PHOTOS) missingFields.push(`Fotos (mín. ${MIN_PHOTOS})`);

    const checks = [
      !!values.title?.trim(),
      !!values.price?.trim(),
      !!values.neighborhood?.trim(),
      !!values.areaM2?.trim(),
      !!values.type,
      hasDescription,
      photoCount >= 1,
      photoCount >= MIN_PHOTOS,
    ];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    const label = score >= 80 ? 'Excelente' : score >= 50 ? 'Buena' : 'Incompleta';

    const recommendations = [
      {
        id: 'photos',
        text: `Subí al menos ${MIN_PHOTOS} fotos para destacar la publicación.`,
        done: photoCount >= MIN_PHOTOS,
      },
      {
        id: 'description',
        text: 'Escribí una descripción de 120+ caracteres (VERA puede ayudarte).',
        done: hasDescription,
      },
      { id: 'price', text: 'Definí el precio de la operación.', done: !!values.price?.trim() },
      {
        id: 'area',
        text: 'Cargá la superficie en m² para mejorar el match con compradores.',
        done: !!values.areaM2?.trim(),
      },
      {
        id: 'cover',
        text: 'Elegí una portada atractiva (VERA la sugiere automáticamente).',
        done: photoCount > 0,
      },
    ];

    return { quality: { score, label }, detectedRooms, missingFields, recommendations };
  }

  generateDescription(values: AssistantFormValues): string {
    const tipo = values.type ?? 'propiedad';
    const barrio = values.neighborhood?.trim() || 'una ubicación privilegiada';
    const ambientes = values.bedrooms?.trim()
      ? `${values.bedrooms} dormitorios`
      : 'amplios ambientes';
    const banos = values.bathrooms?.trim() || '1';
    const sup = values.areaM2?.trim() ? `${values.areaM2} m²` : 'excelente superficie';
    return (
      `Espectacular ${tipo} en ${barrio}. Con ${ambientes}, ${banos} baño(s) y ${sup}, ` +
      `combina diseño, luminosidad y funcionalidad en cada espacio. Ubicada a metros de ` +
      `comercios, transporte y espacios verdes, es ideal para quienes buscan calidad de vida ` +
      `y una inversión sólida. Coordiná tu visita hoy mismo y descubrí por qué es una ` +
      `oportunidad única.`
    );
  }
}
