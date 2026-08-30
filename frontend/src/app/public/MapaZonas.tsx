export const ZONAS_TASADOR: [string, string][] = [
  ['pensamientos_sur', 'Zona Pensamientos Sur'], ['pensamientos_centro', 'Zona Pensamientos Centro'], ['pensamientos_norte', 'Zona Pensamientos Norte'],
  ['cristo_sur', 'Zona Cristo Sur'], ['cristo_centro', 'Zona Cristo Centro'], ['cristo_norte', 'Zona Cristo Norte'],
  ['alelies', 'Zona Alelies'],
  ['centro_sur', 'Zona Centro Sur'], ['centro', 'Zona Centro'], ['centro_norte', 'Zona Centro Norte'],
  ['reserva_residencial', 'La Reserva Residencial'], ['premium', 'Zona Premium'],
  ['reserva_multif', 'La Reserva Multif.'], ['playa', 'Zona Playa'],
  ['comercial_ruta', 'Zona Comercial (Ruta)'],
  ['av2', 'Av. 2'],
  ['av_costanera_1', 'Av. Costanera · Tramo 1'], ['av_costanera_2', 'Av. Costanera · Tramo 2'],
  ['av_costanera_3', 'Av. Costanera · Tramo 3'], ['av_costanera_4', 'Av. Costanera · Tramo 4'],
  ['av_costanera_5', 'Av. Costanera · Tramo 5'],
  ['av_interbalnearia_1', 'Av. Interbalnearia · Tramo 1'], ['av_interbalnearia_2', 'Av. Interbalnearia · Tramo 2'],
  ['av_interbalnearia_3', 'Av. Interbalnearia · Tramo 3'], ['av_interbalnearia_4', 'Av. Interbalnearia · Tramo 4'],
  ['av_interbalnearia_5', 'Av. Interbalnearia · Tramo 5'], ['av_interbalnearia_6', 'Av. Interbalnearia · Tramo 6'],
  ['av_interbalnearia_7', 'Av. Interbalnearia · Tramo 7'],
  ['camelias_1', 'Calle Camelias · Tramo 1'], ['camelias_2', 'Calle Camelias · Tramo 2'],
  ['camelias_3', 'Calle Camelias · Tramo 3'], ['camelias_4', 'Calle Camelias · Tramo 4'],
];

const NOMBRE: Record<string, string> = Object.fromEntries(ZONAS_TASADOR);

// Coordenadas (%) sobre la foto real restyleada (public/costa-del-este-mapa-zonas.jpg, 1211×1680px).
// Cada zona-bloque tiene DOS cajas: `hit` (área grande, fácil de tocar) y `label` (recorte
// chico y preciso, calcado sobre el texto "ZONA X" real de la foto) — así el toque es cómodo
// pero el resaltado amarillo queda pegado al nombre y no se desfasa de la zona real (que
// está rotada en la foto y no calza con un rectángulo grande).
const BLOQUES: { key: string; hit: [number, number, number, number]; label: [number, number, number, number] }[] = [
  { key: 'comercial_ruta', hit: [52.44, 8.04, 22.3, 6.25], label: [62.3, 8.9, 7.85, 5.06] },
  { key: 'pensamientos_sur', hit: [14.04, 14.29, 12.3, 8.63], label: [19.0, 17.0, 10.7, 4.5] },
  { key: 'pensamientos_centro', hit: [44.59, 14.29, 16.6, 8.63], label: [47.9, 16.1, 12.8, 5.1] },
  { key: 'pensamientos_norte', hit: [61.19, 14.29, 29.23, 8.63], label: [81.8, 16.7, 12.4, 4.5] },
  { key: 'cristo_sur', hit: [14.04, 22.92, 12.3, 16.37], label: [19.0, 29.2, 7.85, 4.2] },
  { key: 'cristo_centro', hit: [26.34, 22.92, 34.85, 16.37], label: [42.9, 28.0, 18.6, 5.7] },
  { key: 'cristo_norte', hit: [61.19, 22.92, 29.23, 16.37], label: [82.2, 28.0, 8.7, 4.2] },
  { key: 'alelies', hit: [14.04, 39.29, 76.38, 4.82], label: [41.7, 41.4, 23.5, 2.7] },
  { key: 'centro_sur', hit: [14.04, 44.11, 12.3, 13.45], label: [14.4, 47.6, 7.4, 4.5] },
  { key: 'centro', hit: [26.34, 44.11, 34.85, 13.45], label: [37.2, 48.5, 23.5, 2.4] },
  { key: 'centro_norte', hit: [61.19, 44.11, 29.23, 13.45], label: [74.7, 47.6, 8.3, 4.5] },
  { key: 'reserva_residencial', hit: [5.78, 60.54, 28.9, 12.86], label: [12.8, 64.3, 13.6, 3.6] },
  { key: 'premium', hit: [34.68, 60.54, 45.42, 12.86], label: [42.1, 67.0, 24.4, 2.4] },
  { key: 'reserva_multif', hit: [5.78, 73.39, 28.9, 7.56], label: [12.8, 73.8, 12.8, 3.0] },
  { key: 'playa', hit: [34.68, 73.39, 45.42, 7.56], label: [39.6, 75.6, 19.8, 2.4] },
];

// Costanera/Interbalnearia/Camelias se dividen en tramos entre avenidas transversales
// (Av.1 a Av.7, de derecha a izquierda en la foto) — cada tramo es su propia zona de precio.
type Box = [number, number, number, number];
const tramos = (prefix: string, n: number, [left, top, width, height]: Box) => {
  const segW = width / n;
  return Array.from({ length: n }, (_, i) => {
    const num = i + 1; // Tramo 1 = extremo derecho (más cerca de Av.1)
    return { key: `${prefix}_${num}`, box: [left + width - num * segW, top, segW, height] as Box };
  });
};

// Avenidas/calles: franjas ya alineadas con la foto (van con mayor z-index que las zonas).
const AVENIDA_OVERLAYS: { key: string; box: Box }[] = [
  ...tramos('av_interbalnearia', 7, [5.78, 56.85, 88.44, 3.69]),
  ...tramos('camelias', 4, [5.78, 72.02, 88.44, 2.38]),
  ...tramos('av_costanera', 5, [5.78, 78.87, 88.44, 2.38]),
  { key: 'av2', box: [66.06, 57.56, 3.3, 23.39] },
];

const AVENIDAS_GRUPOS: { titulo: string; keys: string[] }[] = [
  { titulo: 'Av. Costanera', keys: ['av_costanera_1', 'av_costanera_2', 'av_costanera_3', 'av_costanera_4', 'av_costanera_5'] },
  { titulo: 'Av. 2', keys: ['av2'] },
  { titulo: 'Av. Interbalnearia', keys: ['av_interbalnearia_1', 'av_interbalnearia_2', 'av_interbalnearia_3', 'av_interbalnearia_4', 'av_interbalnearia_5', 'av_interbalnearia_6', 'av_interbalnearia_7'] },
  { titulo: 'Calle Camelias', keys: ['camelias_1', 'camelias_2', 'camelias_3', 'camelias_4'] },
];

interface Props { value: string; onChange: (v: string) => void; }

const box = ([left, top, width, height]: Box) => ({
  left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
});

export const MapaZonas = ({ value, onChange }: Props) => (
  <div className="mapz" data-testid="mapa-zonas">
    <p className="mapz__caption">Plano real de Costa del Este — tocá tu zona</p>

    <div className="mapz__imgwrap">
      <img src="/costa-del-este-mapa-zonas.jpg" alt="Mapa de zonas de Costa del Este" className="mapz__img" />
      {BLOQUES.map((z) => (
        <div key={z.key} className="mapz__zona">
          <button
            type="button"
            className="mapz__hit"
            style={box(z.hit)}
            onClick={() => onChange(z.key)}
            aria-label={NOMBRE[z.key]}
            data-testid={`mapa-zona-${z.key}`}
          />
          <div className={`mapz__label ${value === z.key ? 'is-selected' : ''}`} style={box(z.label)} />
        </div>
      ))}
      {AVENIDA_OVERLAYS.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`mapz__overlay mapz__overlay--avenida ${value === a.key ? 'is-selected' : ''}`}
          style={box(a.box)}
          onClick={() => onChange(a.key)}
          aria-label={NOMBRE[a.key]}
          data-testid={`mapa-zona-${a.key}`}
        />
      ))}
    </div>

    <p className="mapz__selected" data-testid="mapa-zona-seleccionada">
      Zona seleccionada: <b>{NOMBRE[value] || value}</b>
    </p>

    <div className="mapz__avenidas">
      <span className="mapz__avenidas-tag">¿Tu lote da a una avenida o calle principal? Elegí el tramo acá:</span>
      {AVENIDAS_GRUPOS.map((g) => (
        <div key={g.titulo} className="mapz__avgrupo">
          <span className="mapz__avgrupo-titulo">{g.titulo}</span>
          <div className="mapz__pills">
            {g.keys.map((k) => (
              <button
                key={k} type="button"
                className={`mapz__pill ${value === k ? 'is-selected' : ''}`}
                onClick={() => onChange(k)}
                data-testid={`mapa-pill-${k}`}
              >
                {g.keys.length > 1 ? k.split('_').pop() : g.titulo}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default MapaZonas;
