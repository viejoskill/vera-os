import type { PropertyDetail, InboxRecommendation, WorkspaceSection } from '@vera/types';
import type { PropertyService } from '../property-service';
import type { VeraAssistantService, AssistantFormValues } from '../assistant/assistant-service';
import type { IntelligenceProvider } from './intelligence-provider';

interface Signal {
  title: string;
  why: string;
  section: WorkspaceSection;
  focus?: string;
  impact: number;
}

// Maps the single next-best-step to an actionable, positively-framed signal.
const SIGNALS: Record<string, Signal> = {
  fotos: {
    title: 'Sumá fotografías',
    why: 'Las fotos son lo primero que evalúa un comprador.',
    section: 'photos',
    impact: 1,
  },
  precio: {
    title: 'Definí el precio',
    why: 'Sin precio la propiedad todavía no puede publicarse.',
    section: 'information',
    focus: 'price',
    impact: 2,
  },
  datos: {
    title: 'Completá los datos',
    why: 'Son la base para identificar y publicar la propiedad.',
    section: 'information',
    impact: 3,
  },
  descripcion: {
    title: 'Escribí la descripción',
    why: 'Una buena descripción eleva la calidad de la publicación.',
    section: 'description',
    impact: 4,
  },
  propietario: {
    title: 'Vinculá al propietario',
    why: 'Tener al dueño cargado agiliza toda la operación.',
    section: 'owner',
    impact: 5,
  },
  plano: {
    title: 'Agregá el plano',
    why: 'El plano deja la propiedad lista con un puntaje excelente.',
    section: 'documents',
    focus: 'floor_plan',
    impact: 6,
  },
};

const daysSince = (iso: string): number => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
};

const toValues = (d: PropertyDetail): AssistantFormValues => ({
  title: d.title,
  type: d.type,
  operation: d.operation,
  price: d.price ? String(d.price) : '',
  neighborhood: d.neighborhood,
  bedrooms: d.bedrooms ? String(d.bedrooms) : '',
  bathrooms: d.bathrooms ? String(d.bathrooms) : '',
  areaM2: d.areaM2 ? String(d.areaM2) : '',
  description: d.description,
  ownerId: d.ownerId ?? '',
  yearBuilt: d.yearBuilt ?? '',
  videoUrl: d.videoUrl ?? '',
});

/**
 * PropertiesProvider — turns real property state into next-best-step recommendations
 * using the VIE philosophy. One recommendation per property (the single most
 * impactful action), so the Inbox stays focused on "what to do first".
 */
export class PropertiesProvider implements IntelligenceProvider {
  readonly id = 'properties';

  constructor(
    private readonly properties: PropertyService,
    private readonly assistant: VeraAssistantService,
  ) {}

  async generate(): Promise<InboxRecommendation[]> {
    const list = await this.properties.getProperties({ status: 'all' });
    const details = await Promise.all(list.map((p) => this.properties.getProperty(p.id)));
    return details
      .map((d) => (d ? this.evaluate(d) : null))
      .filter((r): r is InboxRecommendation => r !== null);
  }

  private evaluate(d: PropertyDetail): InboxRecommendation | null {
    const assessment = this.assistant.assess({
      values: toValues(d),
      photoCount: d.images.length,
      documentTypes: d.documents.map((doc) => doc.docType) as never,
    });
    const subject = d.neighborhood ? `${d.title} · ${d.neighborhood}` : d.title || 'Propiedad';

    // 🟢 Ready to publish — an opportunity, not a problem.
    if (assessment.status === 'ready') {
      return {
        id: `property-${d.id}`,
        priority: 'lista',
        subject,
        title: 'Publicá la propiedad',
        whatHappened: 'Tiene todo lo esencial cargado.',
        whyItMatters: 'Publicarla ahora te permite empezar a recibir consultas.',
        recommendation: 'Revisá los últimos detalles y publicala.',
        impact: 10,
        target: { entity: 'property', entityId: d.id, section: 'information' },
      };
    }

    // In preparation — surface the single next best step.
    const core = assessment.checklist.filter((c) => !c.optional);
    const coreMissing = core.filter((c) => !c.done).length;
    const firstMissing = assessment.checklist.find((c) => !c.done)?.id ?? 'datos';
    const signal = SIGNALS[firstMissing] ?? SIGNALS.datos;
    const idle = daysSince(d.createdAt);

    const isAlta = d.images.length === 0 || coreMissing >= 3 || idle > 21;
    const whatHappened =
      d.images.length === 0 && firstMissing === 'fotos'
        ? 'Todavía no tiene fotografías.'
        : idle > 7
          ? `En preparación hace ${idle} días.`
          : 'Está en preparación.';

    return {
      id: `property-${d.id}`,
      priority: isAlta ? 'alta' : 'atencion',
      subject,
      title: signal.title,
      whatHappened,
      whyItMatters: signal.why,
      recommendation: assessment.nextStep ?? 'Avancemos con el siguiente paso.',
      impact: signal.impact,
      target: { entity: 'property', entityId: d.id, section: signal.section, focus: signal.focus },
    };
  }
}
