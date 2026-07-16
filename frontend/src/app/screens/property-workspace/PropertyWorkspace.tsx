import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Button, Panel, Progress, Toast } from '@vera/ui';
import {
  assistantService,
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
import { DescriptionSection } from './DescriptionSection';
import { OwnerSection } from './OwnerSection';
import { TrackingSection } from './TrackingSection';
import { PhotosSection } from './PhotosSection';
import { DocumentsSection } from './DocumentsSection';
import { VeraStudioSection } from './VeraStudioSection';
import { PublicationSection } from './PublicationSection';
import { HealthScoreSection } from './HealthScoreSection';

interface ToastState {
  message: string;
  tone: 'default' | 'success';
}

// Vera Studio stays hidden until it runs on real intelligence (code kept intact).
const SHOW_VERA_STUDIO = false;

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
  description: d.description,
  amenities: [],
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
        // Reflect live media/data changes in "Hoy" and the list without disturbing
        // the Workspace's own gallery state (no ['property'] refetch → no jumps).
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

  // New-mode: local staging + simulated Vera Studio. Existing-mode: live persistence.
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

  const stages = isNew
    ? studio.stages
    : studioService.getStages().map((s) => ({ ...s, state: 'done' as const }));
  const analysis = isNew
    ? { detectedRooms: studio.detectedRooms, duplicatesRemoved: studio.duplicatesRemoved }
    : photos.length
      ? studioService.analyze(photos.length)
      : { detectedRooms: [], duplicatesRemoved: 0 };

  const toNumber = (value: string) => (value?.trim() ? Number(value) : 0);

  const buildPayload = (v: PropertyFormValues): Partial<Property> => ({
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
    status: isNew ? 'active' : (detail!.status as Property['status']),
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
    } as object),
  });

  const handleSave = form.handleSubmit(
    async (v) => {
      setSaving(true);
      try {
        const payload = buildPayload(v);
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
          // The property's own Workspace opening is the confirmation — no toast.
          navigate(`/propiedades/${created.id}`);
        } else {
          await propertyService.updateProperty(propertyId, payload);
          await queryClient.invalidateQueries({ queryKey: ['properties'] });
          await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
          await queryClient.invalidateQueries({ queryKey: ['today'] });
          // Quiet, near-invisible confirmation via the live-status pill.
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

  const handleArchive = async () => {
    try {
      await propertyService.archive(propertyId);
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['today'] });
      showToast({ message: 'Propiedad archivada. Podés restaurarla cuando quieras.', tone: 'success' });
      window.setTimeout(() => navigate('/propiedades'), 700);
    } catch {
      showToast({ message: 'No pudimos archivar la propiedad.', tone: 'default' });
    }
  };

  const handleRestore = async () => {
    try {
      await propertyService.restore(propertyId);
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      await queryClient.invalidateQueries({ queryKey: ['today'] });
      showToast({ message: 'Propiedad restaurada.', tone: 'success' });
    } catch {
      showToast({ message: 'No pudimos restaurar la propiedad.', tone: 'default' });
    }
  };

  const liveLabel =
    liveStatus === 'saving' ? 'Guardando…' : liveStatus === 'saved' ? 'Guardado' : 'Reintentá';

  // Deep-link from "Hoy": scroll to and highlight the target section (Regla L).
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
              onClick={() => navigate('/propiedades')}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="vera-workspace__title" data-testid="workspace-title">
                {isNew ? 'Nueva propiedad' : detail!.title || 'Propiedad'}
              </h1>
              <p className="vera-muted">
                {isNew
                  ? 'VERA te acompaña hasta dejarla lista para publicar.'
                  : 'Toda la información de la propiedad, en un solo lugar.'}
              </p>
            </div>
          </div>
          <div className="vera-workspace__actions">
            {!isNew && liveStatus !== 'idle' && (
              <span className={`vera-live-status vera-live-status--${liveStatus}`} data-testid="live-status">
                {liveLabel}
              </span>
            )}
            <Button variant="primary" size="md" data-testid="workspace-save" disabled={saving} onClick={handleSave}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </header>

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
            <div id="ws-section-information">
              <Panel title="Información" description="Lo esencial para identificar la propiedad.">
                <BasicInfoSection />
              </Panel>
            </div>
            <div id="ws-section-features">
              <Panel title="Características" description="Ambientes y comodidades.">
                <FeaturesSection />
              </Panel>
            </div>
            <div id="ws-section-owner">
              <Panel title="Propietario" description="Quién es el dueño de la propiedad.">
                <OwnerSection />
              </Panel>
            </div>
            {!isNew && detail && (
              <div id="ws-section-tracking">
                <Panel title="Seguimiento" description="Visitas y contacto con el propietario.">
                  <TrackingSection propertyId={detail.id} address={detail.address} />
                </Panel>
              </div>
            )}
            <div id="ws-section-description">
              <Panel title="Descripción" description="Contala vos o dejá que VERA la redacte.">
                <DescriptionSection />
              </Panel>
            </div>
            <div id="ws-section-photos">
              <Panel title="Fotografías" description="El corazón de la publicación.">
                <PhotosSection
                  photos={photos}
                  onAddFiles={onAddPhotos}
                  onRemove={onRemovePhoto}
                  onSetCover={onSetCover}
                  onMove={onMovePhoto}
                />
              </Panel>
            </div>
            <div id="ws-section-documents">
              <Panel title="Documentos" description="Sumá el plano y otros documentos (PDF, JPG o PNG).">
                <DocumentsSection documents={documents} onAdd={onAddDoc} onRemove={onRemoveDoc} />
              </Panel>
            </div>
            <div id="ws-section-studio" hidden={!SHOW_VERA_STUDIO}>
              {SHOW_VERA_STUDIO && (
                <Panel title="Vera Studio" description="VERA analiza tus fotos y sugiere mejoras.">
                  <VeraStudioSection
                    photos={photos}
                    stages={stages}
                    processing={isNew ? studio.processing : false}
                    detectedRooms={analysis.detectedRooms}
                    duplicatesRemoved={analysis.duplicatesRemoved}
                  />
                </Panel>
              )}
            </div>
            {!isNew && (
              <Panel title="Ciclo de vida" description="Gestioná el estado de esta propiedad en VERA.">
                <div className="vera-lifecycle" data-testid="lifecycle-section">
                  {detail!.archived ? (
                    <>
                      <p className="vera-muted">
                        Esta propiedad está archivada: conserva toda su información y podés
                        restaurarla cuando quieras.
                      </p>
                      <Button variant="primary" size="md" data-testid="restore-property" onClick={handleRestore}>
                        Restaurar propiedad
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="vera-muted">
                        Archivar conserva toda la información (fotos, documentos, Health Score) y la
                        saca de la lista principal. Es reversible.
                      </p>
                      <Button variant="secondary" size="md" data-testid="archive-property" onClick={handleArchive}>
                        Archivar propiedad
                      </Button>
                    </>
                  )}
                </div>
              </Panel>
            )}
          </div>

          <aside className="vera-workspace__aside">
            <HealthScoreSection assessment={assessment} />
            <Panel title="Publicación" description="Qué tan lista está la propiedad.">
              <PublicationSection assessment={assessment} />
            </Panel>
          </aside>
        </div>

        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
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
