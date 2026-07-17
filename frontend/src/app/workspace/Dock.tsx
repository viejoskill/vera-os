import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check } from 'lucide-react';
import { APPS, appById } from './apps-catalog';
import { useDock } from './useDock';

/** Dock personalizable estilo OS: apps favoritas del usuario. Fijar/quitar + persistencia. */
export const Dock = () => {
  const navigate = useNavigate();
  const { pinned, isPinned, toggle } = useDock();
  const [editing, setEditing] = useState(false);

  const open = (id: string) => {
    const app = appById(id);
    if (app?.ready && app.route) navigate(app.route);
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
              <a.icon size={16} /> {a.label}
              {isPinned(a.id) && <Check size={13} className="vera-dock__check" />}
            </button>
          ))}
        </div>
      )}

      <div className="vera-dock__bar">
        {pinned.map((id) => {
          const app = appById(id);
          if (!app) return null;
          return (
            <button
              key={id}
              type="button"
              className="vera-dock__app"
              data-testid={`dock-app-${id}`}
              title={app.ready ? app.label : `${app.label} · Próximamente`}
              onClick={() => open(id)}
            >
              <app.icon size={20} />
              {!app.ready && <span className="vera-dock__soon" />}
              <span className="vera-dock__tip">{app.label}{app.ready ? '' : ' · Próximamente'}</span>
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
