import type { WorkspaceAssessment, ChecklistItem } from '@vera/types';

export interface AssistantFormValues {
  title?: string;
  type?: string;
  operation?: string;
  price?: string;
  neighborhood?: string;
  bedrooms?: string;
  bathrooms?: string;
  areaM2?: string;
  description?: string;
  ownerId?: string;
}

export interface AssessInput {
  values: AssistantFormValues;
  photoCount: number;
}

const MIN_DESCRIPTION = 120;
const MIN_PHOTOS = 5;

const NEXT_STEP: Record<string, string> = {
  datos: 'Completá los datos principales para identificar la propiedad.',
  precio: 'Definí el precio de la operación.',
  fotos: 'Subí al menos 5 fotos para destacar la propiedad.',
  descripcion: 'Escribí la descripción para mejorar la calidad de la publicación.',
  propietario: 'Vinculá al propietario de la propiedad.',
  plano: 'Agregá un plano para alcanzar un Health Score excelente.',
  video: 'Sumá un video para enriquecer la publicación.',
  anio: 'Indicá el año de construcción para dar más contexto.',
};

/**
 * VeraAssistantService — simulated publication intelligence. Pure, deterministic.
 * Produces a diagnosis: progress, health, checklist and the next recommended action.
 * Philosophy: never surface "empty fields" — surface "next actions".
 */
export class VeraAssistantService {
  assess({ values, photoCount }: AssessInput): WorkspaceAssessment {
    const done = {
      datos: (values.title?.trim().length ?? 0) >= 3 && !!values.type && !!values.operation,
      propietario: !!values.ownerId?.trim(),
      fotos: photoCount >= MIN_PHOTOS,
      precio: !!values.price?.trim(),
      descripcion: (values.description?.trim().length ?? 0) >= MIN_DESCRIPTION,
      plano: false,
      video: false,
      anio: false,
    };

    const checklist: ChecklistItem[] = [
      { id: 'datos', label: 'Datos principales', done: done.datos, optional: false },
      { id: 'propietario', label: 'Propietario', done: done.propietario, optional: false },
      { id: 'fotos', label: 'Fotografías', done: done.fotos, optional: false },
      { id: 'precio', label: 'Precio', done: done.precio, optional: false },
      { id: 'descripcion', label: 'Descripción', done: done.descripcion, optional: false },
      { id: 'plano', label: 'Plano', done: done.plano, optional: true },
      { id: 'video', label: 'Video', done: done.video, optional: true },
      { id: 'anio', label: 'Año de construcción', done: done.anio, optional: true },
    ];

    const core = checklist.filter((c) => !c.optional);
    const extras = checklist.filter((c) => c.optional);
    const coreDone = core.filter((c) => c.done).length;
    const extrasDone = extras.filter((c) => c.done).length;

    const score = Math.round((coreDone / core.length) * 80 + (extrasDone / extras.length) * 20);
    const totalDone = checklist.filter((c) => c.done).length;
    const completion = Math.round((totalDone / checklist.length) * 100);
    const status: 'ready' | 'preparing' = coreDone === core.length ? 'ready' : 'preparing';

    const label =
      score >= 85 ? 'Excelente' : score >= 70 ? 'Muy buena' : score >= 50 ? 'Atención' : 'Incompleta';

    const priority = ['datos', 'precio', 'fotos', 'descripcion', 'propietario', 'plano', 'video', 'anio'];
    const firstMissing = priority.find((id) => !checklist.find((c) => c.id === id)?.done) ?? null;
    const nextStep = firstMissing ? NEXT_STEP[firstMissing] : null;

    let message: string;
    if (status === 'ready' && score >= 85) {
      message = 'La propiedad está prácticamente lista para publicarse.';
    } else if (status === 'ready') {
      message = 'Ya está lista para publicar. Sumá plano y video para llegar a un puntaje excelente.';
    } else {
      const missingCore = core.filter((c) => !c.done).map((c) => c.label.toLowerCase());
      message = `Completá ${missingCore.slice(0, 2).join(' y ')} para avanzar.`;
    }

    return { completion, status, health: { score, label, message }, checklist, nextStep };
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
