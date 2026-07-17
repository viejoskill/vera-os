import type {
  PropertyDetail,
  RecommendationPriority,
  WorkspaceSection,
  WorkspaceAssessment,
} from '@vera/types';

export const MIN_PHOTOS = 5;
export const IDLE_DAYS_THRESHOLD = 21;

/** Everything a rule needs to decide, derived exclusively from real property data. */
export interface PropertyRuleContext {
  detail: PropertyDetail;
  assessment: WorkspaceAssessment;
  photoCount: number;
  idleDays: number;
}

/** What a rule emits when its objective condition holds. */
export interface RuleOutcome {
  priority: RecommendationPriority;
  title: string;
  whatHappened: string;
  whyItMatters: string;
  recommendation: string;
  impact: number;
  section: WorkspaceSection;
  focus?: string;
}

export interface PropertyRule {
  id: string;
  evaluate: (ctx: PropertyRuleContext) => RuleOutcome | null;
}

const done = (a: WorkspaceAssessment, id: string): boolean =>
  a.checklist.find((c) => c.id === id)?.done ?? false;

/**
 * VERA Intelligence Engine — initial property rule catalog.
 * Each rule is a pure, deterministic function over REAL property state. It proposes
 * an ACTION (never raw data) and vanishes the moment its condition is resolved.
 * Rules are ordered by urgency; the provider surfaces the single most important one
 * per property (the next best step), keeping the "Hoy" Inbox focused.
 */
export const PROPERTY_RULES: PropertyRule[] = [
  // 🔴 Bloqueantes — sin esto la propiedad no puede trabajarse ni publicarse.
  {
    id: 'datos-incompletos',
    evaluate: ({ assessment }) =>
      done(assessment, 'datos')
        ? null
        : {
            priority: 'alta',
            title: 'Completá los datos',
            whatHappened: 'Faltan los datos principales de la propiedad.',
            whyItMatters: 'Son la base para identificar y publicar la propiedad.',
            recommendation: 'Completá título, tipo y operación para empezar.',
            impact: 1,
            section: 'information',
          },
  },
  {
    id: 'sin-precio',
    evaluate: ({ assessment }) =>
      done(assessment, 'precio')
        ? null
        : {
            priority: 'alta',
            title: 'Definí el precio',
            whatHappened: 'Todavía no tiene precio.',
            whyItMatters: 'Sin precio la propiedad no puede publicarse.',
            recommendation: 'Definí el precio de la operación.',
            impact: 2,
            section: 'information',
            focus: 'price',
          },
  },
  {
    id: 'sin-fotos',
    evaluate: ({ photoCount }) =>
      photoCount > 0
        ? null
        : {
            priority: 'alta',
            title: 'Sumá fotografías',
            whatHappened: 'Todavía no tiene fotografías.',
            whyItMatters: 'Las fotos son lo primero que evalúa un comprador.',
            recommendation: `Subí al menos ${MIN_PHOTOS} fotos para destacar la propiedad.`,
            impact: 3,
            section: 'photos',
          },
  },

  // 🟡 Calidad de la ficha — mejora consultas y confianza.
  {
    id: 'pocas-fotos',
    evaluate: ({ photoCount }) =>
      photoCount === 0 || photoCount >= MIN_PHOTOS
        ? null
        : {
            priority: 'atencion',
            title: 'Sumá más fotos',
            whatHappened: `Tiene ${photoCount} de ${MIN_PHOTOS} fotos recomendadas.`,
            whyItMatters: 'Más fotos mejoran la calidad y aumentan las consultas.',
            recommendation: `Subí ${MIN_PHOTOS - photoCount} foto(s) más para llegar a ${MIN_PHOTOS}.`,
            impact: 4,
            section: 'photos',
          },
  },
  {
    id: 'sin-descripcion',
    evaluate: ({ assessment }) =>
      done(assessment, 'descripcion')
        ? null
        : {
            priority: 'atencion',
            title: 'Escribí la descripción',
            whatHappened: 'Falta la descripción de la propiedad.',
            whyItMatters: 'Una buena descripción eleva la calidad de la publicación.',
            recommendation: 'Generá la descripción desde Contenido comercial y usala.',
            impact: 5,
            section: 'express',
          },
  },
  {
    id: 'sin-propietario',
    evaluate: ({ assessment }) =>
      done(assessment, 'propietario')
        ? null
        : {
            priority: 'atencion',
            title: 'Vinculá al propietario',
            whatHappened: 'La propiedad no tiene propietario vinculado.',
            whyItMatters: 'Tener al dueño cargado agiliza toda la operación.',
            recommendation: 'Vinculá al propietario de la propiedad.',
            impact: 6,
            section: 'owner',
          },
  },
  {
    id: 'sin-actividad',
    evaluate: ({ idleDays }) =>
      idleDays < IDLE_DAYS_THRESHOLD
        ? null
        : {
            priority: 'atencion',
            title: 'Retomá esta propiedad',
            whatHappened: `Sin novedades hace ${idleDays} días.`,
            whyItMatters: 'Las propiedades activas generan más consultas.',
            recommendation: 'Revisá la propiedad y actualizá lo que haga falta.',
            impact: 7,
            section: 'information',
          },
  },

  // 🟢 Oportunidades — llevar la ficha a excelente y publicar.
  {
    id: 'sin-plano',
    evaluate: ({ assessment }) =>
      done(assessment, 'plano')
        ? null
        : {
            priority: 'lista',
            title: 'Agregá el plano',
            whatHappened: 'Ya tiene lo esencial, pero falta el plano.',
            whyItMatters: 'El plano lleva la ficha a un puntaje excelente.',
            recommendation: 'Subí el plano para completar la ficha.',
            impact: 8,
            section: 'documents',
            focus: 'floor_plan',
          },
  },
  {
    id: 'sin-video',
    evaluate: ({ assessment }) =>
      done(assessment, 'video')
        ? null
        : {
            priority: 'lista',
            title: 'Sumá un video',
            whatHappened: 'Falta el video de la propiedad.',
            whyItMatters: 'El video enriquece la publicación y genera más interés.',
            recommendation: 'Agregá el link del video para enriquecer la ficha.',
            impact: 9,
            section: 'features',
            focus: 'video',
          },
  },
  {
    id: 'lista-para-publicar',
    evaluate: ({ assessment }) =>
      assessment.status !== 'ready'
        ? null
        : {
            priority: 'lista',
            title: 'Publicá la propiedad',
            whatHappened: 'Tiene todo lo esencial cargado.',
            whyItMatters: 'Publicarla ahora te permite empezar a recibir consultas.',
            recommendation: 'Revisá los últimos detalles y publicala.',
            impact: 10,
            section: 'information',
          },
  },
];

/** Runs the catalog and returns the single most important active rule (next best step). */
export function evaluateProperty(ctx: PropertyRuleContext): RuleOutcome | null {
  for (const rule of PROPERTY_RULES) {
    const outcome = rule.evaluate(ctx);
    if (outcome) return outcome;
  }
  return null;
}
