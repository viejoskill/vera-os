import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAuthUser } from '../auth/useAuthUser';

/** Avatar + dropdown in the top-right. Shows the authenticated user's name + email. */
export const UserMenu = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { displayName, email, initials } = useAuthUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="vera-usermenu" ref={ref}>
      <button
        type="button"
        className="vera-usermenu__trigger"
        data-testid="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="vera-usermenu__avatar">{initials}</span>
        <span className="vera-usermenu__name" data-testid="user-menu-name">
          {displayName}
        </span>
        <ChevronDown size={15} className="vera-usermenu__chevron" />
      </button>

      {open && (
        <div className="vera-usermenu__pop" role="menu" data-testid="user-menu-pop">
          <div className="vera-usermenu__header">
            <div className="vera-usermenu__header-name">{displayName}</div>
            <div className="vera-usermenu__header-role" data-testid="user-menu-email">
              {email}
            </div>
          </div>
          <button
            type="button"
            className="vera-usermenu__item"
            role="menuitem"
            data-testid="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
};
