export const ZONAS_TASADOR: [string, string][] = [
  ['comercial_ruta', 'Zona Comercial Ruta'],
  ['pensamientos_sur', 'Zona Pensamientos Sur'], ['pensamientos_centro', 'Zona Pensamientos Centro'], ['pensamientos_norte', 'Zona Pensamientos Norte'],
  ['cristo_sur', 'Zona Cristo Sur'], ['cristo_centro', 'Zona Cristo Centro'], ['cristo_norte', 'Zona Cristo Norte'],
  ['centro_sur', 'Zona Centro Sur'], ['centro', 'Zona Centro'], ['centro_norte', 'Zona Centro Norte'],
  ['reserva_residencial', 'La Reserva Residencial'], ['reserva_comercial', 'La Reserva Comercial'],
  ['premium', 'Zona Premium'], ['premium_norte', 'Zona Premium Norte'],
  ['playa', 'Zona Playa'], ['playa_norte', 'Zona Playa Norte'],
  ['av_interbalnearia', 'Av. Interbalnearia'], ['av_costanera', 'Av. Costanera'],
  ['los_pensamientos', 'Los Pensamientos'], ['los_alelies', 'Los Alelies'],
  ['camelias', 'Las Camelias'], ['av2', 'Av. 2'],
];

const NOMBRE: Record<string, string> = Object.fromEntries(ZONAS_TASADOR);

// Coordenadas (%) sobre el mapa de zonificación real (public/costa-del-este-mapa-zonas.jpg,
// 1024×1536px). Es un diagrama prolijo (no una foto rotada): cada zona es una caja limpia,
// medida a nivel píxel sobre la imagen, así que el resaltado cubre el rectángulo completo.
const BLOQUES: { key: string; hit: [number, number, number, number] }[] = [
  { key: 'comercial_ruta', hit: [51.37, 14.84, 40.82, 7.03] },
  { key: 'pensamientos_sur', hit: [7.03, 26.17, 10.94, 6.51] },
  { key: 'pensamientos_centro', hit: [21.09, 26.17, 56.64, 6.51] },
  { key: 'pensamientos_norte', hit: [81.05, 26.17, 11.13, 6.51] },
  { key: 'cristo_sur', hit: [7.23, 36.72, 10.74, 14.97] },
  { key: 'cristo_centro', hit: [20.70, 36.72, 57.62, 14.97] },
  { key: 'cristo_norte', hit: [81.05, 36.72, 11.13, 14.97] },
  { key: 'centro_sur', hit: [7.23, 53.91, 10.74, 13.28] },
  { key: 'centro', hit: [20.70, 53.91, 57.42, 13.28] },
  { key: 'centro_norte', hit: [81.05, 53.91, 11.13, 13.28] },
  { key: 'reserva_residencial', hit: [7.23, 69.27, 25.98, 8.20] },
  { key: 'premium', hit: [36.52, 69.27, 41.21, 8.20] },
  { key: 'premium_norte', hit: [81.25, 69.27, 10.94, 8.20] },
  { key: 'reserva_comercial', hit: [7.23, 78.65, 25.98, 5.34] },
  { key: 'playa', hit: [36.52, 78.65, 41.21, 5.34] },
  { key: 'playa_norte', hit: [81.25, 78.65, 10.94, 5.34] },
];

type Box = [number, number, number, number];

// Avenidas/calles: franjas finas (horizontales o verticales) que separan las zonas y también
// funcionan como zona propia (lotes que dan a esa avenida). Mayor z-index que los bloques.
const AVENIDA_OVERLAYS: { key: string; box: Box }[] = [
  { key: 'los_pensamientos', box: [7.23, 32.68, 84.96, 4.04] },
  { key: 'los_alelies', box: [7.23, 51.69, 84.96, 2.21] },
  { key: 'av_interbalnearia', box: [7.23, 67.19, 84.96, 2.08] },
  { key: 'camelias', box: [7.23, 77.47, 84.96, 1.17] },
  { key: 'av_costanera', box: [7.23, 83.98, 84.96, 1.30] },
  { key: 'av2', box: [77.73, 69.27, 3.52, 14.71] },
];

const AVENIDAS: [string, string][] = [
  ['av_costanera', 'Av. Costanera'], ['av2', 'Av. 2'],
  ['av_interbalnearia', 'Av. Interbalnearia'], ['camelias', 'Las Camelias'],
  ['los_pensamientos', 'Los Pensamientos'], ['los_alelies', 'Los Alelies'],
];

interface Props { value: string; onChange: (v: string) => void; }

const box = ([left, top, width, height]: Box) => ({
  left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
});

export const MapaZonas = ({ value, onChange }: Props) => (
  <div className="mapz" data-testid="mapa-zonas">
    <p className="mapz__caption">Mapa de zonificación de Costa del Este — tocá tu zona</p>

    <div className="mapz__imgwrap">
      <img src="/costa-del-este-mapa-zonas.jpg" alt="Mapa de zonificación de Costa del Este" className="mapz__img" />
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
          <div className={`mapz__label ${value === z.key ? 'is-selected' : ''}`} style={box(z.hit)} />
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
      <span className="mapz__avenidas-tag">¿Tu lote da a una avenida o calle principal? También podés elegirla acá:</span>
      <div className="mapz__pills">
        {AVENIDAS.map(([k, l]) => (
          <button
            key={k} type="button"
            className={`mapz__pill ${value === k ? 'is-selected' : ''}`}
            onClick={() => onChange(k)}
            title={NOMBRE[k]}
            data-testid={`mapa-pill-${k}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default MapaZonas;
