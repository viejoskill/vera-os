import { useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { useAuth } from '@app/auth/AuthProvider';
import { UsersTab } from './UsersTab';
import { RolesTab } from './RolesTab';

type Tab = 'users' | 'roles';

/** Administración de usuarios y roles de VERA OS — solo administradores. */
export const UsersRolesScreen = () => {
  const { session, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

  if (!profile?.isAdmin) {
    return (
      <div className="vera-screen" data-testid="users-roles-screen">
        <p className="vera-team__empty">Solo un administrador puede ver esta sección.</p>
      </div>
    );
  }

  return (
    <div className="vera-screen vera-team" data-testid="users-roles-screen">
      <header className="vera-team__head">
        <h2 className="vera-team__title"><Shield size={18} /> Usuarios y roles</h2>
        <p className="vera-team__sub">
          Creá usuarios, asignales uno o más roles y definí qué puede ver, crear, editar, borrar o
          exportar cada rol en cada sección. Los cambios aplican al instante, sin que nadie tenga que
          volver a loguearse.
        </p>
      </header>

      <div className="vera-team__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'users'}
          className={`vera-team__tab ${tab === 'users' ? 'vera-team__tab--active' : ''}`.trim()}
          data-testid="tab-users"
          onClick={() => setTab('users')}
        >
          <Users size={14} /> Usuarios
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'roles'}
          className={`vera-team__tab ${tab === 'roles' ? 'vera-team__tab--active' : ''}`.trim()}
          data-testid="tab-roles"
          onClick={() => setTab('roles')}
        >
          <Shield size={14} /> Roles
        </button>
      </div>

      {tab === 'users' ? <UsersTab currentEmail={session?.user?.email ?? ''} /> : <RolesTab />}
    </div>
  );
};

export default UsersRolesScreen;
