import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palmtree, Plus, Pencil, ExternalLink, Link2, Check, Users, BedDouble, Bath, XCircle, Building2, Search, X, SlidersHorizontal, Trash2, KeyRound, Radio } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, fmtDate, displayEstado, reservaBucket, type RentalProperty, type Reservation, type SaleProperty, type RentalSettings } from './api';
import { CobrarSena } from './CobrarSena';
import { ConfirmarReserva } from './ConfirmarReserva';
import { RechazarReserva } from './RechazarReserva';
import { EditarHuesped } from './EditarHuesped';
import { WhatsappReserva } from './WhatsappReserva';
import { Comprobantes } from './Comprobantes';
import { CobrarSaldo } from './CobrarSaldo';
import { DocsReserva } from './DocsReserva';
import { AvisoPendientes } from './AvisoPendientes';
import { ReservaSemaforo } from './Semaforo';
import { RentalBotInbox } from './RentalBotInbox';
import { DigestSummaryCard } from './DigestSummaryCard';
import { AudioWidget } from '@app/workspace/widgets';
import './rentals.css';

const Badge = ({ reserva }: { reserva: Reservation }) => {
  const e = displayEstado(reserva);
  return <span className={`rt-b ${e.cls}`}>{e.label}</span>;
};

export const AlquileresScreen = () => {
  const nav = useNavigate();
  const [tab, setTab] = useState<'props' | 'res' | 'bot'>(() => (new URLSearchParams(window.location.search).get('tab') === 'bot' ? 'bot' : 'props'));
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [res, setRes] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [filter, setFilter] = useState('confirmada');
  const [showImport, setShowImport] = useState(false);
  const [salePropsList, setSalePropsList] = useState<SaleProperty[] | null>(null);
  const [saleQuery, setSaleQuery] = useState('');
  const [importing, setImporting] = useState('');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState<Reservation | null>(null);
  const [rejecting, setRejecting] = useState<Reservation | null>(null);
  const [editingHuesped, setEditingHuesped] = useState<Reservation | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RentalSettings>({ condicionesGenerales: [], avisoValidez: '' });
  const [condText, setCondText] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = async () => {
    setLoading(true);
    const [p, r] = await Promise.all([api.listProperties(), api.listReservations()]);
    setProps(p); setRes(r); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const copyLink = async (slug: string, ml = false) => {
    const url = `${window.location.origin}/reservar/${slug}${ml ? '?origen=ml' : ''}`;
    try { await navigator.clipboard.writeText(url); setCopied(slug + ml); setTimeout(() => setCopied(''), 2200); }
    catch { window.open(url, '_blank'); }
  };

  const removeReserva = async (rid: string) => {
    if (!window.confirm('¿Eliminar esta reserva de la lista? No se puede deshacer.')) return;
    await api.deleteReservation(rid);
    setRes((s) => s.filter((x) => x.id !== rid));
  };

  const finalizarReserva = async (rid: string) => {
    if (!window.confirm('¿Marcar esta reserva como finalizada? Saldrá de "Confirmadas" y quedará en "Finalizadas".')) return;
    await api.setStatus(rid, 'finalizada');
    await load();
  };

  const reabrirReserva = async (rid: string) => {
    await api.setStatus(rid, 'confirmada');
    await load();
  };

  const openImport = async () => {
    setShowImport(true); setSalePropsList(null);
    try { setSalePropsList(await api.saleProperties()); } catch { setSalePropsList([]); }
  };
  const searchSale = async () => {
    setSalePropsList(null);
    try { setSalePropsList(await api.saleProperties(saleQuery)); } catch { setSalePropsList([]); }
  };
  const doImport = async (saleId: string) => {
    setImporting(saleId);
    try { const p = await api.importSale(saleId); nav(`/alquileres/${p.id}`); }
    catch (e) { alert((e as Error).message); setImporting(''); }
  };

  const filtered = res.filter((r) => reservaBucket(r) === filter);
  const countBucket = (b: string) => res.filter((r) => reservaBucket(r) === b).length;

  const openSettings = async () => {
    setShowSettings(true);
    try { const s = await api.getSettings(); setSettings(s); setCondText((s.condicionesGenerales || []).join('\n')); }
    catch { /* noop */ }
  };
  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const s = await api.updateSettings({ condicionesGenerales: condText.split('\n').map((c) => c.trim()).filter(Boolean), avisoValidez: settings.avisoValidez, whatsappAgencia: settings.whatsappAgencia });
      setSettings(s); setShowSettings(false);
    } finally { setSavingSettings(false); }
  };

  return (
    <div className="vera-screen rt" data-testid="alquileres-screen">
      <header className="rt__head">
        <div>
          <h2 className="rt__title"><Palmtree size={20} /> Alquileres Temporarios</h2>
          <p className="rt__sub">Gestioná tus propiedades de verano, el calendario de disponibilidad y las pre-reservas que entran desde la web.</p>
        </div>
        <div className="rt__head-actions">
          <Button variant="ghost" size="md" onClick={openSettings} data-testid="rt-settings-open">
            <SlidersHorizontal size={16} /> Condiciones generales
          </Button>
          <Button variant="ghost" size="md" onClick={() => window.open('/reservar', '_blank')} data-testid="rt-open-web">
            <ExternalLink size={16} /> Ver web
          </Button>
          <Button variant="secondary" size="md" onClick={openImport} data-testid="rt-import-open">
            <Building2 size={16} /> Importar de ventas
          </Button>
          <Button variant="primary" size="md" onClick={() => nav('/alquileres/nueva')} data-testid="rt-new-property">
            <Plus size={16} /> Nueva propiedad
          </Button>
        </div>
      </header>

      <AvisoPendientes reservas={res} onVer={() => setTab('res')} />

      {tab !== 'bot' && (
        <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
          <DigestSummaryCard onVerBandeja={() => setTab('bot')} />
          <div className="vera-widget" data-testid="alquileres-radio">
            <div className="vera-widget__head">
              <span className="vera-widget__title"><Radio size={15} /> Radio</span>
            </div>
            <div className="vera-widget__body"><AudioWidget /></div>
          </div>
        </div>
      )}

      <div className="rt__tabs">
        <button type="button" className={tab === 'props' ? 'sel' : ''} onClick={() => setTab('props')} data-testid="rt-tab-props">Propiedades ({props.length})</button>
        <button type="button" className={tab === 'res' ? 'sel' : ''} onClick={() => setTab('res')} data-testid="rt-tab-res">
          Reservas
          {res.filter((r) => r.estado === 'prereserva').length > 0 && (
            <span className="rt-tabbadge" data-testid="rt-pending-badge">{res.filter((r) => r.estado === 'prereserva').length}</span>
          )}
        </button>
        <button type="button" className={tab === 'bot' ? 'sel' : ''} onClick={() => setTab('bot')} data-testid="rt-tab-bot">Bandeja del bot</button>
      </div>

      {tab === 'bot' ? (
        <RentalBotInbox />
      ) : loading ? <p className="rt__loading">Cargando…</p> : tab === 'props' ? (
        props.length === 0 ? (
          <div className="rt__empty" data-testid="rt-empty">
            <Palmtree size={30} />
            <p>Todavía no cargaste propiedades. Creá la primera y compartí el link para recibir reservas.</p>
            <Button variant="primary" size="md" onClick={() => nav('/alquileres/nueva')}><Plus size={16} /> Nueva propiedad</Button>
          </div>
        ) : (
          <>
            <div className="rt__searchbar">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código (A294), título o dirección…" data-testid="rt-search" />
            </div>
            <div className="rt__grid" data-testid="rt-props-grid">
              {props.filter((p) => {
                const t = q.trim().toLowerCase();
                if (!t) return true;
                return [p.codigo, p.titulo, p.direccion].some((v) => (v || '').toLowerCase().includes(t));
              }).map((p) => {
              const cover = p.imagenes.find((i) => i.isCover) || p.imagenes[0];
              return (
                <article className="rt-card" key={p.id} data-testid={`rt-card-${p.id}`}>
                  <div className="rt-card__img" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined}>
                    {!cover && <Palmtree size={26} />}
                    <span className={`rt-card__state ${p.activa ? 'on' : 'off'}`}>{p.activa ? 'Publicada' : 'Oculta'}</span>
                    {p.numeroLlave != null && (
                      <span
                        data-testid={`rt-key-${p.id}`}
                        style={{
                          position: 'absolute', left: 8, bottom: 8, display: 'inline-flex', alignItems: 'center',
                          gap: 4, padding: '3px 9px', borderRadius: 999, background: 'rgba(28,28,28,0.82)',
                          color: '#F6E63A', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(6px)',
                          border: '1px solid rgba(246,230,58,0.35)',
                        }}
                      >
                        <KeyRound size={12} /> Llave A{p.numeroLlave}
                      </span>
                    )}
                  </div>
                  <div className="rt-card__body">
                    {p.codigo && <span className="rt-card__code" data-testid={`rt-code-${p.id}`}>Cód. {p.codigo}</span>}
                    <h3>{p.titulo}</h3>
                    <p className="rt-card__addr">{p.direccion || p.localidad}</p>
                    <div className="rt-card__specs">
                      <span><Users size={14} /> {p.capacidad}</span>
                      <span><BedDouble size={14} /> {p.dormitorios}</span>
                      <span><Bath size={14} /> {p.banos}</span>
                    </div>
                    <p className="rt-card__price">{fmtMoney(p.precioNoche, p.moneda)} <em>/ noche</em></p>
                    <div className="rt-card__actions">
                      <Button variant="secondary" size="sm" onClick={() => nav(`/alquileres/${p.id}`)} data-testid={`rt-edit-${p.id}`}><Pencil size={14} /> Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/reservar/${p.slug}`, '_blank')} data-testid={`rt-view-${p.id}`}><ExternalLink size={14} /> Ver web</Button>
                      <Button variant="ghost" size="sm" onClick={() => copyLink(p.slug, true)} data-testid={`rt-mllink-${p.id}`}>
                        {copied === p.slug + true ? <><Check size={14} /> Copiado</> : <><Link2 size={14} /> Link ML</>}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          </>
        )
      ) : (
        <div data-testid="rt-res-tab">
          <div className="rt__filters">
            {([['prereserva', 'Pre-reservas'], ['esperando', 'Esperando seña'], ['confirmada', 'Confirmadas'], ['finalizada', 'Finalizadas'], ['cancelada', 'Canceladas']] as [string, string][]).map(([s, label]) => {
              const n = countBucket(s);
              const alerta = s === 'prereserva' || s === 'esperando';
              return (
                <button type="button" key={s} className={filter === s ? 'sel' : ''} onClick={() => setFilter(s)} data-testid={`rt-filter-${s}`}>
                  {label}
                  {n > 0 && <span className={alerta ? 'rt-tabbadge' : 'rt-tabcount'} data-testid={`rt-count-${s}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? <p className="rt__loading">No hay reservas en esta solapa.</p> : (
            <div className="rt-res" data-testid="rt-res-list">
              {filtered.map((r) => (
                <div className="rt-res__row" key={r.id} data-testid={`rt-res-${r.id}`}>
                  <div className="rt-res__main">
                    <strong>{r.huesped.nombre || 'Sin nombre'}</strong>
                    <span className="rt-res__prop">{r.propertyTitulo}</span>
                  </div>
                  <div className="rt-res__dates">{fmtDate(r.checkIn)} → {fmtDate(r.checkOut)} · {r.noches} noches</div>
                  <div className="rt-res__meta">
                    <span className="rt-res__monto">{fmtMoney(r.montoEstimado, r.moneda)}</span>
                    {r.origen && <span className="rt-res__origin">{r.origen}</span>}
                    <Badge reserva={r} />
                    <ReservaSemaforo reserva={r} />
                  </div>
                  <div className="rt-res__acts">
                    {r.estado === 'prereserva' && (
                      <>
                        <button type="button" className="rt-mini rt-mini--ok" onClick={() => setConfirming(r)} data-testid={`rt-confirm-${r.id}`}>Confirmar</button>
                        <button type="button" className="rt-mini rt-mini--no" onClick={() => setRejecting(r)} data-testid={`rt-cancel-${r.id}`}><XCircle size={15} /> Rechazar</button>
                      </>
                    )}
                    {r.estado === 'confirmada' && (
                      <button type="button" className="rt-mini rt-mini--no" onClick={() => setRejecting(r)} data-testid={`rt-cancel-${r.id}`}><XCircle size={15} /> Cancelar</button>
                    )}
                    {r.huesped.telefono && <WhatsappReserva reserva={r} />}
                    {r.estado === 'confirmada' && <CobrarSena reserva={r} onUpdated={load} />}
                    <CobrarSaldo reserva={r} onUpdated={load} />
                    <DocsReserva reserva={r} />
                    <Comprobantes reserva={r} onUpdated={load} />
                    <button type="button" className="rt-mini" onClick={() => setEditingHuesped(r)} data-testid={`rt-edit-huesped-${r.id}`}><Pencil size={14} /> Editar datos</button>
                    {r.estado === 'confirmada' && (
                      <button type="button" className="rt-mini" onClick={() => finalizarReserva(r.id)} data-testid={`rt-finalizar-${r.id}`}>Finalizar</button>
                    )}
                    {r.estado === 'finalizada' && (
                      <button type="button" className="rt-mini" onClick={() => reabrirReserva(r.id)} data-testid={`rt-reabrir-${r.id}`}>Reabrir</button>
                    )}
                    {(r.estado === 'cancelada' || r.estado === 'finalizada') && (
                      <button type="button" className="rt-mini rt-mini--del" onClick={() => removeReserva(r.id)} data-testid={`rt-delres-${r.id}`}><Trash2 size={14} /> Eliminar</button>
                    )}
                  </div>
                  {r.huesped.comentario && <p className="rt-res__note">“{r.huesped.comentario}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showImport && (
        <div className="rt-modal" data-testid="rt-import-modal" onClick={() => setShowImport(false)}>
          <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal__head">
              <h3><Building2 size={18} /> Importar desde el CRM de ventas</h3>
              <button type="button" onClick={() => setShowImport(false)} data-testid="rt-import-close"><X size={18} /></button>
            </div>
            <p className="rt-modal__sub">Traé una propiedad que ya tenés en venta y se crea como alquiler (fotos y datos incluidos). Queda <strong>oculta</strong> hasta que le pongas precio y la publiques.</p>
            <div className="rt-modal__search">
              <input placeholder="Buscar por título, dirección o barrio…" value={saleQuery}
                onChange={(e) => setSaleQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchSale()} data-testid="rt-import-search" />
              <Button variant="secondary" size="sm" onClick={searchSale}><Search size={15} /> Buscar</Button>
            </div>
            <div className="rt-modal__list" data-testid="rt-import-list">
              {salePropsList === null ? <p className="rt__loading">Cargando propiedades de venta…</p> :
                salePropsList.length === 0 ? <p className="rt__loading">No se encontraron propiedades.</p> :
                salePropsList.map((s) => (
                  <div className="rt-sale" key={s.id} data-testid={`rt-sale-${s.id}`}>
                    <div className="rt-sale__img" style={s.cover ? { backgroundImage: `url(${s.cover})` } : undefined}>{!s.cover && <Building2 size={20} />}</div>
                    <div className="rt-sale__info">
                      <strong>{s.titulo}</strong>
                      <span>{s.direccion || s.localidad} · {s.dormitorios} dorm · {s.banos} baños · {s.fotos} fotos</span>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => doImport(s.id)} disabled={!!importing} data-testid={`rt-import-${s.id}`}>
                      {importing === s.id ? 'Importando…' : 'Importar'}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      {confirming && (
        <ConfirmarReserva reserva={confirming} onClose={() => setConfirming(null)}
          onConfirmed={async () => { setConfirming(null); await load(); }} />
      )}

      {rejecting && (
        <RechazarReserva reserva={rejecting} onClose={() => setRejecting(null)}
          onDone={async () => { setRejecting(null); await load(); }} />
      )}

      {editingHuesped && (
        <EditarHuesped reserva={editingHuesped} onClose={() => setEditingHuesped(null)}
          onDone={() => { setEditingHuesped(null); load(); }} />
      )}

      {showSettings && (
        <div className="rt-modal" data-testid="rt-settings-modal" onClick={() => setShowSettings(false)}>
          <div className="rt-modal__box" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modal__head">
              <h3><SlidersHorizontal size={18} /> Condiciones generales</h3>
              <button type="button" onClick={() => setShowSettings(false)} data-testid="rt-settings-close"><X size={18} /></button>
            </div>
            <p className="rt-modal__sub">Estas condiciones aplican a <strong>todas</strong> las propiedades y se muestran al huésped antes de enviar la pre-reserva, junto con las condiciones propias de cada casa.</p>
            <label className="rt-field"><span>Condiciones generales (una por línea)</span>
              <textarea rows={6} value={condText} onChange={(e) => setCondText(e.target.value)} placeholder={'Se requiere seña para confirmar la reserva\nEl saldo se abona al ingresar\nSe cobra depósito en garantía reintegrable'} data-testid="rt-settings-cond" /></label>
            <label className="rt-field"><span>WhatsApp de la inmobiliaria (para que el huésped avise el pago)</span>
              <input type="text" value={settings.whatsappAgencia || ''} onChange={(e) => setSettings({ ...settings, whatsappAgencia: e.target.value })} placeholder="Ej.: +54 9 2257 40-4000" data-testid="rt-settings-wa" /></label>
            <div className="rt-modal__foot">
              <Button variant="ghost" size="md" onClick={() => setShowSettings(false)}>Cancelar</Button>
              <Button variant="primary" size="md" onClick={saveSettings} disabled={savingSettings} data-testid="rt-settings-save">{savingSettings ? 'Guardando…' : 'Guardar condiciones'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlquileresScreen;
