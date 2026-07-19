import { useState } from 'react';
import { Blocks, SlidersHorizontal } from 'lucide-react';
import { INTEGRATIONS, CATEGORY_LABELS, CATEGORY_ORDER } from './catalog';
import { useIntegrations } from './useIntegrations';
import { IntegrationCard } from './IntegrationCard';
import { PreferencesPanel } from './PreferencesPanel';
import type { IntegrationCategory } from './types';

type Tab = 'integraciones' | 'preferencias';

/** Centro de Integraciones — el hub donde el profesional arma su ecosistema.
 * "VERA orquesta, no reemplaza": cada herramienta conserva su marca; la
 * consistencia la aporta el sistema de diseño. Arturito trae salud real. */
export const IntegrationsScreen = () => {
  const [tab, setTab] = useState<Tab>('integraciones');
  const { stateOf, connect, disconnect, connectedCount, total } = useIntegrations();

  const byCategory = (cat: IntegrationCategory) =>
    INTEGRATIONS.filter((i) => i.category === cat);

  return (
    <div className="vera-screen vera-int" data-testid="integrations-screen">
      <header className="vera-int__head">
        <div>
          <h1 className="vera-int__title" data-testid="integrations-title">Integraciones</h1>
          <p className="vera-muted">
            Conectá tus herramientas y armá tu oficina digital. VERA las orquesta, no las reemplaza.
          </p>
        </div>
        <span className="vera-int__counter" data-testid="integrations-counter">
          {connectedCount}/{total} conectadas
        </span>
      </header>

      <div className="vera-int__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'integraciones'}
          className={`vera-int__tab ${tab === 'integraciones' ? 'is-active' : ''}`}
          data-testid="tab-integraciones"
          onClick={() => setTab('integraciones')}
        >
          <Blocks size={15} /> Integraciones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preferencias'}
          className={`vera-int__tab ${tab === 'preferencias' ? 'is-active' : ''}`}
          data-testid="tab-preferencias"
          onClick={() => setTab('preferencias')}
        >
          <SlidersHorizontal size={15} /> Preferencias
        </button>
      </div>

      {tab === 'integraciones' ? (
        <div className="vera-int__body" data-testid="integrations-body">
          {CATEGORY_ORDER.map((cat) => {
            const items = byCategory(cat);
            if (!items.length) return null;
            return (
              <section key={cat} className="vera-int__group">
                <h3 className="vera-int__group-title">{CATEGORY_LABELS[cat]}</h3>
                <div className="vera-int__grid">
                  {items.map((integration) => (
                    <IntegrationCard
                      key={integration.key}
                      integration={integration}
                      state={stateOf(integration.key)}
                      onConnect={connect}
                      onDisconnect={disconnect}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <PreferencesPanel />
      )}
    </div>
  );
};

export default IntegrationsScreen;
