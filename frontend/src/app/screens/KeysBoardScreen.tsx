import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Home, Palmtree, MapPin } from 'lucide-react';
import { env } from '@vera/config';
import { api as rentalsApi, type RentalProperty } from './rentals/api';

interface Sale {
  id: string;
  code?: string;
  title?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  status?: string;
  keyNumber?: number | null;
}

const ACCENT = '#F6E63A';
const fetchSales = (): Promise<Sale[]> =>
  fetch(`${env.backendUrl}/api/properties`).then((r) => r.json());

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

interface SlotData {
  n: number;
  code?: string;
  title?: string;
  place?: string;
  onOpen?: () => void;
}

const Slot = ({ n, code, title, place, onOpen }: SlotData) => {
  const occupied = Boolean(title);
  return (
    <button
      type="button"
      className={`keyslot ${occupied ? 'keyslot--on' : 'keyslot--off'}`}
      onClick={onOpen}
      disabled={!occupied}
      data-testid={`keyslot-${n}`}
      title={occupied ? `${code ? code + ' · ' : ''}${title}` : `Llave ${n} libre`}
    >
      <span className="keyslot__num">
        <KeyRound size={13} /> {n}
      </span>
      {occupied ? (
        <span className="keyslot__body">
          {code && <span className="keyslot__code">{code}</span>}
          <span className="keyslot__title">{title}</span>
          {place && (
            <span className="keyslot__place">
              <MapPin size={11} /> {place}
            </span>
          )}
        </span>
      ) : (
        <span className="keyslot__free">Libre</span>
      )}
    </button>
  );
};

export const KeysBoardScreen = () => {
  const navigate = useNavigate();
  const sales = useQuery({ queryKey: ['keys-sales'], queryFn: fetchSales });
  const rentals = useQuery({ queryKey: ['keys-rentals'], queryFn: rentalsApi.listProperties });

  const salesByKey = useMemo(() => {
    const m = new Map<number, Sale>();
    (sales.data || []).forEach((p) => {
      if (p.keyNumber != null) m.set(Number(p.keyNumber), p);
    });
    return m;
  }, [sales.data]);

  const rentalsByKey = useMemo(() => {
    const m = new Map<number, RentalProperty>();
    (rentals.data || []).forEach((p) => {
      if (p.numeroLlave != null) m.set(Number(p.numeroLlave), p);
    });
    return m;
  }, [rentals.data]);

  const salesCount = salesByKey.size;
  const rentalsCount = rentalsByKey.size;
  const loading = sales.isLoading || rentals.isLoading;

  return (
    <div className="keys-board" data-testid="keys-board">
      <style>{KEYS_CSS}</style>

      <header className="keys-board__head">
        <div className="keys-board__icon"><KeyRound size={22} /></div>
        <div>
          <h1 className="keys-board__title">Tablero de llaves</h1>
          <p className="keys-board__sub">
            Ubicá cualquier llave física de un vistazo. Tocá una llave asignada para abrir su ficha.
          </p>
        </div>
      </header>

      {loading && <p className="keys-board__loading" data-testid="keys-loading">Cargando llaves…</p>}

      {/* VENTAS 1–49 */}
      <section className="keys-section">
        <div className="keys-section__head">
          <span className="keys-section__label"><Home size={16} /> Ventas</span>
          <span className="keys-section__range">Llaves 1 – 49</span>
          <span className="keys-section__count" data-testid="keys-count-ventas">{salesCount} asignadas</span>
        </div>
        <div className="keys-grid">
          {range(1, 49).map((n) => {
            const p = salesByKey.get(n);
            return (
              <Slot
                key={`v-${n}`}
                n={n}
                code={p?.code}
                title={p?.title}
                place={p ? p.neighborhood || p.city || p.address : undefined}
                onOpen={p ? () => navigate(`/propiedades/${p.id}`) : undefined}
              />
            );
          })}
        </div>
      </section>

      {/* ALQUILERES 50–100 */}
      <section className="keys-section">
        <div className="keys-section__head">
          <span className="keys-section__label keys-section__label--rent"><Palmtree size={16} /> Alquileres</span>
          <span className="keys-section__range">Llaves 50 – 100</span>
          <span className="keys-section__count" data-testid="keys-count-alquileres">{rentalsCount} asignadas</span>
        </div>
        <div className="keys-grid">
          {range(50, 100).map((n) => {
            const p = rentalsByKey.get(n);
            return (
              <Slot
                key={`a-${n}`}
                n={n}
                code={p?.codigo}
                title={p?.titulo}
                place={p ? p.direccion || p.localidad : undefined}
                onOpen={p ? () => navigate(`/alquileres/${p.id}`) : undefined}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

const KEYS_CSS = `
.keys-board { padding: 8px 4px 48px; max-width: 1200px; }
.keys-board__head { display:flex; align-items:center; gap:14px; margin-bottom:28px; }
.keys-board__icon { width:46px; height:46px; border-radius:14px; display:grid; place-items:center;
  background: rgba(246,230,58,0.12); color:${ACCENT}; border:1px solid rgba(246,230,58,0.28); }
.keys-board__title { font-size:26px; font-weight:700; margin:0; color:#fff; letter-spacing:-0.02em; }
.keys-board__sub { margin:2px 0 0; color:#9a9a95; font-size:13px; }
.keys-board__loading { color:#9a9a95; font-size:13px; }
.keys-section { margin-bottom:34px; }
.keys-section__head { display:flex; align-items:center; gap:14px; margin-bottom:14px; flex-wrap:wrap; }
.keys-section__label { display:inline-flex; align-items:center; gap:7px; font-weight:700; font-size:15px; color:#fff; }
.keys-section__label--rent { color:#8fe3c4; }
.keys-section__range { font-size:12px; color:#8a8a85; background:rgba(255,255,255,0.05);
  padding:3px 10px; border-radius:999px; }
.keys-section__count { margin-left:auto; font-size:12px; font-weight:600; color:${ACCENT};
  background:rgba(246,230,58,0.1); padding:3px 11px; border-radius:999px; border:1px solid rgba(246,230,58,0.25); }
.keys-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; }
.keyslot { text-align:left; border-radius:14px; padding:11px 12px; min-height:96px; cursor:pointer;
  display:flex; flex-direction:column; gap:8px; font-family:inherit;
  transition: transform .12s ease, border-color .12s ease, background-color .12s ease; }
.keyslot--on { background:#1d1d1b; border:1px solid rgba(246,230,58,0.3); }
.keyslot--on:hover { transform: translateY(-3px); border-color:${ACCENT}; background:#232320; }
.keyslot--off { background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1);
  cursor:default; min-height:96px; }
.keyslot__num { display:inline-flex; align-items:center; gap:5px; font-weight:800; font-size:15px;
  color:#5c5c58; }
.keyslot--on .keyslot__num { color:${ACCENT}; }
.keyslot__body { display:flex; flex-direction:column; gap:3px; overflow:hidden; }
.keyslot__code { font-size:10px; font-weight:700; letter-spacing:0.03em; color:#8a8a85; }
.keyslot__title { font-size:12.5px; font-weight:600; color:#f3f3ef; line-height:1.25;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.keyslot__place { display:flex; align-items:center; gap:4px; font-size:10.5px; color:#8a8a85;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.keyslot__free { font-size:11px; color:#4a4a46; font-weight:500; }
`;
