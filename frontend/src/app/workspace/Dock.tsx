import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { BrandIcon } from '@vera/ui';
import { APPS, appById } from './apps-catalog';
import { useDock } from './useDock';

/** Dock personalizable estilo OS: HERRAMIENTAS PERSONALES (Gmail, IA, Drive…).
 * Cada una abre su web real en una pestaña nueva. Fijar/quitar + persistencia. */
export const Dock = () => {
  const { pinned, isPinned, toggle } = useDock();
  const [editing, setEditing] = useState(false);

  const open = (id: string) => {
    const tool = appById(id);
    if (tool?.href) window.open(tool.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="vera-dock" data-testid="workspace-dock">
      {editing && (
        <div className="vera-dock__picker" data-testid="dock-picker">
          {APPS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`vera-dock__pick ${isPinned(a.id) ? 'is-on' : ''}`.trim()}
              data-testid={`dock-toggle-${a.id}`}
              onClick={() => toggle(a.id)}
            >
              <BrandIcon brand={a.brand} fallback={a.icon} size={16} mono={!a.fullColor} /> {a.label}
              {isPinned(a.id) && <Check size={13} className="vera-dock__check" />}
            </button>
          ))}
        </div>
      )}

      <div className="vera-dock__bar">
        {pinned.map((id) => {
          const tool = appById(id);
          if (!tool) return null;
          return (
            <button
              key={id}
              type="button"
              className="vera-dock__app"
              data-testid={`dock-app-${id}`}
              title={tool.label}
              onClick={() => open(id)}
            >
              <BrandIcon brand={tool.brand} fallback={tool.icon} size={20} mono={!tool.fullColor} />
              <span className="vera-dock__tip">{tool.label}</span>
            </button>
          );
        })}
        <span className="vera-dock__sep" />
        <button
          type="button"
          className={`vera-dock__app vera-dock__add ${editing ? 'is-on' : ''}`.trim()}
          data-testid="dock-customize"
          onClick={() => setEditing((e) => !e)}
          title="Personalizar Dock"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
