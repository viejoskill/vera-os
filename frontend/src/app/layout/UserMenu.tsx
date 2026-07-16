import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

interface UserMenuProps {
  name: string;
  role: string;
}

/** Avatar + dropdown in the top-right. Holds the sign-out action. */
export const UserMenu = ({ name, role }: UserMenuProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
        <span className="vera-usermenu__name">{name}</span>
        <ChevronDown size={15} className="vera-usermenu__chevron" />
      </button>

      {open && (
        <div className="vera-usermenu__pop" role="menu" data-testid="user-menu-pop">
          <div className="vera-usermenu__header">
            <div className="vera-usermenu__header-name">{name}</div>
            <div className="vera-usermenu__header-role">{role}</div>
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
