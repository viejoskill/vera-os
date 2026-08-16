import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, AlertTriangle, Save } from 'lucide-react';
import { Button, Panel, Progress, Toast } from '@vera/ui';
import {
  assistantService,
  propertyFilesGateway,
  propertyService,
  studioService,
  workspaceService,
} from '@vera/services';
import type { Property, PropertyDetail } from '@vera/types';
import { useVeraStudio } from '@app/hooks/useVeraStudio';
import { useDocuments } from '@app/hooks/useDocuments';
import { useProperty } from '@app/hooks/useProperty';
import { useWorkspaceGallery, type LiveStatus } from '@app/hooks/useWorkspaceGallery';
import { useWorkspaceDocuments } from '@app/hooks/useWorkspaceDocuments';
import { propertyFormSchema, defaultPropertyForm, type PropertyFormValues } from './form-schema';
import { BasicInfoSection } from './BasicInfoSection';
import { FeaturesSection } from './FeaturesSection';
import { AmenitiesSection } from './AmenitiesSection';
import { ChannelsSection } from './ChannelsSection';
import { SyncBadge } from './SyncBadge';
import { ShareMenu } from './ShareMenu';
import { OwnerSection } from './OwnerSection';
import { TrackingSection } from './TrackingSection';
import { PhotosSection } from './PhotosSection';
import { DocumentsSection } from './DocumentsSection';
import { DocumentacionSection } from './DocumentacionSection';
import { ExpressSection } from './ExpressSection';
import { StatsSection } from './StatsSection';
import { HealthScoreSection } from './HealthScoreSection';
import { SaleCommissionSection } from './SaleCommissionSection';

interface ToastState {
  message: string;
  tone: 'default' | 'success';
}

/** Dispara la descarga de un archivo desde el navegador (sin navegar de página). */
const triggerBrowserDownload = (url: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

type LifecycleStatus = 'active' | 'reserved' | 'sold' | 'archived';

const STATUS_STEPS: { id: LifecycleStatus; label: string }[] = [
  { id: 'active', label: 'Disponible' },
  { id: 'reserved', label: 'Reservada' },
  { id: 'sold', label: 'Vendida' },
  { id: 'archived', label: 'Archivada' },
];

const str = (v: number | string | undefined) => (v ? String(v) : '');

const toForm = (d: PropertyDetail): PropertyFormValues => ({
  title: d.title,
  operation: d.operation,
  type: d.type,
  price: str(d.price),
  currency: d.currency || 'USD',
  address: d.address,
  neighborhood: d.neighborhood,
  city: d.city || 'Buenos Aires',
  province: d.province ?? '',
  postalCode: d.postalCode ?? '',
  country: d.country ?? '',
  latitude: d.latitude ?? null,
  longitude: d.longitude ?? null,
  googlePlaceId: d.googlePlaceId ?? '',
  formattedAddress: d.formattedAddress ?? '',
  bedrooms: str(d.bedrooms),
  bathrooms: str(d.bathrooms),
  areaM2: str(d.areaM2),
  rooms: str(d.rooms),
  toilettes: str(d.toilettes),
  lotAreaM2: str(d.lotAreaM2),
  semiCoveredAreaM2: str(d.semiCoveredAreaM2),
  floors: str(d.floors),
  floorNumber: str(d.floorNumber ?? undefined),
  parkingCovered: str(d.parkingCovered),
  parkingUncovered: str(d.parkingUncovered),
  orientation: d.orientation ?? '',
  condition: d.condition ?? '',
  amenities: d.amenities ?? [],
  radar: d.radar ?? false,
  description: d.description,
  ownerId: d.ownerId ?? '',
  ownerObservations: d.ownerObservations ?? '',
  yearBuilt: d.yearBuilt ?? '',
  videoUrl: d.videoUrl ?? '',
});

const WorkspaceEditor = ({ detail }: { detail: PropertyDetail | null }) => {
  const isNew = !detail;
  const propertyId = detail?.id ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');

  const showToast = useCallback((state: ToastState) => {
    setToast(state);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const notify = useCallback(
    (status: LiveStatus, message?: string) => {
      setLiveStatus(status);
      if (status === 'error' && message) showToast({ message, tone: 'default' });
      if (status === 'saved') {
        queryClient.invalidateQueries({ queryKey: ['today'] });
        queryClient.invalidateQueries({ queryKey: ['properties'] });
        window.setTimeout(() => setLiveStatus('idle'), 1600);
      }
    },
    [showToast, queryClient],
  );

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: detail ? toForm(detail) : defaultPropertyForm,
    mode: 'onChange',
  });
  const values = form.watch();

  const studio = useVeraStudio();
  const localDocs = useDocuments();
  const gallery = useWorkspaceGallery(propertyId, detail?.images ?? [], notify);
  const liveDocs = useWorkspaceDocuments(propertyId, detail?.documents ?? [], notify);

  const photos = isNew ? studio.photos : gallery.photos;
  const documents = isNew ? localDocs.documents : liveDocs.documents;
  const onAddPhotos = isNew ? studio.addFiles : gallery.addFiles;
  const onRemovePhoto = isNew ? studio.removePhoto : gallery.removePhoto;
  const onSetCover = isNew ? studio.setCover : gallery.setCover;
  const onMovePhoto = isNew ? studio.movePhoto : gallery.movePhoto;
  const onDownloadPhoto = isNew
    ? undefined
    : (id: string) => triggerBrowserDownload(propertyFilesGateway.imageDownloadUrl(propertyId, id));
  const onDownloadAllPhotos = isNew || photos.length === 0
    ? undefined
    : () => triggerBrowserDownload(propertyFilesGateway.photosZipUrl(propertyId));
  const onAddDoc = isNew ? localDocs.addDocument : liveDocs.addDocument;
  const onRemoveDoc = isNew ? localDocs.removeDocument : liveDocs.removeDocument;

  const assessment = useMemo(
    () =>
      assistantService.assess({
        values,
        photoCount: photos.length,
        documentTypes: documents.map((d) => d.type),
      }),
    [values, photos.length, documents],
  );

  const toNumber = (value: string) => (value?.trim() ? Number(value) : 0);

  const buildPayload = (v: PropertyFormValues, status: Property['status']): Partial<Property> => ({
    title: v.title,
    operation: v.operation,
    type: v.type as Property['type'],
    price: toNumber(v.price),
    currency: v.currency,
    address: v.address,
    neighborhood: v.neighborhood,
    city: v.city,
    bedrooms: Math.trunc(toNumber(v.bedrooms)),
    bathrooms: Math.trunc(toNumber(v.bathrooms)),
    areaM2: toNumber(v.areaM2),
    status,
    description: v.description,
    latitude: v.latitude,
    longitude: v.longitude,
    ...({
      province: v.province,
      postalCode: v.postalCode,
      country: v.country,
      googlePlaceId: v.googlePlaceId,
      formattedAddress: v.formattedAddress,
      yearBuilt: v.yearBuilt,
      videoUrl: v.videoUrl,
      ownerId: v.ownerId,
      ownerObservations: v.ownerObservations,
      rooms: Math.trunc(toNumber(v.rooms)),
      toilettes: Math.trunc(toNumber(v.toilettes)),
      lotAreaM2: toNumber(v.lotAreaM2),
      semiCoveredAreaM2: toNumber(v.semiCoveredAreaM2),
      floors: Math.trunc(toNumber(v.floors)),
      floorNumber: v.floorNumber?.trim() ? Math.trunc(toNumber(v.floorNumber)) : null,
      parkingCovered: Math.trunc(toNumber(v.parkingCovered)),
      parkingUncovered: Math.trunc(toNumber(v.parkingUncovered)),
      orientation: v.orientation,
      condition: v.condition,
      amenities: v.amenities,
      radar: v.radar,
    } as object),
  });

  const handleSave = form.handleSubmit(
    async (v) => {
      setSaving(true);
      try {
        const nextStatus: Property['status'] = isNew
          ? 'active'
          : detail!.status === 'draft'
            ? 'active'
            : (detail!.status as Property['status']);
        const payload = buildPayload(v, nextStatus);
        if (isNew) {
          const photosPayload = studio.photos
            .filter((p) => p.file)
            .map((p) => ({ file: p.file as File, isCover: p.isCover }));
          const docsPayload = localDocs.documents
            .filter((d) => d.file)
            .map((d) => ({ file: d.file as File, docType: d.type }));
          const created = await workspaceService.save({
            values: payload,
            photos: photosPayload,
            documents: docsPayload,
          });
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          await queryClient.invalidateQueries({ queryKey: ['today'] });
          navigate(`/propiedades/${created.id}`);
        } else {
          await propertyService.updateProperty(propertyId, payload);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
          await queryClient.invalidateQueries({ queryKey: ['today'] });
          form.reset(v);
          notify('saved');
        }
      } catch (error) {
        console.error('VERA save failed:', error);
        showToast({ message: 'No pudimos guardar. Reintentá en un momento.', tone: 'default' });
      } finally {
        setSaving(false);
      }
    },
    () =>
      showToast({ message: 'Todavía faltan algunos datos. VERA te muestra cuáles.', tone: 'default' }),
  );

  // Guardar borrador: persiste lo cargado SIN validar (para retomarlo después).
  const isDraft = !isNew && detail!.status === 'draft';
  const canDraft = isNew || isDraft;

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const v = form.getValues();
      const payload = buildPayload(v, 'draft');
      if (isNew) {
        const photosPayload = studio.photos
          .filter((p) => p.file)
          .map((p) => ({ file: p.file as File, isCover: p.isCover }));
        const docsPayload = localDocs.documents
          .filter((d) => d.file)
          .map((d) => ({ file: d.file as File, docType: d.type }));
        const created = await workspaceService.save({
          values: payload,
          photos: photosPayload,
          documents: docsPayload,
        });
        await queryClient.invalidateQueries({ queryKey: ['properties'] });
        navigate(`/propiedades/${created.id}`);
      } else {
        await propertyService.updateProperty(propertyId, payload);
        await queryClient.invalidateQueries({ queryKey: ['properties'] });
        await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
        form.reset(v);
        showToast({ message: 'Borrador guardado.', tone: 'success' });
      }
    } catch (error) {
      console.error('VERA draft save failed:', error);
      showToast({ message: 'No pudimos guardar el borrador. Reintentá.', tone: 'default' });
    } finally {
      setSaving(false);
    }
  };

  // Aviso de cambios sin guardar (propiedad nueva o borrador).
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isDirty = form.formState.isDirty;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (canDraft && isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [canDraft, isDirty]);

  const handleBack = () => {
    if (canDraft && isDirty) setConfirmLeave(true);
    else navigate('/propiedades');
  };

  // Estado de la propiedad — acción rápida de un clic desde el encabezado.
  const currentStatus: LifecycleStatus = detail
    ? detail.archived
      ? 'archived'
      : (detail.status as LifecycleStatus)
    : 'active';

  const changeStatus = async (target: LifecycleStatus) => {
    if (isNew || !detail || statusBusy || target === currentStatus) return;
    setStatusBusy(true);
    try {
      if (target === 'archived') {
        await propertyService.archive(propertyId);
      } else {
        if (detail.archived) await propertyService.restore(propertyId);
        await propertyService.updateProperty(propertyId, { status: target });
      }
      // Reflejo inmediato en la UI (sin esperar el refetch).
      queryClient.setQueryData(['property', propertyId], (prev: PropertyDetail | undefined) =>
        prev ? { ...prev, status: target === 'archived' ? prev.status : target, archived: target === 'archived' } : prev,
      );
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    } catch {
      showToast({ message: 'No pudimos cambiar el estado.', tone: 'default' });
    } finally {
      setStatusBusy(false);
    }
  };

  const liveLabel =
    liveStatus === 'saving' ? 'Guardando…' : liveStatus === 'saved' ? 'Guardado' : 'Reintentá';

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const section = searchParams.get('section');
    if (!section) return;
    const el = document.getElementById(`ws-section-${section}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('vera-section--focus');
      window.setTimeout(() => el.classList.remove('vera-section--focus'), 2200);
    }
    if (searchParams.get('focus') === 'price') {
      window.setTimeout(() => {
        (document.querySelector('[data-testid="input-price"]') as HTMLElement | null)?.focus();
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <FormProvider {...form}>
      <div className="vera-workspace" data-testid="property-workspace">
        <header className="vera-workspace__header">
          <div className="vera-workspace__titles">
            <button
              type="button"
              className="vera-workspace__back"
              aria-label="Volver"
              data-testid="workspace-cancel"
              onClick={handleBack}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              {!isNew && detail!.code && (
                <span className="vera-workspace__code" data-testid="workspace-code">
                  {detail!.code}
                </span>
              )}
              <h1 className="vera-workspace__title" data-testid="workspace-title">
                {isNew ? 'Nueva propiedad' : detail!.title || 'Propiedad'}
              </h1>
              <p className="vera-muted">
                {isNew
                  ? 'VERA te acompaña hasta dejarla lista para publicar.'
                  : 'El activo inmobiliario, en un solo lugar.'}
              </p>
            </div>
          </div>
          <div className="vera-workspace__actions">
            {!isNew && <SyncBadge publications={detail?.publications} />}
            {!isNew && detail && (
              <ShareMenu
                propertyId={detail.id}
                status={detail.status}
                title={detail.title}
                address={detail.address}
              />
            )}
            {!isNew && liveStatus !== 'idle' && (
              <span className={`vera-live-status vera-live-status--${liveStatus}`} data-testid="live-status">
                {liveLabel}
              </span>
            )}
            {canDraft && (
              <Button
                variant="secondary"
                size="md"
                data-testid="workspace-save-draft"
                disabled={saving}
                onClick={handleSaveDraft}
              >
                <Save size={15} /> Guardar borrador
              </Button>
            )}
            <Button variant="primary" size="md" data-testid="workspace-save" disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </header>

        {!isNew && (
          <div className="vera-status-bar" role="group" aria-label="Estado de la propiedad" data-testid="status-bar">
            {STATUS_STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={statusBusy}
                data-testid={`status-${s.id}`}
                className={`vera-status-bar__btn vera-status-bar__btn--st-${s.id} ${
                  currentStatus === s.id ? 'vera-status-bar__btn--active' : ''
                }`.trim()}
                onClick={() => changeStatus(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {!isNew && detail && (currentStatus === 'reserved' || currentStatus === 'sold') && (
          <SaleCommissionSection
            propertyId={propertyId}
            propertyLabel={[detail.code, detail.title].filter(Boolean).join(' · ')}
            status={currentStatus}
          />
        )}

        <div className="vera-workspace__progress" data-testid="workspace-progress">
          <div className="vera-workspace__progress-row">
            <span>{assessment.completion}% completado</span>
            <span className="vera-muted">
              {assessment.status === 'ready' ? 'Lista para publicar' : 'En preparación'}
            </span>
          </div>
          <Progress value={assessment.completion} />
        </div>

        <div className="vera-workspace__grid">
          <div className="vera-workspace__main">
            {/* 1 — Datos de la propiedad */}
            <div id="ws-section-information">
              <Panel title="Datos de la propiedad" description="Operación, tipo, precio y ubicación.">
                <BasicInfoSection />
              </Panel>
            </div>
            <div id="ws-section-features">
              <Panel title="Características" description="Superficies, ambientes y estado físico.">
                <FeaturesSection />
              </Panel>
            </div>
            <div id="ws-section-amenities">
              <Panel title="Amenities" description="Atributos y comodidades. Buscá o marcá lo que corresponda.">
                <AmenitiesSection />
              </Panel>
            </div>

            {/* 2 — Fotos (el activo principal) */}
            <div id="ws-section-photos">
              <Panel title="Fotos" description="El activo principal de la propiedad.">
                <PhotosSection
                  photos={photos}
                  onAddFiles={onAddPhotos}
                  onRemove={onRemovePhoto}
                  onSetCover={onSetCover}
                  onMove={onMovePhoto}
                  onDownloadPhoto={onDownloadPhoto}
                  onDownloadAll={onDownloadAllPhotos}
                />
              </Panel>
            </div>

            {/* 3 — Propietario */}
            <div id="ws-section-owner">
              <Panel title="Propietario" description="Quién es el dueño de la propiedad.">
                <OwnerSection />
              </Panel>
            </div>

            {/* 4 — Documentos */}
            <div id="ws-section-documents">
              <Panel title="Documentos" description="Escritura, plano, autorización, video y otros archivos.">
                <DocumentsSection documents={documents} onAdd={onAddDoc} onRemove={onRemoveDoc} />
              </Panel>
            </div>

            {/* 4b — Documentación del motor documental (Autorización, Reserva, etc.) */}
            {propertyId && (
              <div id="ws-section-documentacion">
                <Panel title="Documentación" description="Documentos oficiales de VERA. Se tildan cuando se firman.">
                  <DocumentacionSection propertyId={propertyId} />
                </Panel>
              </div>
            )}

            {/* 5 — Comercialización (título, descripción y textos para portales) */}
            <div id="ws-section-commercialization">
              <Panel title="Comercialización" description="Título, descripción y textos para portales. VERA propone; vos decidís.">
                <ExpressSection />
              </Panel>
            </div>

            {/* 6 — Publicaciones */}
            <div id="ws-section-channels">
              <Panel title="Publicaciones" description="Dónde está publicada la propiedad. VERA nunca publica sola.">
                <ChannelsSection propertyId={propertyId} initial={detail?.publications ?? {}} />
              </Panel>
            </div>

            {/* 7 — Estadísticas */}
            {!isNew && detail && (
              <div id="ws-section-stats">
                <Panel title="Estadísticas" description="Métricas del activo. Solo lectura.">
                  <StatsSection propertyId={detail.id} />
                  <TrackingSection propertyId={detail.id} address={detail.address} ownerId={detail.ownerId} />
                </Panel>
              </div>
            )}
          </div>

          <aside className="vera-workspace__aside">
            <HealthScoreSection assessment={assessment} />
          </aside>
        </div>

        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>

      {confirmLeave &&
        (createPortal(
          <div className="vera-modal" role="dialog" aria-modal="true" data-testid="leave-confirm">
            <div className="vera-modal__backdrop" onClick={() => setConfirmLeave(false)} />
            <div className="vera-modal__panel">
              <header className="vera-modal__head">
                <span className="vera-modal__title">
                  <AlertTriangle size={18} /> Tenés cambios sin guardar
                </span>
              </header>
              <div className="vera-modal__body">
                <p className="vera-muted">
                  Si salís ahora vas a perder lo que cargaste. Podés guardarlo como borrador y retomarlo cuando quieras.
                </p>
              </div>
              <footer className="vera-modal__foot vera-modal__foot--stack">
                <Button
                  variant="primary"
                  size="md"
                  data-testid="leave-save-draft"
                  disabled={saving}
                  onClick={async () => {
                    setConfirmLeave(false);
                    await handleSaveDraft();
                  }}
                >
                  <Save size={15} /> Guardar borrador y salir
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  data-testid="leave-discard"
                  onClick={() => {
                    setConfirmLeave(false);
                    navigate('/propiedades');
                  }}
                >
                  Salir sin guardar
                </Button>
                <button
                  type="button"
                  className="vera-ai-action"
                  data-testid="leave-keep"
                  onClick={() => setConfirmLeave(false)}
                >
                  Seguir editando
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        ) as unknown as ReactElement)}
    </FormProvider>
  );
};

/** Single reusable Workspace: empty when creating, loaded when opening a property. */
export const PropertyWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const propertyId = id && id !== 'nueva' ? id : undefined;
  const query = useProperty(propertyId);

  if (propertyId) {
    if (query.isLoading) {
      return (
        <div className="vera-workspace" data-testid="workspace-loading">
          <p className="vera-muted">Abriendo la propiedad…</p>
        </div>
      );
    }
    if (!query.data) {
      return (
        <div className="vera-workspace">
          <div className="vera-empty" data-testid="workspace-notfound">
            <span className="vera-empty__icon">
              <Building2 size={26} />
            </span>
            <p className="vera-empty__title">Esta propiedad ya no está disponible.</p>
            <p className="vera-muted">
              Puede que se haya archivado o eliminado. Volvé a tus propiedades para continuar.
            </p>
            <Button size="md" data-testid="notfound-back" onClick={() => navigate('/propiedades')}>
              <ArrowLeft size={16} /> Volver a Propiedades
            </Button>
          </div>
        </div>
      );
    }
    return <WorkspaceEditor key={query.data.id} detail={query.data} />;
  }

  return <WorkspaceEditor key="new" detail={null} />;
};
