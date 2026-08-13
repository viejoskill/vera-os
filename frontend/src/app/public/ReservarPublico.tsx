import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BedDouble, Bath, Palmtree, MapPin } from 'lucide-react';
import { api, fmtMoney, type RentalProperty } from '@app/screens/rentals/api';
import '@app/screens/rentals/rentals.css';

export const ReservarPublico = () => {
  const [props, setProps] = useState<RentalProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.publicList().then((p) => { setProps(p); setLoading(false); }).catch(() => setLoading(false)); }, []);

  return (
    <div className="rt-pub" data-testid="reservar-publico">
      <header className="rt-pub__hero">
        <img src="/varela-logo-brand.png" alt="Varela Propiedades" className="rt-pub__logo" />
        <h1>Alquileres de verano en Costa del Este</h1>
        <p>Elegí tu propiedad, mirá la disponibilidad y reservá online. Coordinamos todo con vos.</p>
      </header>

      {loading ? <p className="rt-pub__loading">Cargando propiedades…</p> : props.length === 0 ? (
        <p className="rt-pub__loading">Pronto vas a ver acá nuestras propiedades disponibles.</p>
      ) : (
        <div className="rt-pub__grid" data-testid="rt-pub-grid">
          {props.map((p) => {
            const cover = p.imagenes.find((i) => i.isCover) || p.imagenes[0];
            return (
              <Link to={`/reservar/${p.slug}`} className="rt-pub__card" key={p.id} data-testid={`rt-pub-card-${p.slug}`}>
                <div className="rt-pub__img" style={cover ? { backgroundImage: `url(${cover.url})` } : undefined}>{!cover && <Palmtree size={28} />}</div>
                <div className="rt-pub__cbody">
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
