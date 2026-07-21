import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MessageSquare, Users } from 'lucide-react';
import { Badge } from '@vera/ui';
import { PERSON_ROLE_LABELS, type PersonListItem } from '@vera/types';
import { usePeople } from '@app/hooks/usePeople';

const relativeContact = (iso?: string | null): string => {
  if (!iso) return 'Sin contacto';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return d.toLocaleDateString('es-AR');
};

const initials = (name: string): string =>
  (name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '·');

export interface PeopleCardsViewProps {
  query: string;
}

/** Vista Tarjetas de Personas (visual). Buscador instantáneo en memoria. */
export const PeopleCardsView = ({ query }: PeopleCardsViewProps) => {
  const navigate = useNavigate();
  const { data = [], isLoading } = usePeople();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      `${p.fullName} ${p.primaryPhone} ${p.primaryEmail} ${p.phones.join(' ')} ${p.emails.join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, query]);

  if (isLoading) return <p className="vera-people__empty">Cargando personas…</p>;
  if (filtered.length === 0)
    return (
      <div className="vera-people__empty" data-testid="people-empty">
        <Users size={26} />
        <p>No hay personas que coincidan con tu búsqueda.</p>
      </div>
    );

  return (
    <>
      <p className="vera-people__count" data-testid="people-count">
        {filtered.length} {filtered.length === 1 ? 'persona' : 'personas'}
      </p>
      <div className="vera-pcards" data-testid="people-cards">
        {filtered.map((p: PersonListItem) => (
          <button
            key={p.id}
            type="button"
            className="vera-pcard"
            data-testid={`person-card-${p.id}`}
            onClick={() => navigate(`/personas/${p.id}`)}
          >
            <div className="vera-pcard__head">
              <span className="vera-pcard__avatar">{initials(p.fullName)}</span>
              <div className="vera-pcard__id">
                <span className="vera-pcard__name">{p.fullName}</span>
                <span className="vera-pcard__contact">{p.primaryPhone || p.primaryEmail || '—'}</span>
              </div>
              <span className={`vera-dot vera-dot--${p.status === 'active' ? 'published' : 'none'}`} />
            </div>
            <div className="vera-pcard__roles">
              {(p.roles || []).slice(0, 3).map((r) => (
                <Badge key={r} tone="muted">{PERSON_ROLE_LABELS[r] ?? r}</Badge>
              ))}
            </div>
            <div className="vera-pcard__meta">
              <span><MessageSquare size={13} /> {p.conversationsCount}</span>
              <span><Building2 size={13} /> {p.propertiesCount}</span>
              <span className="vera-pcard__meta-last">{relativeContact(p.lastContact)}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
};
