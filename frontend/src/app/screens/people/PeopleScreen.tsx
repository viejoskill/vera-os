import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Search, Table2, UserPlus } from 'lucide-react';
import { Input, Button } from '@vera/ui';
import { type Person } from '@vera/types';
import { NewPersonModal } from '@app/screens/property-workspace/NewPersonModal';
import { PeopleCardsView } from './PeopleCardsView';
import { PeopleTableView } from './PeopleTableView';

type ViewMode = 'cards' | 'table';
const VIEW_KEY = 'vera:people:view';

/** App Personas — entidad Persona (VERA Core). Dos vistas: Tarjetas (visual) y
 * Tabla configurable (filtros de negocio + exportación). Toggle persistido. */
export const PeopleScreen = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<ViewMode>(() => {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'cards' || v === 'table' ? v : 'table';
  });

  const setViewMode = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

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

        <div className="vera-viewtoggle" role="group" aria-label="Cambiar vista">
          <button
            type="button"
            className={`vera-viewtoggle__btn ${view === 'table' ? 'is-active' : ''}`}
            onClick={() => setViewMode('table')}
            aria-pressed={view === 'table'}
            data-testid="view-toggle-table"
            title="Vista tabla"
          >
            <Table2 size={16} /> Tabla
          </button>
          <button
            type="button"
            className={`vera-viewtoggle__btn ${view === 'cards' ? 'is-active' : ''}`}
            onClick={() => setViewMode('cards')}
            aria-pressed={view === 'cards'}
            data-testid="view-toggle-cards"
            title="Vista tarjetas"
          >
            <LayoutGrid size={16} /> Tarjetas
          </button>
        </div>

        <Button variant="primary" size="md" data-testid="new-person-trigger" onClick={() => setModalOpen(true)}>
          <UserPlus size={16} /> Nueva persona
        </Button>
      </div>

      {view === 'table' ? <PeopleTableView query={query} /> : <PeopleCardsView query={query} />}

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
