import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users, MessageSquare, Building2 } from 'lucide-react';
import { Input, Button, Badge } from '@vera/ui';
import { PERSON_ROLE_LABELS, type Person, type PersonListItem } from '@vera/types';
import { usePeople } from '@app/hooks/usePeople';
import { NewPersonModal } from '@app/screens/property-workspace/NewPersonModal';

const relativeContact = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return d.toLocaleDateString('es-AR');
};

/** App Personas — listado maestro de la entidad Persona (VERA Core). Buscador
 * instantáneo por nombre/teléfono/email. Cada fila abre la ficha. */
export const PeopleScreen = () => {
  const navigate = useNavigate();
  const { data = [], isLoading } = usePeople();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((p) =>
      `${p.fullName} ${p.primaryPhone} ${p.primaryEmail} ${p.phones.join(' ')} ${p.emails.join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, query]);

  const onCreated = (person: Person) => navigate(`/personas/${person.id}`);

  return (
    <div className="vera-screen" data-testid="people-screen">
      <div className="vera-toolbar">
        <div className="vera-toolbar__search">
          <Search size={16} className="vera-toolbar__search-icon" />
          <Input
            placeholder="Buscar por nombre, teléfono o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar personas"
            data-testid="people-search-input"
          />
        </div>
        <Button variant="primary" size="md" data-testid="new-person-trigger" onClick={() => setModalOpen(true)}>
          <UserPlus size={16} /> Nueva persona
        </Button>
      </div>

      <p className="vera-people__count" data-testid="people-count">
        {filtered.length} {filtered.length === 1 ? 'persona' : 'personas'}
      </p>

      {isLoading ? (
        <p className="vera-people__empty">Cargando personas…</p>
      ) : filtered.length === 0 ? (
        <div className="vera-people__empty" data-testid="people-empty">
          <Users size={26} />
          <p>No hay personas que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="vera-table" role="table" data-testid="people-table">
          <div className="vera-table__head" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">Teléfono</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Roles</span>
            <span role="columnheader" className="vera-table__num">Últ. contacto</span>
            <span role="columnheader" className="vera-table__num"><MessageSquare size={13} /></span>
            <span role="columnheader" className="vera-table__num"><Building2 size={13} /></span>
            <span role="columnheader" className="vera-table__num">Estado</span>
          </div>
          {filtered.map((p: PersonListItem) => (
            <button
              key={p.id}
              type="button"
              role="row"
              className="vera-table__row"
              data-testid={`person-row-${p.id}`}
              onClick={() => navigate(`/personas/${p.id}`)}
            >
              <span className="vera-table__name" role="cell">{p.fullName}</span>
              <span role="cell">{p.primaryPhone || '—'}</span>
              <span role="cell" className="vera-table__muted">{p.primaryEmail || '—'}</span>
              <span role="cell" className="vera-table__roles">
                {(p.roles || []).slice(0, 3).map((r) => (
                  <Badge key={r} tone="muted">{PERSON_ROLE_LABELS[r] ?? r}</Badge>
                ))}
              </span>
              <span role="cell" className="vera-table__num vera-table__muted">{relativeContact(p.lastContact)}</span>
              <span role="cell" className="vera-table__num">{p.conversationsCount}</span>
              <span role="cell" className="vera-table__num">{p.propertiesCount}</span>
              <span role="cell" className="vera-table__num">
                <span className={`vera-dot vera-dot--${p.status === 'active' ? 'published' : 'none'}`} />
                {p.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </button>
          ))}
        </div>
      )}

      <NewPersonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={onCreated}
        title="Nueva persona"
        defaultRoles={['contacto']}
      />
    </div>
  );
};

export default PeopleScreen;
