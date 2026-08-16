import { useCallback, useEffect, useState } from 'react';
import { DollarSign, Pencil, Trash2, Plus } from 'lucide-react';
import { env } from '@vera/config';

const CONTA = `${env.backendUrl}/api/contabilidad`;
const fmtM = (n: number, m = 'USD') => `${m === 'USD' ? 'US$' : '$'} ${Math.round(n || 0).toLocaleString('es-AR')}`;

interface Venta { id: string; propertyId: string; moneda: string; monto: number; estado: string; }

/** Comisión de la venta, anclada a la propiedad. Naranja mientras está Reservada,
 * verde cuando se marca Vendida (ahí cuenta como ingreso real en Contabilidad). */
export const SaleCommissionSection = ({ propertyId, propertyLabel, status }: {
  propertyId: string; propertyLabel: string; status: string;
}) => {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [editing, setEditing] = useState(false);
  const [moneda, setMoneda] = useState('USD');
  const [monto, setMonto] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`${CONTA}/ventas/by-property/${propertyId}`);
    const d: Venta | null = r.ok ? await r.json() : null;
    setVenta(d);
    if (d) { setMoneda(d.moneda); setMonto(String(d.monto)); }
  }, [propertyId]);

  useEffect(() => { load(); }, [load, status]);

  if (status !== 'reserved' && status !== 'sold' && !venta) return null;

  const save = async () => {
    if (!monto) return;
    await fetch(`${CONTA}/ventas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, propertyLabel, moneda, monto: Number(monto) }),
    });
    setEditing(false);
    await load();
  };
  const del = async () => {
    await fetch(`${CONTA}/ventas/by-property/${propertyId}`, { method: 'DELETE' });
    setVenta(null); setMonto('');
  };

  const conf = status === 'sold';

  return (
    <div className={`vera-salecom vera-salecom--${conf ? 'sold' : 'reserved'}`} data-testid="sale-commission">
      <div className="vera-salecom__head">
        <DollarSign size={16} />
        <span>Comisión de la venta</span>
      </div>

      {venta && !editing ? (
        <div className="vera-salecom__body">
          <span className={`vera-salecom__chip vera-salecom__chip--${conf ? 'sold' : 'reserved'}`} data-testid="sale-commission-chip">
            {fmtM(venta.monto, venta.moneda)} · {conf ? 'confirmada' : 'por confirmar'}
          </span>
          <p className="vera-salecom__note">
            {conf
              ? 'Suma como ingreso de venta en Contabilidad.'
              : 'Queda “por confirmar” (naranja). Al marcar la propiedad como Vendida, se confirma y cuenta en Contabilidad.'}
          </p>
          <div className="vera-salecom__actions">
            <button type="button" className="vera-salecom__mini" data-testid="sale-commission-edit" onClick={() => setEditing(true)}><Pencil size={13} /> Editar</button>
            <button type="button" className="vera-salecom__mini vera-salecom__mini--del" data-testid="sale-commission-del" onClick={del}><Trash2 size={13} /> Quitar</button>
          </div>
        </div>
      ) : venta || editing ? (
        <div className="vera-salecom__form" data-testid="sale-commission-form">
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} data-testid="sale-commission-moneda">
            <option value="USD">USD</option><option value="ARS">ARS</option>
          </select>
          <input type="number" placeholder="Monto de la comisión" value={monto} autoFocus data-testid="sale-commission-monto"
            onChange={(e) => setMonto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          <button type="button" className="vera-salecom__save" data-testid="sale-commission-save" onClick={save}>Guardar</button>
          {venta && <button type="button" className="vera-salecom__mini" onClick={() => setEditing(false)}>Cancelar</button>}
        </div>
      ) : (
        <div className="vera-salecom__form" data-testid="sale-commission-form">
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} data-testid="sale-commission-moneda">
            <option value="USD">USD</option><option value="ARS">ARS</option>
          </select>
          <input type="number" placeholder="Monto de la comisión" value={monto} data-testid="sale-commission-monto"
            onChange={(e) => setMonto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
          <button type="button" className="vera-salecom__save" data-testid="sale-commission-save" onClick={save}><Plus size={14} /> Cargar comisión</button>
        </div>
      )}
    </div>
  );
};
