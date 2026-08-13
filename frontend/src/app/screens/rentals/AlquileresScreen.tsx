import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palmtree, Plus, Pencil, ExternalLink, Link2, Check, Users, BedDouble, Bath, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@vera/ui';
import { api, fmtMoney, ESTADOS, type RentalProperty, type Reservation } from './api';
import './rentals.css';

const Badge = ({ estado }: { estado: string }) => {
  const e = ESTADOS[estado] || { label: estado, cls: 'rt-b--muted' };
  return <span className={`rt-b ${e.cls}`}>{e.label}</span>;
};

export const AlquileresScreen = () => {
  const nav = useNavigate();
  const [tab, setTab] = useState<'props' | 'res'>('props');
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [res, setRes] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [filter, setFilter] = useState('');

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

  const changeStatus = async (rid: string, estado: string) => {
    await api.setStatus(rid, estado);
    setRes((s) => s.map((x) => (x.id === rid ? { ...x, estado } : x)));
  };

  const filtered = res.filter((r) => (filter ? r.estado === filter : r.estado !== 'bloqueo'));

  return (
    <div className="vera-screen rt" data-testid="alquileres-screen">
      <header className="rt__head">
        <div>
          <h2 className="rt__title"><Palmtree size={20} /> Alquileres Temporarios</h2>
          <p className="rt__sub">Gestioná tus propiedades de verano, el calendario de disponibilidad y las pre-reservas que entran desde la web.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => nav('/alquileres/nueva')} data-testid="rt-new-property">
          <Plus size={16} /> Nueva propiedad
        </Button>
      </header>

      <div className="rt__tabs">
        <button type="button" className={tab === 'props' ? 'sel' : ''} onClick={() => setTab('props')} data-testid="rt-tab-props">Propiedades ({props.length})</button>
        <button type="button" className={tab === 'res' ? 'sel' : ''} onClick={() => setTab('res')} data-testid="rt-tab-res">Reservas</button>
      </div>

      {loading ? <p className="rt__loading">Cargando…</p> : tab === 'props' ? (
        props.length === 0 ? (
          <div className="rt__empty" data-testid="rt-empty">
            <Palmtree size={30} />
            <p>Todavía no cargaste propiedades. Creá la primera y compartí el link para recibir reservas.</p>
            <Button variant="primary" size="md" onClick={() => nav('/alquileres/nueva')}><Plus size={16} /> Nueva propiedad</Button>
          </div>
        ) : (
          <div className="rt__grid" data-testid="rt-props-grid">
            {props.map((p) => {
              const cover = p.imagenes.find((i) => i.isCover) || p.imagenes[0];
              return (
                <article className="rt-card" key={p.id} data-testid={`rt-card-${p.id}`}>
                  <div className="rt-card__img" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined}>
                    {!cover && <Palmtree size={26} />}
                    <span className={`rt-card__state ${p.activa ? 'on' : 'off'}`}>{p.activa ? 'Publicada' : 'Oculta'}</span>
                  </div>
                  <div className="rt-card__body">
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
        )
      ) : (
        <div data-testid="rt-res-tab">
          <div className="rt__filters">
            {['', 'prereserva', 'confirmada', 'encurso', 'finalizada', 'cancelada'].map((s) => (
              <button type="button" key={s || 'all'} className={filter === s ? 'sel' : ''} onClick={() => setFilter(s)} data-testid={`rt-filter-${s || 'all'}`}>
                {s ? ESTADOS[s].label : 'Activas'}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? <p className="rt__loading">Sin reservas en este estado.</p> : (
            <div className="rt-res" data-testid="rt-res-list">
              {filtered.map((r) => (
                <div className="rt-res__row" key={r.id} data-testid={`rt-res-${r.id}`}>
                  <div className="rt-res__main">
                    <strong>{r.huesped.nombre || 'Sin nombre'}</strong>
                    <span className="rt-res__prop">{r.propertyTitulo}</span>
                  </div>
                  <div className="rt-res__dates">{r.checkIn} → {r.checkOut} · {r.noches} noches</div>
                  <div className="rt-res__meta">
                    <span>{fmtMoney(r.montoEstimado, r.moneda)}</span>
                    {r.origen && <span className="rt-res__origin">{r.origen}</span>}
                    <Badge estado={r.estado} />
                  </div>
                  <div className="rt-res__acts">
                    {r.estado === 'prereserva' && (
                      <>
                        <button type="button" className="rt-mini rt-mini--ok" onClick={() => changeStatus(r.id, 'confirmada')} data-testid={`rt-confirm-${r.id}`}><CheckCircle2 size={15} /> Confirmar</button>
                        <button type="button" className="rt-mini rt-mini--no" onClick={() => changeStatus(r.id, 'cancelada')} data-testid={`rt-cancel-${r.id}`}><XCircle size={15} /> Rechazar</button>
                      </>
                    )}
                    {r.estado === 'confirmada' && (
                      <button type="button" className="rt-mini rt-mini--no" onClick={() => changeStatus(r.id, 'cancelada')} data-testid={`rt-cancel-${r.id}`}><XCircle size={15} /> Cancelar</button>
                    )}
                    {r.huesped.telefono && (
                      <a className="rt-mini" href={`https://wa.me/${(r.huesped.telefono || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid={`rt-wa-${r.id}`}>WhatsApp</a>
                    )}
                  </div>
                  {r.huesped.comentario && <p className="rt-res__note">“{r.huesped.comentario}”</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlquileresScreen;
