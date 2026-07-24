import { useEffect, useState } from 'react';
import { Save, RotateCcw, SlidersHorizontal, Check } from 'lucide-react';
import { Button } from '@vera/ui';
import { env } from '@vera/config';

const API = `${env.backendUrl}/api/tasacion`;

const ZONAS: [string, string][] = [
  ['costa', 'Av. Costanera'], ['av2', 'Av. 2 y Camelias'], ['mar', 'Zona Mar'],
  ['inter', 'Av. Interbalnearia'], ['bosque', 'Zona Bosque'], ['fondo', 'Zona Fondo'],
];
const CALIDADES: [string, string][] = [['economica', 'Económica'], ['estandar', 'Estándar'], ['premium', 'Premium']];

interface Group { title: string; hint?: string; step: number; fields: [string, string][]; }

const constrFields = (): [string, string][] =>
  ZONAS.flatMap(([zk, zl]) => CALIDADES.map(([ck, cl]) => [`precio_constr_${zk}_${ck}`, `${zl} · ${cl}`] as [string, string]));

const GROUPS: Group[] = [
  {
    title: 'Coeficiente Varela y apertura', step: 0.01,
    hint: 'El coeficiente de cierre (≈0,83) baja el precio de publicación al valor recomendado. La apertura abre el rango (±).',
    fields: [
      ['coef_varela_min', 'Coef. de cierre — mínimo'],
      ['coef_varela_max', 'Coef. de cierre — máximo'],
      ['rango_apertura', 'Apertura del rango (±)'],
    ],
  },
  { title: 'Precio de construcción · USD por m² cubierto', step: 10, fields: constrFields() },
  {
    title: 'Precio de lote · USD por m²', step: 5,
    fields: ZONAS.map(([zk, zl]) => [`precio_lote_${zk}`, zl] as [string, string]),
  },
  {
    title: 'Precio de departamento · USD por m²', step: 10,
    fields: [
      ['precio_depto_1amb', '1 ambiente'], ['precio_depto_2amb', '2 ambientes'],
      ['precio_depto_3amb', '3 ambientes'], ['precio_depto_4amb', '4+ ambientes'],
    ],
  },
  {
    title: 'Antigüedad (casa) · multiplicador', step: 0.01,
    hint: '1,00 = neutro. Mayor a 1 suma valor, menor resta.',
    fields: [
      ['mult_ant_estrenar', 'A estrenar'], ['mult_ant_hasta10', 'Hasta 10 años'],
      ['mult_ant_10a25', '10 a 25 años'], ['mult_ant_mas25', 'Más de 25 años'],
    ],
  },
  {
    title: 'Estado de conservación · multiplicador', step: 0.01,
    fields: [['mult_est_muybueno', 'Muy bueno'], ['mult_est_bueno', 'Bueno'], ['mult_est_reciclar', 'A reciclar']],
  },
  {
    title: 'Servicios · multiplicador', step: 0.01,
    fields: [['mult_serv_gas', 'Gas natural'], ['mult_serv_cloacas', 'Cloacas']],
  },
  {
    title: 'Vista (departamento) · multiplicador', step: 0.01,
    fields: [['mult_vista_frente', 'Al frente'], ['mult_vista_lateral', 'Lateral'], ['mult_vista_contra', 'Contrafrente']],
  },
  {
    title: 'Adicionales / amenities · fracción sumada', step: 0.005,
    hint: '0,06 = suma 6% al valor. Se acumulan entre sí.',
    fields: [
      ['add_pileta', 'Pileta'], ['add_quincho', 'Quincho'], ['add_deck', 'Deck'],
      ['add_galeria_semi', 'Galería / semicubierto'], ['add_estac_cubierto', 'Cochera cubierta'],
      ['add_estac_descubierto', 'Cochera descubierta'],
      ['add_depto_estac_cubierto', 'Cochera cubierta (depto)'], ['add_depto_estac_descubierto', 'Cochera descubierta (depto)'],
    ],
  },
];

export const TasadorConfig = () => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const res = await fetch(`${API}/config`);
    const data = await res.json();
    setValues(data.values || {});
    setLoaded(true);
  };

  useEffect(() => { if (open && !loaded) load(); }, [open, loaded]);

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v === '' ? 0 : Number(v) }));

  const save = async () => {
    setSaving(true);
    const res = await fetch(`${API}/config`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    const data = await res.json();
    setValues(data.values || values);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="tascfg" data-testid="tasador-config">
      <button type="button" className="tascfg__toggle" onClick={() => setOpen((o) => !o)} data-testid="tascfg-toggle">
        <SlidersHorizontal size={15} />
        <span>Ajustar variables del cálculo</span>
        <em>{open ? 'Ocultar' : 'Editar precios y multiplicadores'}</em>
      </button>

      {open && (
        <div className="tascfg__panel" data-testid="tascfg-panel">
          {!loaded ? (
            <p className="tascfg__loading">Cargando variables…</p>
          ) : (
            <>
              <div className="tascfg__groups">
                {GROUPS.map((g) => (
                  <section key={g.title} className="tascfg__group">
                    <h4>{g.title}</h4>
                    {g.hint && <p className="tascfg__hint">{g.hint}</p>}
                    <div className="tascfg__grid">
                      {g.fields.map(([key, label]) => (
                        <label key={key} className="tascfg__field">
                          <span>{label}</span>
                          <input
                            type="number" step={g.step} value={values[key] ?? ''}
                            onChange={(e) => set(key, e.target.value)}
                            data-testid={`tascfg-${key}`}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="tascfg__actions">
                <Button variant="ghost" size="sm" onClick={() => { setLoaded(false); load(); }} data-testid="tascfg-reset">
                  <RotateCcw size={14} /> Descartar cambios
                </Button>
                <Button variant="primary" size="sm" onClick={save} disabled={saving} data-testid="tascfg-save">
                  {saved ? <><Check size={14} /> Guardado</> : <><Save size={14} /> {saving ? 'Guardando…' : 'Guardar variables'}</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TasadorConfig;
