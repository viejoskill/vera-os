import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Home, Layers,
  Loader2, PencilLine, PenLine, Plus, TriangleAlert, Users,
} from 'lucide-react';
import { Button, Input } from '@vera/ui';
import { PERSON_ROLE_LABELS } from '@vera/types';
import { useProperties } from '@app/hooks/useProperties';
import { usePeople, useCreatePerson } from '@app/hooks/usePeople';
import {
  useTemplates, useTemplate, useResolveDocument, useCreateDocument,
  type PersonLinkInput, type ResolveResult,
} from './useDocuments';

type Step = 'template' | 'property' | 'people' | 'signature' | 'review';

const ORIGIN_LABEL: Record<string, string> = {
  property: 'Propiedad', person: 'Persona', system: 'Configuración', input: 'Ingresado por vos',
};

const METHOD_LABEL: Record<string, string> = { presencial: 'Presencial', digital: 'Digital' };
const METHOD_HINT: Record<string, string> = {
  presencial: 'Se firma en persona: papel, en pantalla o firma escaneada.',
  digital: 'Se firma a distancia desde un enlace seguro (certificación VERA).',
};

function roleLabel(role: string): string {
  return PERSON_ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

/** Wizard "Nuevo Documento" (ruta dedicada `/documentos/nuevo`).
 * Template → Propiedad → Personas → Revisión. VERA completa lo que ya sabe;
 * el usuario solo aporta lo que falta. */
export const DocumentWizard = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('template');
  const [templateId, setTemplateId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [personsByRole, setPersonsByRole] = useState<Record<string, string[]>>({});
  const [quickAddRole, setQuickAddRole] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState({ fullName: '', document: '', primaryPhone: '', primaryEmail: '' });
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [signatureMethod, setSignatureMethod] = useState<string>('');
  const [signerRequired, setSignerRequired] = useState<Record<string, boolean>>({});

  const templates = useTemplates();
  const template = useTemplate(templateId || undefined);
  const properties = useProperties();
  const people = usePeople();
  const resolve = useResolveDocument();
  const create = useCreateDocument();

  const requirements = template.data
    ? {
        needsProperty: template.data.variables.some((v) => v.source === 'property'),
        personRoles: Array.from(
          new Set(
            template.data.variables
              .filter((v) => v.source === 'person' && v.role)
              .map((v) => v.role as string),
          ),
        ).sort(),
      }
    : { needsProperty: false, personRoles: [] as string[] };

  const signatureMethods = template.data?.signatureMethods ?? [];

  // Pasos activos según lo que el template pide (extensible por definición).
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = ['template'];
    if (requirements.needsProperty) s.push('property');
    if (requirements.personRoles.length) s.push('people');
    if (signatureMethods.length) s.push('signature');
    s.push('review');
    return s;
  }, [requirements.needsProperty, requirements.personRoles.length, signatureMethods.length]);

  const persons: PersonLinkInput[] = useMemo(
    () =>
      Object.entries(personsByRole).flatMap(([role, ids]) =>
        (ids || []).filter(Boolean).map((personId) => ({ role, personId })),
      ),
    [personsByRole],
  );
  const createPerson = useCreatePerson();

  // Resolvemos SOLO ante cambios estructurales (template/propiedad/personas).
  // NO al tipear: eso re-renderiza y roba el foco del campo. La validación de
  // "listo para crear" se calcula localmente contra los inputs actuales.
  useEffect(() => {
    if (step !== 'review' || !templateId) return;
    resolve.mutate({ templateId, propertyId: propertyId || null, persons, inputs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, templateId, propertyId, persons]);

  const result: ResolveResult | undefined = resolve.data;

  const stepIndex = steps.indexOf(step);
  const goNext = () => setStep(steps[Math.min(stepIndex + 1, steps.length - 1)]);
  const goBack = () => {
    if (stepIndex === 0) navigate('/documentos');
    else setStep(steps[stepIndex - 1]);
  };

  const canAdvance = (): boolean => {
    if (step === 'template') return !!templateId && !!template.data;
    if (step === 'property') return !requirements.needsProperty || !!propertyId;
    if (step === 'people') return requirements.personRoles.every((r) => (personsByRole[r]?.length ?? 0) > 0);
    if (step === 'signature') return !!signatureMethod;
    return false;
  };

  const handleCreate = async () => {
    const signers = signatureMethod
      ? persons.map((p, i) => ({
          personId: p.personId,
          role: p.role,
          order: i,
          signatureRequired: signerRequired[p.personId] ?? true,
        }))
      : [];
    const doc = await create.mutateAsync({
      templateId,
      title: template.data?.name ?? '',
      propertyId: propertyId || null,
      persons,
      inputs,
      origin: 'manual',
      signatureMethod: signatureMethod || null,
      signers,
    });
    navigate(`/documentos/${doc.id}`);
  };

  const resolved = result?.fields.filter((f) => f.status === 'resolved') ?? [];
  const needsUser = result?.fields.filter((f) => f.status === 'input' || f.status === 'missing') ?? [];
  const warnings = result?.fields.filter((f) => f.status === 'warning') ?? [];

  const fieldValue = (f: { key: string; value: unknown }) =>
    inputs[f.key] ?? (f.value === null || f.value === undefined ? '' : String(f.value));

  // Un obligatorio está satisfecho si el usuario lo tipeó o si VERA ya lo resolvió (dato/default).
  const isFilled = (f: { key: string; value: unknown }) => {
    const iv = inputs[f.key];
    if (iv !== undefined && String(iv).trim() !== '') return true;
    return f.value !== null && f.value !== undefined && String(f.value).trim() !== '';
  };
  const canCreate =
    !!result && result.fields.filter((f) => f.required).every((f) => isFilled(f));

  return (
    <div className="vera-screen" data-testid="document-wizard">
      <div className="vera-wizard__head">
        <button type="button" className="vera-wizard__back" onClick={goBack} data-testid="wizard-back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="vera-wizard__title">Nuevo Documento</h1>
          <p className="vera-wizard__sub">VERA completa lo que ya sabe; vos aportás lo que falta.</p>
        </div>
      </div>

      {/* Progreso de pasos */}
      <ol className="vera-wizard__steps" data-testid="wizard-steps">
        {steps.map((s, i) => {
          const label =
            s === 'template' ? 'Template'
            : s === 'property' ? 'Propiedad'
            : s === 'people' ? 'Personas'
            : s === 'signature' ? 'Firma'
            : 'Revisión';
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending';
          return (
            <li key={s} className={`vera-wizard__step is-${state}`} data-testid={`wizard-step-${s}`}>
              <span className="vera-wizard__dot">{state === 'done' ? <Check size={14} /> : i + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {/* Paso 1: Template */}
      {step === 'template' && (
        <section className="vera-wizard__body" data-testid="step-template">
          <h2 className="vera-wizard__h2"><Layers size={16} /> Elegí el tipo de documento</h2>
          {templates.isLoading && <p className="vera-docs__empty">Cargando templates…</p>}
          {templates.data?.length === 0 && (
            <div className="vera-docs__empty" data-testid="templates-empty">
              <Layers size={24} />
              <p>Todavía no hay templates. Creá el primero desde la solapa Templates.</p>
            </div>
          )}
          <div className="vera-wizard__cards">
            {templates.data?.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`vera-wizard__card ${templateId === t.id ? 'is-selected' : ''}`}
                onClick={() => setTemplateId(t.id)}
                data-testid={`wizard-template-${t.id}`}
              >
                <FileText size={18} className="vera-wizard__card-icon" />
                <span className="vera-wizard__card-title">{t.name}</span>
                <span className="vera-wizard__card-meta">{t.category} · v{t.version}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Paso 2: Propiedad */}
      {step === 'property' && (
        <section className="vera-wizard__body" data-testid="step-property">
          <h2 className="vera-wizard__h2"><Home size={16} /> Elegí la propiedad</h2>
          {properties.isLoading && <p className="vera-docs__empty">Cargando propiedades…</p>}
          <div className="vera-wizard__cards">
            {properties.data?.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`vera-wizard__card ${propertyId === p.id ? 'is-selected' : ''}`}
                onClick={() => setPropertyId(p.id)}
                data-testid={`wizard-property-${p.id}`}
              >
                <Home size={18} className="vera-wizard__card-icon" />
                <span className="vera-wizard__card-title">{p.title || p.address || 'Propiedad'}</span>
                <span className="vera-wizard__card-meta">
                  {[p.address, p.city].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Paso 3: Personas por rol */}
      {step === 'people' && (
        <section className="vera-wizard__body" data-testid="step-people">
          <h2 className="vera-wizard__h2"><Users size={16} /> Asigná las personas</h2>
          <p className="vera-wizard__hint">Este template necesita: {requirements.personRoles.map(roleLabel).join(', ')}. Podés asignar más de una persona por rol.</p>
          {requirements.personRoles.map((role) => {
            const selected = personsByRole[role] ?? [];
            const available = (people.data ?? []).filter((p) => !selected.includes(p.id));
            const addPerson = (id: string) => id && setPersonsByRole((prev) => ({ ...prev, [role]: [...(prev[role] ?? []), id] }));
            const removePerson = (id: string) => setPersonsByRole((prev) => ({ ...prev, [role]: (prev[role] ?? []).filter((x) => x !== id) }));
            const submitQuickAdd = async () => {
              if (!quickAdd.fullName.trim()) return;
              const created = await createPerson.mutateAsync({
                fullName: quickAdd.fullName.trim(),
                document: quickAdd.document.trim() || undefined,
                primaryPhone: quickAdd.primaryPhone.trim() || undefined,
                primaryEmail: quickAdd.primaryEmail.trim() || undefined,
                roles: [role],
              });
              setPersonsByRole((prev) => ({ ...prev, [role]: [...(prev[role] ?? []), created.id] }));
              setQuickAdd({ fullName: '', document: '', primaryPhone: '', primaryEmail: '' });
              setQuickAddRole(null);
            };
            return (
              <div key={role} className="vera-wizard__role" data-testid={`wizard-role-${role}`}>
                <label className="vera-wizard__role-label">{roleLabel(role)}</label>

                {selected.length > 0 && (
                  <div className="vera-wizard__chips" data-testid={`wizard-role-chips-${role}`}>
                    {selected.map((id) => (
                      <span key={id} className="vera-wizard__chip">
                        {people.data?.find((p) => p.id === id)?.fullName ?? 'Persona'}
                        <button type="button" aria-label="Quitar" data-testid={`wizard-chip-remove-${id}`} onClick={() => removePerson(id)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="vera-wizard__role-add">
                  <select
                    className="vera-select"
                    value=""
                    onChange={(e) => addPerson(e.target.value)}
                    data-testid={`wizard-role-select-${role}`}
                  >
                    <option value="">Agregar de la base…</option>
                    {available.map((person) => (
                      <option key={person.id} value={person.id}>{person.fullName}</option>
                    ))}
                  </select>
                  <Button
                    variant="secondary" size="sm" type="button"
                    data-testid={`wizard-quickadd-toggle-${role}`}
                    onClick={() => setQuickAddRole(quickAddRole === role ? null : role)}
                  >
                    <Plus size={15} /> Nuevo
                  </Button>
                </div>

                {quickAddRole === role && (
                  <div className="vera-wizard__quickadd" data-testid={`wizard-quickadd-${role}`}>
                    <Input placeholder="Nombre y apellido *" value={quickAdd.fullName} data-testid="quickadd-name"
                      onChange={(e) => setQuickAdd((q) => ({ ...q, fullName: e.target.value }))} />
                    <Input placeholder="DNI" value={quickAdd.document} data-testid="quickadd-dni"
                      onChange={(e) => setQuickAdd((q) => ({ ...q, document: e.target.value }))} />
                    <Input placeholder="Teléfono" value={quickAdd.primaryPhone} data-testid="quickadd-phone"
                      onChange={(e) => setQuickAdd((q) => ({ ...q, primaryPhone: e.target.value }))} />
                    <Input placeholder="Email" value={quickAdd.primaryEmail} data-testid="quickadd-email"
                      onChange={(e) => setQuickAdd((q) => ({ ...q, primaryEmail: e.target.value }))} />
                    <Button type="button" size="sm" data-testid="quickadd-submit"
                      disabled={!quickAdd.fullName.trim() || createPerson.isPending} onClick={submitQuickAdd}>
                      {createPerson.isPending ? 'Agregando…' : 'Agregar persona'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Paso 4: Firma (método permitido por el template) */}
      {step === 'signature' && (
        <section className="vera-wizard__body" data-testid="step-signature">
          <h2 className="vera-wizard__h2"><PenLine size={16} /> Método de firma</h2>
          <p className="vera-wizard__hint">Este template permite: {signatureMethods.map((m) => METHOD_LABEL[m] ?? m).join(', ')}.</p>
          <div className="vera-wizard__cards">
            {signatureMethods.map((m) => (
              <button
                key={m}
                type="button"
                className={`vera-wizard__card ${signatureMethod === m ? 'is-selected' : ''}`}
                onClick={() => setSignatureMethod(m)}
                data-testid={`wizard-method-${m}`}
              >
                <PenLine size={18} className="vera-wizard__card-icon" />
                <span className="vera-wizard__card-title">{METHOD_LABEL[m] ?? m}</span>
                <span className="vera-wizard__card-meta">{METHOD_HINT[m] ?? ''}</span>
              </button>
            ))}
          </div>

          {persons.length > 0 && (
            <div className="vera-wizard__signers" data-testid="wizard-signers">
              <h3 className="vera-review__title"><Users size={16} /> Firmantes</h3>
              {persons.map((p, i) => (
                <label key={p.personId} className="vera-wizard__signer" data-testid={`wizard-signer-${p.personId}`}>
                  <input
                    type="checkbox"
                    checked={signerRequired[p.personId] ?? true}
                    onChange={(e) => setSignerRequired((prev) => ({ ...prev, [p.personId]: e.target.checked }))}
                  />
                  <span className="vera-wizard__signer-name">
                    {people.data?.find((x) => x.id === p.personId)?.fullName ?? 'Persona'}
                  </span>
                  <span className="vera-wizard__signer-role">{roleLabel(p.role ?? '')} · #{i + 1}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Paso 5: Revisión */}
      {step === 'review' && (
        <section className="vera-wizard__body" data-testid="step-review">
          <h2 className="vera-wizard__h2"><CheckCircle2 size={16} /> Revisión</h2>
          {resolve.isPending && !result && (
            <p className="vera-docs__empty"><Loader2 size={16} className="vera-spin" /> Analizando datos…</p>
          )}

          {result && (
            <>
              {/* ✅ Completado por VERA */}
              <div className="vera-review__group vera-review__group--ok" data-testid="review-resolved">
                <h3 className="vera-review__title"><CheckCircle2 size={16} /> Completado por VERA</h3>
                {resolved.length === 0 && <p className="vera-review__none">VERA todavía no pudo completar datos.</p>}
                {resolved.map((f) => (
                  <div key={f.key} className="vera-review__row" data-testid={`review-resolved-${f.key}`}>
                    <span className="vera-review__label">{f.label}</span>
                    <span className="vera-review__value">{String(f.value)}</span>
                    <span className="vera-review__origin">{ORIGIN_LABEL[f.origin ?? ''] ?? '—'}</span>
                  </div>
                ))}
              </div>

              {/* ✏️ Requiere tu intervención */}
              {needsUser.length > 0 && (
                <div className="vera-review__group vera-review__group--edit" data-testid="review-missing">
                  <h3 className="vera-review__title"><PencilLine size={16} /> Requiere tu intervención</h3>
                  {needsUser.map((f) => {
                    const label = `${f.label}${f.required ? ' *' : ' (opcional)'}`;
                    const val = fieldValue(f);
                    const onChange = (v: string) => setInputs((prev) => ({ ...prev, [f.key]: v }));
                    if (f.type === 'select') {
                      return (
                        <label key={f.key} className="vera-field">
                          <span className="vera-field__label">{label}</span>
                          <select
                            className="vera-select"
                            value={val}
                            onChange={(e) => onChange(e.target.value)}
                            data-testid={`review-input-${f.key}`}
                          >
                            {(f.options ?? []).map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    if (f.type === 'textarea') {
                      return (
                        <label key={f.key} className="vera-field">
                          <span className="vera-field__label">{label}</span>
                          <textarea
                            className="vera-textarea"
                            rows={3}
                            value={val}
                            onChange={(e) => onChange(e.target.value)}
                            data-testid={`review-input-${f.key}`}
                          />
                        </label>
                      );
                    }
                    return (
                      <Input
                        key={f.key}
                        label={label}
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={val}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={f.required ? 'Dato obligatorio' : 'Opcional'}
                        hint={
                          f.status === 'missing' && f.source === 'person'
                            ? 'La persona seleccionada no tiene este dato cargado; completalo acá.'
                            : f.status === 'missing' && f.source === 'property'
                            ? 'La propiedad no tiene este dato cargado; completalo acá.'
                            : undefined
                        }
                        data-testid={`review-input-${f.key}`}
                      />
                    );
                  })}
                </div>
              )}

              {/* ⚠️ Advertencias */}
              {warnings.length > 0 && (
                <div className="vera-review__group vera-review__group--warn" data-testid="review-warnings">
                  <h3 className="vera-review__title"><TriangleAlert size={16} /> Advertencias</h3>
                  <p className="vera-review__none">
                    VERA no pudo completar estos datos (no son obligatorios). Podés cargarlos igual.
                  </p>
                  {warnings.map((f) => (
                    <Input
                      key={f.key}
                      label={f.label}
                      value={inputs[f.key] ?? ''}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="Opcional"
                      data-testid={`review-warning-${f.key}`}
                    />
                  ))}
                </div>
              )}

              {create.isError && (
                <p className="vera-field__error" data-testid="wizard-create-error">
                  {(create.error as Error)?.message ?? 'No se pudo crear el documento.'}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* Navegación */}
      <div className="vera-wizard__nav">
        <Button variant="ghost" onClick={goBack} data-testid="wizard-nav-back">
          <ArrowLeft size={16} /> {stepIndex === 0 ? 'Cancelar' : 'Atrás'}
        </Button>
        {step === 'review' ? (
          <Button
            onClick={handleCreate}
            disabled={!canCreate || create.isPending}
            data-testid="wizard-create"
          >
            {create.isPending ? <Loader2 size={16} className="vera-spin" /> : <Check size={16} />} Crear documento
          </Button>
        ) : (
          <Button onClick={goNext} disabled={!canAdvance()} data-testid="wizard-next">
            Siguiente <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentWizard;
