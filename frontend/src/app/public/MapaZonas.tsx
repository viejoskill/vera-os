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

// Coordenadas (%) recortadas a mano sobre la foto real del plano de Costa del Este, ya
// restyleada en amarillo/gris con marco (public/costa-del-este-mapa-zonas.jpg, 1211×1680px).
const OVERLAYS: { key: string; left: number; top: number; width: number; height: number; avenida?: boolean }[] = [
  { key: 'comercial_ruta', left: 52.44, top: 8.04, width: 22.3, height: 6.25 },
  { key: 'pensamientos_sur', left: 14.04, top: 14.29, width: 12.3, height: 8.63 },
  { key: 'pensamientos_centro', left: 44.59, top: 14.29, width: 16.6, height: 8.63 },
  { key: 'pensamientos_norte', left: 61.19, top: 14.29, width: 29.23, height: 8.63 },
  { key: 'cristo_sur', left: 14.04, top: 22.92, width: 12.3, height: 16.37 },
  { key: 'cristo_centro', left: 26.34, top: 22.92, width: 34.85, height: 16.37 },
  { key: 'cristo_norte', left: 61.19, top: 22.92, width: 29.23, height: 16.37 },
  { key: 'alelies', left: 14.04, top: 39.29, width: 76.38, height: 4.82 },
  { key: 'centro_sur', left: 14.04, top: 44.11, width: 12.3, height: 13.45 },
  { key: 'centro', left: 26.34, top: 44.11, width: 34.85, height: 13.45 },
  { key: 'centro_norte', left: 61.19, top: 44.11, width: 29.23, height: 13.45 },
  { key: 'reserva_residencial', left: 5.78, top: 60.54, width: 28.9, height: 12.86 },
  { key: 'premium', left: 34.68, top: 60.54, width: 45.42, height: 12.86 },
  { key: 'reserva_multif', left: 5.78, top: 73.39, width: 28.9, height: 7.56 },
  { key: 'playa', left: 34.68, top: 73.39, width: 45.42, height: 7.56 },
  // Avenidas/calles: van arriba de las zonas (mayor z-index), tal como las resalta el plano real.
  { key: 'av_interbalnearia', left: 5.78, top: 56.85, width: 88.44, height: 3.69, avenida: true },
  { key: 'camelias', left: 5.78, top: 72.02, width: 88.44, height: 2.38, avenida: true },
  { key: 'av_costanera', left: 5.78, top: 78.87, width: 88.44, height: 2.38, avenida: true },
  { key: 'av2', left: 66.06, top: 57.56, width: 3.3, height: 23.39, avenida: true },
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
