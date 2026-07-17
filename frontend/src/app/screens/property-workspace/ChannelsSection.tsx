import { useState } from 'react';
import { Globe, Loader2, RotateCcw, ExternalLink, Link2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { publicationService } from '@vera/services';
import type { PublicationsMap } from '@vera/repositories';
import {
  CHANNELS,
  STATUS_META,
  relativeTime,
  type PublicationStatus,
} from './channels-catalog';

/**
 * Centro de Publicación (Canales de publicación). Tablero que administra DÓNDE está
 * publicada la propiedad. No genera textos (eso vive en Contenido comercial). VERA
 * nunca publica sola: el profesional opera; VERA registra y muestra el estado.
 * Estado en vivo (⏳ Sincronizando → 🟢/🔴) + link directo al aviso por canal.
 */
export const ChannelsSection = ({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: PublicationsMap;
}) => {
  const [pubs, setPubs] = useState<PublicationsMap>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<Record<string, 'publish' | 'update' | 'unpublish'>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState('');

  if (!propertyId) {
    return (
      <p className="vera-muted" data-testid="channels-locked">
        Guardá la propiedad para gestionar sus canales de publicación.
      </p>
    );
  }

  const act = async (
    channel: string,
    action: 'publish' | 'update' | 'unpublish',
    url?: string,
  ) => {
    setBusy(channel);
    setLastAction((m) => ({ ...m, [channel]: action }));
    setPubs((p) => ({ ...p, [channel]: { ...p[channel], status: 'syncing' } }));
    try {
      const next = await publicationService.setPublication(propertyId, channel, action, url);
      setPubs(next);
    } catch {
      setPubs((p) => ({ ...p, [channel]: { ...p[channel], status: 'error' } }));
    } finally {
      setBusy(null);
      setEditing(null);
    }
  };

  const saveLink = (channel: string) => {
    act(channel, 'update', draftUrl.trim());
  };

  return (
    <div className="vera-channels" data-testid="channels-board">
      {CHANNELS.map((ch) => {
        const record = pubs[ch.id];
        const state = (record?.status as PublicationStatus) || 'none';
        const meta = STATUS_META[state] ?? STATUS_META.none;
        const isBusy = busy === ch.id;
        const published = state === 'published';
        const errored = state === 'error';
        const url = record?.url || '';
        return (
          <div key={ch.id} className="vera-channel" data-testid={`channel-${ch.id}`}>
            <div className="vera-channel__id">
              <span className="vera-channel__logo"><Globe size={18} /></span>
              <div>
                <p className="vera-channel__name">{ch.label}</p>
                <span className="vera-channel__status" data-testid={`channel-status-${ch.id}`}>
                  {isBusy ? (
                    <><Loader2 size={13} className="vera-spin" /> Sincronizando</>
                  ) : (
                    <><span className={`vera-dot vera-dot--${meta.dot}`} /> {ch.enabled ? meta.label : 'Próximamente'}</>
                  )}
                </span>
                {published && url && (
                  <a className="vera-channel__link" href={url} target="_blank" rel="noreferrer" data-testid={`view-listing-${ch.id}`}>
                    <ExternalLink size={12} /> Ver aviso
                  </a>
                )}
              </div>
            </div>

            {ch.enabled ? (
              <div className="vera-channel__actions">
                <span className="vera-channel__sync">{published ? relativeTime(record?.lastSync) : ''}</span>
                {errored ? (
                  <Button type="button" variant="secondary" size="sm" disabled={isBusy} data-testid={`retry-${ch.id}`} onClick={() => act(ch.id, lastAction[ch.id] ?? 'publish')}>
                    <RotateCcw size={14} /> Reintentar
                  </Button>
                ) : published ? (
                  <>
                    <button
                      type="button"
                      className="vera-ai-action"
                      data-testid={`link-${ch.id}`}
                      onClick={() => { setEditing(editing === ch.id ? null : ch.id); setDraftUrl(url); }}
                    >
                      <Link2 size={13} /> {url ? 'Editar link' : 'Agregar link'}
                    </button>
                    <Button type="button" variant="ghost" size="sm" disabled={isBusy} data-testid={`update-${ch.id}`} onClick={() => act(ch.id, 'update')}>
                      Actualizar
                    </Button>
                    <Button type="button" variant="secondary" size="sm" disabled={isBusy} data-testid={`unpublish-${ch.id}`} onClick={() => act(ch.id, 'unpublish')}>
                      Despublicar
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="primary" size="sm" disabled={isBusy} data-testid={`publish-${ch.id}`} onClick={() => act(ch.id, 'publish')}>
                    Publicar
                  </Button>
                )}
              </div>
            ) : (
              <span className="vera-channel__soon">Próximamente</span>
            )}

            {editing === ch.id && (
              <div className="vera-channel__linkedit" data-testid={`link-edit-${ch.id}`}>
                <input
                  type="url"
                  className="vera-amenities__search-input"
                  placeholder="Pegá el link del aviso publicado…"
                  data-testid={`link-input-${ch.id}`}
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                />
                <Button type="button" variant="primary" size="sm" data-testid={`link-save-${ch.id}`} onClick={() => saveLink(ch.id)}>
                  Guardar
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
