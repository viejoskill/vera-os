import { useCallback, useEffect, useState } from 'react';
import { Shield, Check, X, UserCog } from 'lucide-react';
import { Button } from '@vera/ui';
import { env } from '@vera/config';
import { useAuth } from '@app/auth/AuthProvider';

interface Member {
  email: string;
  approved: boolean;
  isAdmin: boolean;
}

export const TeamScreen = () => {
  const { session, approval } = useAuth();
  const actorEmail = session?.user?.email ?? '';
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

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
            {active.map((m) => (
              <div key={m.email} className="vera-team__row" data-testid={`team-row-${m.email}`}>
                <span className="vera-team__email">
                  {m.email}
                  {m.isAdmin && <span className="vera-team__badge"><UserCog size={12} /> Admin</span>}
                </span>
                <div className="vera-team__actions">
                  {!m.isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === m.email}
                      data-testid={`team-makeadmin-${m.email}`}
                      onClick={() => act('make-admin', m.email)}
                    >
                      Hacer admin
                    </Button>
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
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default TeamScreen;
