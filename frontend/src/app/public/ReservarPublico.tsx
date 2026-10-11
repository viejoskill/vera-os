import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BedDouble, Bath, Palmtree, MapPin, Play, List, Map as MapIcon } from 'lucide-react';
import { api, fmtMoney, type RentalProperty } from '@app/screens/rentals/api';
import { ListingsMap } from './ListingsMap';
import '@app/screens/rentals/rentals.css';

export const ReservarPublico = () => {
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');

  useEffect(() => { api.publicList().then((p) => { setProps(p); setLoading(false); }).catch(() => setLoading(false)); }, []);

  const mapListings = useMemo(() => props.map((p) => {
    const cover = p.imagenes.find((i) => i.isCover) || p.imagenes[0];
    return {
      id: p.slug, title: p.titulo, operation: 'alquiler', price: p.precioNoche, currency: p.moneda,
      city: p.localidad || '', neighborhood: p.direccion || '', coverImage: cover?.url || '',
      latitude: p.latitude, longitude: p.longitude,
    };
  }), [props]);

  return (
    <div className="rt-pub" data-testid="reservar-publico">
      <header className="rt-pub__hero">
        <img src="/varela-logo-brand.png" alt="Varela Propiedades" className="rt-pub__logo" />
        <h1>Alquileres de <em>verano</em> en Costa del Este</h1>
        <p>Elegí tu propiedad, mirá la disponibilidad y reservá online. Coordinamos todo con vos.</p>
      </header>

      {!loading && props.length > 0 && (
        <p className="vera-pub__found" data-testid="rt-pub-count">
          {props.length} propiedades encontradas
          <span className="vera-pub__viewtoggle" data-testid="rt-pub-view-toggle">
            <button
              type="button"
              className={vista === 'lista' ? 'is-active' : ''}
              onClick={() => setVista('lista')}
              data-testid="rt-pub-view-toggle-lista"
            >
              <List size={14} /> Ver en lista
            </button>
            <button
              type="button"
              className={vista === 'mapa' ? 'is-active' : ''}
              onClick={() => setVista('mapa')}
              data-testid="rt-pub-view-toggle-mapa"
            >
              <MapIcon size={14} /> Ver en mapa
            </button>
          </span>
        </p>
      )}

      {loading ? <p className="rt-pub__loading">Cargando propiedades…</p> : props.length === 0 ? (
        <p className="rt-pub__loading">Pronto vas a ver acá nuestras propiedades disponibles.</p>
      ) : vista === 'mapa' ? (
        <div className="vera-pub__mapwrap">
          <ListingsMap listings={mapListings} getHref={(slug) => `/reservar/${slug}`} />
        </div>
      ) : (
        <div className="rt-pub__grid" data-testid="rt-pub-grid">
          {props.map((p) => {
            const cover = p.imagenes.find((i) => i.isCover) || p.imagenes[0];
            return (
              <Link to={`/reservar/${p.slug}`} className="rt-pub__card" key={p.id} data-testid={`rt-pub-card-${p.slug}`}>
                <div className="rt-pub__img" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined}>{!cover && <Palmtree size={28} />}{(p as { reelUrl?: string }).reelUrl && <span className="vera-pub-card__video"><Play size={11} /> Video</span>}</div>
                <div className="rt-pub__cbody">
                  {p.codigo && <span className="rt-pub__code">{p.codigo}</span>}
                  <h3>{p.titulo}</h3>
                  <p className="rt-pub__addr"><MapPin size={13} /> {p.localidad}</p>
                  <div className="rt-pub__specs"><span><Users size={14} /> {p.capacidad}</span><span><BedDouble size={14} /> {p.dormitorios}</span><span><Bath size={14} /> {p.banos}</span></div>
                  <p className="rt-pub__price">{fmtMoney(p.precioNoche, p.moneda)} <em>/ noche</em></p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <footer className="rt-pub__foot">Varela Propiedades · Costa del Este · Alquileres temporarios</footer>
    </div>
  );
};

export default ReservarPublico;
