import { useCallback, useEffect, useState } from 'react';
import { Shield, Check, X, UserCog, Settings2 } from 'lucide-react';
import { Button } from '@vera/ui';
import { env } from '@vera/config';
import { useAuth } from '@app/auth/AuthProvider';
import { navRoutes } from '@app/navigation';

interface Member {
  email: string;
  approved: boolean;
  isAdmin: boolean;
  sections: string[] | null;
}

const SECTION_OPTIONS = navRoutes.filter((r) => r.enabled !== false && r.id !== 'equipo' && r.id !== 'estadisticas');
const DEFAULT_EMPLOYEE_SECTIONS = ['alquileres', 'studio'];

export const TeamScreen = () => {
  const { session, approval } = useAuth();
  const actorEmail = session?.user?.email ?? '';
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `${env.backendUrl}/api/auth/team?actorEmail=${encodeURIComponent(actorEmail)}`,
    );
    const data = res.ok ? await res.json() : { members: [] };
    setMembers(data.members ?? []);
    setLoading(false);
  }, [actorEmail]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (path: string, email: string) => {
    setBusy(email);
    await fetch(`${env.backendUrl}/api/auth/team/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, actorEmail }),
    });
    await load();
    setBusy(null);
  };

  const toggleSection = async (member: Member, sectionId: string) => {
    const current = member.sections ?? DEFAULT_EMPLOYEE_SECTIONS;
    const next = current.includes(sectionId)
      ? current.filter((s) => s !== sectionId)
      : [...current, sectionId];
    setBusy(member.email);
    await fetch(`${env.backendUrl}/api/auth/team/set-sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: member.email, actorEmail, sections: next }),
    });
    await load();
    setBusy(null);
  };

  const resetSections = async (member: Member) => {
    setBusy(member.email);
    await fetch(`${env.backendUrl}/api/auth/team/set-sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: member.email, actorEmail, sections: null }),
    });
    await load();
    setBusy(null);
  };

  if (!approval?.isAdmin) {
    return (
      <div className="vera-screen" data-testid="team-screen">
        <p className="vera-team__empty">Solo un administrador puede ver esta sección.</p>
      </div>
    );
  }

  const pending = members.filter((m) => !m.approved);
  const active = members.filter((m) => m.approved);

  return (
    <div className="vera-screen vera-team" data-testid="team-screen">
      <header className="vera-team__head">
        <h2 className="vera-team__title"><Shield size={18} /> Equipo y accesos</h2>
        <p className="vera-team__sub">
          Aprobá quién puede entrar a VERA. Las cuentas nuevas quedan pendientes hasta que las habilites.
          A los que no son admin podés elegirles exactamente qué secciones del menú ven.
        </p>
      </header>

      {loading ? (
        <p className="vera-team__empty">Cargando…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="vera-team__section">
              <h3 className="vera-team__section-title">Pendientes de aprobación ({pending.length})</h3>
              {pending.map((m) => (
                <div key={m.email} className="vera-team__row" data-testid={`team-row-${m.email}`}>
                  <span className="vera-team__email">{m.email}</span>
                  <div className="vera-team__actions">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy === m.email}
                      data-testid={`team-approve-${m.email}`}
                      onClick={() => act('approve', m.email)}
                    >
                      <Check size={14} /> Aprobar
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="vera-team__section">
            <h3 className="vera-team__section-title">Con acceso ({active.length})</h3>
            {active.map((m) => {
              const memberSections = m.sections ?? DEFAULT_EMPLOYEE_SECTIONS;
              return (
                <div key={m.email} className="vera-team__row" data-testid={`team-row-${m.email}`}>
                  <span className="vera-team__email">
                    {m.email}
                    {m.isAdmin && <span className="vera-team__badge"><UserCog size={12} /> Admin</span>}
                  </span>
                  <div className="vera-team__actions">
                    {!m.isAdmin && (
                      <>
                        <span className="vera-team__access" data-testid={`team-access-${m.email}`}>
                          Acceso: {memberSections.length > 0
                            ? SECTION_OPTIONS.filter((s) => memberSections.includes(s.id)).map((s) => s.label).join(', ') || 'ninguna sección'
                            : 'ninguna sección'}
                        </span>
                        <button
                          type="button"
                          className="vera-team__sections-toggle"
                          data-testid={`team-edit-sections-${m.email}`}
                          onClick={() => setEditing(editing === m.email ? null : m.email)}
                        >
                          <Settings2 size={12} /> Secciones
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === m.email}
                          data-testid={`team-makeadmin-${m.email}`}
                          onClick={() => act('make-admin', m.email)}
                        >
                          Hacer admin
                        </Button>
                      </>
                    )}
                    {m.email !== actorEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === m.email}
                        data-testid={`team-revoke-${m.email}`}
                        onClick={() => act('revoke', m.email)}
                      >
                        <X size={14} /> Quitar acceso
                      </Button>
                    )}
                    {!m.isAdmin && editing === m.email && (
                      <div className="vera-team__sections-panel" data-testid={`team-sections-panel-${m.email}`}>
                        {SECTION_OPTIONS.map((s) => {
                          const on = memberSections.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`vera-team__sections-chip ${on ? 'vera-team__sections-chip--on' : ''}`}
                              data-testid={`team-section-${m.email}-${s.id}`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={busy === m.email}
                                onChange={() => toggleSection(m, s.id)}
                              />
                              {s.label}
                            </label>
                          );
                        })}
                        {m.sections !== null && (
                          <button
                            type="button"
                            className="vera-team__sections-reset"
                            data-testid={`team-reset-sections-${m.email}`}
                            disabled={busy === m.email}
                            onClick={() => resetSections(m)}
                          >
                            Restablecer a Alquileres + Studio (default)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
};

export default TeamScreen;
