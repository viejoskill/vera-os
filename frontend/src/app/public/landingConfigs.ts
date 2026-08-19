export interface LandingConfig {
  slug: string;
  type: string | null; // null = hub (todas)
  isHub?: boolean;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  emptyMsg: string;
}

export const LANDINGS: Record<'hub' | 'casas' | 'lotes' | 'ph', LandingConfig> = {
  hub: {
    slug: '/venta/costa-del-este',
    type: null,
    isHub: true,
    h1: 'Propiedades en venta en Costa del Este',
    title: 'Propiedades en venta en Costa del Este | Varela Inmobiliaria',
    description:
      'Casas, lotes y PH en venta en Costa del Este. Cartera actualizada de Varela Inmobiliaria, con más de 20 años en la zona. Consultá por WhatsApp.',
    intro: [
      'Varela Inmobiliaria concentra la oferta de propiedades en venta en Costa del Este y alrededores como Mar del Tuyú. Con más de 20 años trabajando en la zona, te acompañamos en la compra desde la primera consulta hasta la escritura.',
      'Explorá casas, lotes y PH según lo que estés buscando, o filtrá por tipo y zona para llegar más rápido a la propiedad ideal. Si buscás alquiler temporario para el verano, tenemos una sección aparte.',
    ],
    emptyMsg: 'Por el momento no hay propiedades publicadas. Escribinos y te avisamos apenas ingresen nuevas.',
  },
  casas: {
    slug: '/venta/casas-costa-del-este',
    type: 'casa',
    h1: 'Casas en venta en Costa del Este',
    title: 'Casas en venta en Costa del Este | Varela Inmobiliaria',
    description:
      'Casas en venta en Costa del Este: viviendas familiares, chalets y casas cerca del mar. Cartera actualizada de Varela Inmobiliaria.',
    intro: [
      'Encontrá casas en venta en Costa del Este seleccionadas por Varela Inmobiliaria: desde viviendas para vivir todo el año hasta casas de veraneo a pocas cuadras del mar.',
      'Cada casa está verificada por nuestro equipo. Consultá por WhatsApp por la que te interese y coordinamos una visita sin compromiso.',
    ],
    emptyMsg: 'No hay casas publicadas en este momento. Escribinos y te avisamos apenas ingrese una nueva.',
  },
  lotes: {
    slug: '/venta/lotes-costa-del-este',
    type: 'terreno',
    h1: 'Lotes en venta en Costa del Este',
    title: 'Lotes y terrenos en venta en Costa del Este | Varela',
    description:
      'Lotes y terrenos en venta en Costa del Este para construir cerca del mar. Asesoramiento y financiación con Varela Inmobiliaria.',
    intro: [
      'Si buscás un lote en venta en Costa del Este para construir tu casa o invertir, en Varela Inmobiliaria tenemos terrenos en distintas ubicaciones y superficies, muchos a pocas cuadras del mar.',
      'Te asesoramos sobre medidas, orientación y potencial de cada terreno para que elijas con seguridad. Consultá por WhatsApp por el lote que te interese.',
    ],
    emptyMsg: 'No hay lotes publicados en este momento. Escribinos y te avisamos apenas ingrese uno nuevo.',
  },
  ph: {
    slug: '/venta/ph-costa-del-este',
    type: 'ph',
    h1: 'PH en venta en Costa del Este',
    title: 'PH en venta en Costa del Este | Varela Inmobiliaria',
    description:
      'PH en venta en Costa del Este, ideales para veranear o invertir. Unidades seleccionadas por Varela Inmobiliaria.',
    intro: [
      'Los PH en venta en Costa del Este son una gran opción para quienes buscan una unidad práctica para el verano o una inversión con buena renta.',
      'En Varela Inmobiliaria te mostramos PH en distintas zonas y valores. Consultá por WhatsApp por el que más te guste.',
    ],
    emptyMsg: 'No hay PH publicados en este momento. Escribinos y te avisamos apenas ingrese uno nuevo.',
  },
};

export const LANDING_LIST = [LANDINGS.casas, LANDINGS.lotes, LANDINGS.ph];
