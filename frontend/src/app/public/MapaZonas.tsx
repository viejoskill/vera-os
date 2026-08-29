import { Waves, Droplets } from 'lucide-react';

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

const AVENIDAS: [string, string][] = [
  ['av_costanera', 'Av. Costanera'], ['av2', 'Av. 2'],
  ['av_interbalnearia', 'Av. Interbalnearia'], ['camelias', 'Calle Camelias'],
];

interface Props { value: string; onChange: (v: string) => void; }

const Celda = ({ zk, label, value, onChange, flex, fina }: {
  zk: string; label: string; value: string; onChange: (v: string) => void; flex?: number; fina?: boolean;
}) => (
  <button
    type="button"
    className={`mapz__celda ${fina ? 'mapz__celda--fina' : ''} ${value === zk ? 'is-selected' : ''}`}
    style={flex ? { flex } : undefined}
    onClick={() => onChange(zk)}
    data-testid={`mapa-zona-${zk}`}
  >
    {label}
  </button>
);

export const MapaZonas = ({ value, onChange }: Props) => (
  <div className="mapz" data-testid="mapa-zonas">
    <p className="mapz__caption">Ruta 11 · acceso principal</p>

    <div className="mapz__grid">
      <div className="mapz__fila">
        <Celda zk="comercial_ruta" label="Zona Comercial (Ruta)" value={value} onChange={onChange} fina />
      </div>
      <div className="mapz__fila">
        <Celda zk="pensamientos_sur" label="Pensamientos Sur" value={value} onChange={onChange} />
        <div className="mapz__lago" data-testid="mapa-lago"><Droplets size={12} /> Lago</div>
        <Celda zk="pensamientos_centro" label="Pensamientos Centro" value={value} onChange={onChange} />
        <Celda zk="pensamientos_norte" label="Pensamientos Norte" value={value} onChange={onChange} />
      </div>
      <div className="mapz__fila">
        <Celda zk="cristo_sur" label="Cristo Sur" value={value} onChange={onChange} />
        <Celda zk="cristo_centro" label="Cristo Centro" value={value} onChange={onChange} flex={1.4} />
        <Celda zk="cristo_norte" label="Cristo Norte" value={value} onChange={onChange} />
      </div>
      <div className="mapz__fila">
        <Celda zk="alelies" label="Zona Alelies" value={value} onChange={onChange} fina />
      </div>
      <div className="mapz__fila">
        <Celda zk="centro_sur" label="Centro Sur" value={value} onChange={onChange} />
        <Celda zk="centro" label="Centro" value={value} onChange={onChange} />
        <Celda zk="centro_norte" label="Centro Norte" value={value} onChange={onChange} />
      </div>
      <div className="mapz__fila">
        <Celda zk="reserva_residencial" label="La Reserva Residencial" value={value} onChange={onChange} />
        <Celda zk="premium" label="Zona Premium" value={value} onChange={onChange} flex={1.3} />
      </div>
      <div className="mapz__fila">
        <Celda zk="reserva_multif" label="La Reserva Multif." value={value} onChange={onChange} />
        <Celda zk="playa" label="Zona Playa" value={value} onChange={onChange} flex={1.3} />
      </div>
    </div>

    <p className="mapz__caption mapz__caption--mar"><Waves size={13} /> Costa / Playa</p>

    <div className="mapz__avenidas">
      <span className="mapz__avenidas-tag">¿Tu lote da a una avenida o calle principal?</span>
      <div className="mapz__pills">
        {AVENIDAS.map(([k, l]) => (
          <button
            key={k} type="button"
            className={`mapz__pill ${value === k ? 'is-selected' : ''}`}
            onClick={() => onChange(k)}
            data-testid={`mapa-zona-${k}`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default MapaZonas;
