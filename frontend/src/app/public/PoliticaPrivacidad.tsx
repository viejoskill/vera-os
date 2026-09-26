const wrap = { background: '#0d0d0d', color: '#e8e8e8', minHeight: '100vh', padding: '48px 20px' };
const box = { maxWidth: 760, margin: '0 auto', lineHeight: 1.7 };
const h1 = { color: '#fbe000', fontSize: 32, marginBottom: 8 };
const h2 = { color: '#fbe000', fontSize: 20, marginTop: 32, marginBottom: 8 };
const muted = { color: '#9a9a9a', fontSize: 14, marginBottom: 32 };

/** Política de privacidad pública — requerida por Meta para publicar la app de WhatsApp Business. */
export const PoliticaPrivacidad = () => (
  <div style={wrap} data-testid="politica-privacidad">
    <div style={box}>
      <h1 style={h1}>Política de Privacidad</h1>
      <p style={muted}>Inmobiliaria Varela — Costa del Este. Última actualización: 2026.</p>

      <p>
        En Inmobiliaria Varela respetamos tu privacidad. Esta política explica qué datos recolectamos
        cuando usás nuestro sitio web, nuestro WhatsApp de atención y nuestro sistema VERA OS, y cómo los usamos.
      </p>

      <h2 style={h2}>1. Qué datos recolectamos</h2>
      <p>
        Nombre, teléfono, email y los mensajes que nos escribís (por WhatsApp, formularios de tasación,
        reserva o contacto), junto con los datos de la propiedad que consultás o publicás con nosotros.
      </p>

      <h2 style={h2}>2. WhatsApp Business</h2>
      <p>
        Usamos la plataforma de WhatsApp Business de Meta para responder tus consultas de forma automática
        y/o a través de nuestro equipo. Las conversaciones se guardan en nuestra base de datos para poder
        dar seguimiento a tu consulta, tasación o reserva.
      </p>

      <h2 style={h2}>3. Para qué usamos tus datos</h2>
      <p>
        Para responder tus consultas, coordinar visitas y reservas, calcular tasaciones, y enviarte
        información relacionada a la propiedad o el trámite que iniciaste. No vendemos tus datos a terceros.
      </p>

      <h2 style={h2}>4. Con quién compartimos tus datos</h2>
      <p>
        Solo con los proveedores necesarios para operar el servicio (por ejemplo, Meta/WhatsApp para el envío
        de mensajes, y proveedores de email/pagos cuando corresponde a una reserva).
      </p>

      <h2 style={h2}>5. Tus derechos</h2>
      <p>
        Podés pedirnos en cualquier momento que te mostremos, corrijamos o eliminemos tus datos, escribiéndonos
        por WhatsApp o al email de contacto de la inmobiliaria.
      </p>

      <h2 style={h2}>6. Contacto</h2>
      <p>Inmobiliaria Varela — Costa del Este. Email: varelavendecde@gmail.com</p>
    </div>
  </div>
);

export default PoliticaPrivacidad;
