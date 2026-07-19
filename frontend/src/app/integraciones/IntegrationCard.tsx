import { ArrowUpRight, Plug, Check, RefreshCw, Globe } from 'lucide-react';
import { BrandIcon } from '@vera/ui';
import type { Integration, IntegrationState } from './types';
import { useIntegrationHealth, hostOf } from './useIntegrations';

interface Props {
  integration: Integration;
  state: IntegrationState;
  onConnect: (key: string) => void;
  onDisconnect: (key: string) => void;
  onConfigure?: (key: string) => void;
}

const relativeTime = (iso: string | null): string => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
};

const HEALTH_LABEL: Record<string, string> = {
  operational: 'Operativo',
  degraded: 'Inestable',
  down: 'Sin respuesta',
};

/** Tarjeta de una integración: logo, estado, salud, sync y acciones. */
export const IntegrationCard = ({ integration, state, onConnect, onDisconnect, onConfigure }: Props) => {
  const isReal = integration.healthMode === 'real';
  const isConfigurable = Boolean(integration.configurable);
  const { data: health, isLoading: healthLoading } = useIntegrationHealth(
    integration.key,
    isReal && state.connected,
  );

  const domains = state.config?.domains ?? [];
  const primary = state.config?.primary ?? null;

  const open = () => {
    if (integration.url) window.open(integration.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="vera-int-card" data-testid={`integration-${integration.key}`}>
      <div className="vera-int-card__top">
        <span className="vera-int-card__logo">
          <BrandIcon
            brand={integration.brand}
            fallback={integration.icon}
            size={24}
            alt={integration.name}
            mono={!integration.brandFullColor}
          />
        </span>
        <span
          className={`vera-int-card__status ${state.connected ? 'is-on' : 'is-off'}`}
          data-testid={`integration-status-${integration.key}`}
        >
          <span className="vera-int-card__status-dot" aria-hidden="true" />
          {state.connected ? 'Conectado' : 'No conectado'}
        </span>
      </div>

      <h4 className="vera-int-card__name">{integration.name}</h4>
      <p className="vera-int-card__desc">{integration.description}</p>

      <div className="vera-int-card__meta">
        {isConfigurable && primary && (
          <span className="vera-int-card__sync" data-testid={`integration-primary-${integration.key}`}>
            <Globe size={12} /> {hostOf(primary)}
            {domains.length > 1 && <> · +{domains.length - 1}</>}
          </span>
        )}
        {!isConfigurable && state.connected && (
          <span className="vera-int-card__sync">
            <RefreshCw size={12} /> Sync {relativeTime(state.lastSyncAt)}
          </span>
        )}
        {isReal && state.connected && (
          <span
            className={`vera-int-card__health health--${health?.status ?? 'checking'}`}
            data-testid={`integration-health-${integration.key}`}
          >
            <span className="vera-int-card__health-dot" aria-hidden="true" />
            {healthLoading || !health
              ? 'Comprobando…'
              : `${HEALTH_LABEL[health.status] ?? health.status}${
                  health.status === 'operational' ? ` · ${health.latency_ms} ms` : ''
                }`}
          </span>
        )}
      </div>

      <div className="vera-int-card__actions">
        {isConfigurable ? (
          <button
            type="button"
            className="vera-btn vera-btn--primary vera-btn--sm"
            data-testid={`integration-configure-domains-${integration.key}`}
            onClick={() => onConfigure?.(integration.key)}
          >
            <Globe size={14} /> {domains.length ? 'Gestionar dominios' : 'Configurar dominios'}
          </button>
        ) : state.connected ? (
          <>
            <button
              type="button"
              className="vera-btn vera-btn--secondary vera-btn--sm"
              data-testid={`integration-configure-${integration.key}`}
              onClick={open}
              disabled={!integration.url}
            >
              Configurar <ArrowUpRight size={14} />
            </button>
            <button
              type="button"
              className="vera-btn vera-btn--ghost vera-btn--sm vera-int-card__disconnect"
              data-testid={`integration-disconnect-${integration.key}`}
              onClick={() => onDisconnect(integration.key)}
            >
              Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            className="vera-btn vera-btn--primary vera-btn--sm"
            data-testid={`integration-connect-${integration.key}`}
            onClick={() => onConnect(integration.key)}
          >
            <Plug size={14} /> Conectar
          </button>
        )}
      </div>

      {state.connected && (
        <span className="vera-int-card__check" aria-hidden="true">
          <Check size={13} />
        </span>
      )}
    </article>
  );
};
