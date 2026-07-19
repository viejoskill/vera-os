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
 * Vera Bot — experiencia de LANZAMIENTO nativa. VERA orquesta el motor de
 * mensajería (Arturito) manteniendo su identidad; no reconstruye la bandeja.
 * Toda la vista consume `useMessaging()`, por lo que cambiar de motor no la toca.
 */
export const VeraBotWorkspace = () => {
  const { provider, launch } = useMessaging();

  return (
    <div className="vera-screen vera-bot" data-testid="vera-bot-workspace">
      <header className="vera-bot__head">
        <div>
          <h1 className="vera-bot__title" data-testid="vera-bot-title">
            Vera Bot
          </h1>
          <p className="vera-muted">
            Tu mensajería, orquestada desde VERA. Un solo lugar para todos tus canales.
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

      <section className="vera-bot__hero" data-testid="vera-bot-launch-card">
        <span className="vera-bot__hero-glow" aria-hidden="true" />
        <div className="vera-bot__hero-tile">
          <BrandIcon brand={provider.brand} fallback={Bot} size={38} alt={provider.name} />
        </div>
        <div className="vera-bot__hero-body">
          <span className="vera-bot__hero-eyebrow">Motor de mensajería</span>
          <h2 className="vera-bot__hero-name">{provider.name}</h2>
          <p className="vera-bot__hero-tagline">{provider.tagline}</p>
          <p className="vera-bot__hero-desc">{provider.description}</p>
          <div className="vera-bot__hero-actions">
            <button
              type="button"
              className="vera-btn vera-btn--primary vera-btn--md"
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
          <p className="vera-muted">
            Capas de contexto e inteligencia sobre el motor, sin reemplazarlo.
          </p>
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
