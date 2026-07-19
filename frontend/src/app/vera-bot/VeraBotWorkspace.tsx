import {
  ArrowUpRight,
  Bot,
  Globe,
  Mail,
  MessageCircle,
  Instagram,
  Facebook,
  Sparkles,
  Zap,
  Workflow,
  ShieldCheck,
  Link2,
  MessagesSquare,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandIcon } from '@vera/ui';
import type { MessagingChannel } from './types';
import { useMessaging } from './useMessaging';

const CHANNELS: Record<MessagingChannel, { label: string; brand?: string; icon: LucideIcon }> = {
  whatsapp: { label: 'WhatsApp', brand: 'whatsapp', icon: MessageCircle },
  instagram: { label: 'Instagram', brand: 'instagram', icon: Instagram },
  facebook: { label: 'Facebook', brand: 'facebook', icon: Facebook },
  web: { label: 'Chat web', icon: Globe },
  email: { label: 'Email', icon: Mail },
};

/** Lo que hace VERA (la inteligencia, protagonista). */
const VERA_POINTS: { icon: LucideIcon; text: string }[] = [
  { icon: MessagesSquare, text: 'Entiende el contexto de cada conversación' },
  { icon: Users, text: 'Conecta cada mensaje con tus personas y propiedades' },
  { icon: Sparkles, text: 'Sugiere respuestas y el próximo paso — vos decidís' },
];

interface FutureLayer {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}

/** Capas de contexto e inteligencia previstas sobre el motor (sin reemplazarlo). */
const FUTURE_LAYERS: FutureLayer[] = [
  {
    id: 'vera-expert',
    title: 'Vera Expert',
    desc: 'Contexto inmobiliario y sugerencias de respuesta sobre cada conversación.',
    icon: Sparkles,
  },
  {
    id: 'acciones',
    title: 'Acciones rápidas',
    desc: 'Crear persona, vincular propiedad o agendar visita sin salir del chat.',
    icon: Zap,
  },
  {
    id: 'automatizaciones',
    title: 'Automatizaciones',
    desc: 'Disparadores y seguimientos automáticos según la etapa del lead.',
    icon: Workflow,
  },
];

/**
 * Vera Bot — jerarquía explícita: **VERA orquesta la inteligencia; el motor
 * (Arturito) sólo ejecuta la mensajería.** VERA es el protagonista; Arturito es
 * infraestructura conectada. Toda la vista consume `useMessaging()`, por lo que
 * cambiar de motor no toca la UI ni la jerarquía.
 */
export const VeraBotWorkspace = () => {
  const { provider, launch } = useMessaging();

  return (
    <div className="vera-screen vera-bot" data-testid="vera-bot-workspace">
      <header className="vera-bot__head">
        <div>
          <span className="vera-bot__eyebrow">
            <Sparkles size={13} /> Inteligencia de comunicación
          </span>
          <h1 className="vera-bot__title" data-testid="vera-bot-title">
            Vera Bot
          </h1>
          <p className="vera-muted">
            VERA orquesta toda tu comunicación. Un solo lugar, guiado por tu inteligencia.
          </p>
        </div>
        <span
          className={`vera-bot__status ${provider.online ? 'is-online' : 'is-offline'}`}
          data-testid="vera-bot-status"
        >
          <span className="vera-bot__status-dot" aria-hidden="true" />
          VERA {provider.online ? 'ONLINE' : 'OFFLINE'}
        </span>
      </header>

      {/* Protagonista — la inteligencia (VERA) */}
      <section className="vera-bot__vera" data-testid="vera-bot-intelligence">
        <span className="vera-bot__vera-glow" aria-hidden="true" />
        <div className="vera-bot__vera-mark" aria-hidden="true">
          <Sparkles size={30} />
        </div>
        <div className="vera-bot__vera-body">
          <span className="vera-bot__vera-eyebrow">La inteligencia</span>
          <h2 className="vera-bot__vera-title">VERA orquesta tu comunicación</h2>
          <p className="vera-bot__vera-desc">
            VERA lee el contexto de cada conversación, la vincula con tus personas y propiedades, y
            te prepara el próximo paso. La inteligencia es de VERA; el motor sólo ejecuta.
          </p>
          <ul className="vera-bot__vera-points">
            {VERA_POINTS.map((p) => (
              <li key={p.text} className="vera-bot__vera-point">
                <span className="vera-bot__vera-point-icon">
                  <p.icon size={15} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Conector jerárquico */}
      <div className="vera-bot__wire" aria-hidden="true">
        <span className="vera-bot__wire-line" />
        <span className="vera-bot__wire-label">
          <Link2 size={13} /> ejecuta la mensajería a través de
        </span>
        <span className="vera-bot__wire-line" />
      </div>

      {/* Subordinado — el motor conectado (Arturito) */}
      <section className="vera-bot__engine" data-testid="vera-bot-launch-card">
        <div className="vera-bot__engine-tile">
          <BrandIcon
            brand={provider.brand}
            fallback={Bot}
            size={34}
            alt={provider.name}
            mono={!provider.brandFullColor}
          />
        </div>
        <div className="vera-bot__engine-body">
          <span className="vera-bot__engine-eyebrow">
            Motor conectado
            <span className="vera-bot__engine-dot" aria-hidden="true" /> conectado
          </span>
          <h3 className="vera-bot__engine-name">{provider.name}</h3>
          <p className="vera-bot__engine-desc">
            {provider.name} ejecuta el envío y la recepción de mensajes en tus canales. VERA lo
            orquesta por encima.
          </p>

          <div className="vera-bot__channels" data-testid="vera-bot-channels">
            {provider.channels.map((ch) => {
              const c = CHANNELS[ch];
              return (
                <span key={ch} className="vera-bot__channel" data-testid={`channel-${ch}`}>
                  <span className="vera-bot__channel-icon">
                    {c.brand ? (
                      <BrandIcon brand={c.brand} fallback={c.icon} size={15} alt={c.label} />
                    ) : (
                      <c.icon size={15} />
                    )}
                  </span>
                  {c.label}
                </span>
              );
            })}
          </div>

          <div className="vera-bot__engine-actions">
            <button
              type="button"
              className="vera-btn vera-btn--secondary vera-btn--md"
              data-testid="vera-bot-launch"
              onClick={launch}
            >
              Abrir {provider.name}
              <ArrowUpRight size={16} />
            </button>
            <span className="vera-bot__secure" data-testid="vera-bot-secure">
              <ShieldCheck size={14} /> Sesión propia y segura de {provider.name}
            </span>
          </div>
        </div>
      </section>

      <section className="vera-bot__future" data-testid="vera-bot-future">
        <div className="vera-bot__future-head">
          <h3 className="vera-bot__future-title">Lo que VERA sumará por encima</h3>
          <p className="vera-muted">Capas de contexto e inteligencia sobre el motor, sin reemplazarlo.</p>
        </div>
        <div className="vera-bot__future-grid">
          {FUTURE_LAYERS.map((l) => (
            <article key={l.id} className="vera-bot__layer" data-testid={`future-${l.id}`}>
              <span className="vera-bot__layer-icon">
                <l.icon size={17} />
              </span>
              <h4 className="vera-bot__layer-title">
                {l.title}
                <span className="vera-bot__layer-soon">Próximamente</span>
              </h4>
              <p className="vera-bot__layer-desc">{l.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default VeraBotWorkspace;
