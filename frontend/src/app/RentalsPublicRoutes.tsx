import { Routes, Route, Navigate } from 'react-router-dom';
import { ReservarPublico } from '@app/public/ReservarPublico';
import { ReservarPropiedad } from '@app/public/ReservarPropiedad';
import { ReservaResultado } from '@app/public/ReservaResultado';

/** Web pública de alquileres temporarios (reservas). Se monta bajo /alquileres (o el
 *  subdominio alquileres.* por compatibilidad). Chunk aparte (React.lazy) para no
 *  inflar el bundle del sitio público institucional. */
const RentalsPublicRoutes = () => (
  <Routes>
    <Route path="/" element={<ReservarPublico />} />
    <Route path="/reservar/:slug" element={<ReservarPropiedad />} />
    <Route path="/pago/resultado" element={<ReservaResultado />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default RentalsPublicRoutes;
