// Reseñas curadas de la home. Para agregar/editar reseñas, sumá objetos a REVIEWS.
// Link para leer/escribir reseñas en el perfil de Google de Varela.
export const GOOGLE_REVIEW_URL = 'https://share.google/BjitJyGJx5FhF2ehn';

// Puntaje general que se muestra en el badge. Ajustar al valor real de Google.
export const GOOGLE_RATING = 5.0;
// Cantidad total de reseñas (opcional). Poné null para ocultar el número.
export const GOOGLE_TOTAL: number | null = null;

export interface Review {
  name: string;
  text: string;
  rating: number; // 1..5
  when?: string; // ej. "Hace 2 meses"
}

// TODO(Varela): reemplazar estos ejemplos por reseñas reales de Google.
export const REVIEWS: Review[] = [
  {
    name: 'Cliente de Costa del Este',
    text: 'Excelente atención de principio a fin. Nos ayudaron a encontrar la casa ideal entre los pinos y todo el proceso fue clarísimo y rápido.',
    rating: 5,
    when: 'Reseña de ejemplo',
  },
  {
    name: 'Propietario en Mar del Tuyú',
    text: 'Vendí mi propiedad en tiempo récord. El seguimiento y la comunicación fueron impecables. Totalmente recomendables.',
    rating: 5,
    when: 'Reseña de ejemplo',
  },
  {
    name: 'Familia veraneante',
    text: 'Alquilamos por temporada y fue todo transparente: fotos reales, buena predisposición y una casa hermosa. Volvemos el próximo verano.',
    rating: 5,
    when: 'Reseña de ejemplo',
  },
];
