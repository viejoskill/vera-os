export const ZONAS_TASADOR: [string, string][] = [
  ['pensamientos_sur', 'Zona Pensamientos Sur'], ['pensamientos_centro', 'Zona Pensamientos Centro'], ['pensamientos_norte', 'Zona Pensamientos Norte'],
  ['cristo_sur', 'Zona Cristo Sur'], ['cristo_centro', 'Zona Cristo Centro'], ['cristo_norte', 'Zona Cristo Norte'],
  ['alelies', 'Zona Alelies'],
  ['centro_sur', 'Zona Centro Sur'], ['centro', 'Zona Centro'], ['centro_norte', 'Zona Centro Norte'],
  ['reserva_residencial', 'La Reserva Residencial'], ['premium', 'Zona Premium'],
  ['reserva_multif', 'La Reserva Multif.'], ['playa', 'Zona Playa'],
  ['comercial_ruta', 'Zona Comercial (Ruta)'],
  ['av_costanera', 'Av. Costanera'], ['av2', 'Av. 2'], ['av_interbalnearia', 'Av. Interbalnearia'], ['camelias', 'Calle Camelias'],
];

const NOMBRE: Record<string, string> = Object.fromEntries(ZONAS_TASADOR);

// Coordenadas (%) recortadas a mano sobre la foto real del plano de Costa del Este
// (public/costa-del-este-mapa-zonas.jpg, 1131×1600px). Cada celda es un overlay
// transparente clickeable sobre la zona real dibujada en la imagen.
const OVERLAYS: { key: string; left: number; top: number; width: number; height: number; avenida?: boolean }[] = [
  { key: 'comercial_ruta', left: 52.6, top: 5.9, width: 23.9, height: 6.6 },
  { key: 'pensamientos_sur', left: 11.5, top: 12.5, width: 13.2, height: 9.1 },
  { key: 'pensamientos_centro', left: 44.2, top: 12.5, width: 17.8, height: 9.1 },
  { key: 'pensamientos_norte', left: 62.0, top: 12.5, width: 31.3, height: 9.1 },
  { key: 'cristo_sur', left: 11.5, top: 21.6, width: 13.2, height: 17.2 },
  { key: 'cristo_centro', left: 24.7, top: 21.6, width: 37.3, height: 17.2 },
  { key: 'cristo_norte', left: 62.0, top: 21.6, width: 31.3, height: 17.2 },
  { key: 'alelies', left: 11.5, top: 38.75, width: 81.8, height: 5.1 },
  { key: 'centro_sur', left: 11.5, top: 43.8, width: 13.2, height: 14.1 },
  { key: 'centro', left: 24.7, top: 43.8, width: 37.3, height: 14.1 },
  { key: 'centro_norte', left: 62.0, top: 43.8, width: 31.3, height: 14.1 },
  { key: 'reserva_residencial', left: 2.65, top: 61.1, width: 31.0, height: 13.5 },
  { key: 'premium', left: 33.6, top: 61.1, width: 48.6, height: 13.5 },
  { key: 'reserva_multif', left: 2.65, top: 74.6, width: 31.0, height: 7.9 },
  { key: 'playa', left: 33.6, top: 74.6, width: 48.6, height: 7.9 },
  // Avenidas/calles: van arriba de las zonas (mayor z-index), tal como las resalta el plano real.
  { key: 'av_interbalnearia', left: 2.65, top: 57.2, width: 94.4, height: 3.9, avenida: true },
  { key: 'camelias', left: 2.65, top: 73.1, width: 94.4, height: 2.5, avenida: true },
  { key: 'av_costanera', left: 2.65, top: 80.3, width: 94.4, height: 2.5, avenida: true },
  { key: 'av2', left: 67.2, top: 57.9, width: 3.5, height: 24.6, avenida: true },
];

const AVENIDAS: [string, string][] = [
  ['av_costanera', 'Av. Costanera'], ['av2', 'Av. 2'],
  ['av_interbalnearia', 'Av. Interbalnearia'], ['camelias', 'Calle Camelias'],
];

interface Props { value: string; onChange: (v: string) => void; }

export const MapaZonas = ({ value, onChange }: Props) => (
  <div className="mapz" data-testid="mapa-zonas">
    <p className="mapz__caption">Plano real de Costa del Este — tocá tu zona</p>

    <div className="mapz__imgwrap">
      <img src="/costa-del-este-mapa-zonas.jpg" alt="Mapa de zonas de Costa del Este" className="mapz__img" />
      {OVERLAYS.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`mapz__overlay ${o.avenida ? 'mapz__overlay--avenida' : ''} ${value === o.key ? 'is-selected' : ''}`}
          style={{ left: `${o.left}%`, top: `${o.top}%`, width: `${o.width}%`, height: `${o.height}%` }}
          onClick={() => onChange(o.key)}
          aria-label={NOMBRE[o.key]}
          data-testid={`mapa-zona-${o.key}`}
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
