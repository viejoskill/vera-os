import { useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button, Panel, Progress, Toast } from '@vera/ui';
import { assistantService, workspaceService } from '@vera/services';
import type { Property } from '@vera/types';
import { useVeraStudio } from '@app/hooks/useVeraStudio';
import { useDocuments } from '@app/hooks/useDocuments';
import { propertyFormSchema, defaultPropertyForm, type PropertyFormValues } from './form-schema';
import { BasicInfoSection } from './BasicInfoSection';
import { FeaturesSection } from './FeaturesSection';
import { DescriptionSection } from './DescriptionSection';
import { OwnerSection } from './OwnerSection';
import { PhotosSection } from './PhotosSection';
import { DocumentsSection } from './DocumentsSection';
import { VeraStudioSection } from './VeraStudioSection';
import { PublicationSection } from './PublicationSection';
import { HealthScoreSection } from './HealthScoreSection';

interface ToastState {
  message: string;
  tone: 'default' | 'success';
}

export const PropertyWorkspace = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const studio = useVeraStudio();
  const documents = useDocuments();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: defaultPropertyForm,
    mode: 'onChange',
  });

  const values = form.watch();

  const assessment = useMemo(
    () =>
      assistantService.assess({
        values,
        photoCount: studio.photos.length,
        documentTypes: documents.documents.map((d) => d.type),
      }),
    [values, studio.photos.length, documents.documents],
  );

  const showToast = (state: ToastState) => {
    setToast(state);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleSaveDraft = () =>
    showToast({ message: 'Guardamos tu borrador. Podés seguir cuando quieras.', tone: 'default' });

  const toNumber = (value: string) => (value?.trim() ? Number(value) : 0);

  const handleSave = form.handleSubmit(
    async (values) => {
      setSaving(true);
      try {
        const payload = {
          title: values.title,
          operation: values.operation,
          type: values.type as Property['type'],
          price: toNumber(values.price),
          currency: values.currency,
          address: values.address,
          neighborhood: values.neighborhood,
          city: values.city,
          bedrooms: Math.trunc(toNumber(values.bedrooms)),
          bathrooms: Math.trunc(toNumber(values.bathrooms)),
          areaM2: toNumber(values.areaM2),
          yearBuilt: values.yearBuilt,
          videoUrl: values.videoUrl,
          status: 'active' as const,
          description: values.description,
        };
        const photos = studio.photos
          .filter((p) => p.file)
          .map((p) => ({ file: p.file as File, isCover: p.isCover }));
        const docs = documents.documents
          .filter((d) => d.file)
          .map((d) => ({ file: d.file as File, docType: d.type }));

        await workspaceService.save({ values: payload, photos, documents: docs });
        await queryClient.invalidateQueries({ queryKey: ['properties'] });
        showToast({ message: 'Listo, guardamos la propiedad en VERA.', tone: 'success' });
        window.setTimeout(() => navigate('/propiedades'), 800);
      } catch {
        showToast({
          message: 'No pudimos guardar la propiedad. Reintentá en un momento.',
          tone: 'default',
        });
      } finally {
        setSaving(false);
      }
    },
    () =>
      showToast({ message: 'Todavía faltan algunos datos. VERA te muestra cuáles.', tone: 'default' }),
  );

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
              <h1 className="vera-workspace__title">Nueva propiedad</h1>
              <p className="vera-muted">VERA te acompaña hasta dejarla lista para publicar.</p>
            </div>
          </div>
          <div className="vera-workspace__actions">
            <Button variant="ghost" size="md" data-testid="workspace-cancel-btn" onClick={() => navigate('/propiedades')}>
              Cancelar
            </Button>
            <Button variant="secondary" size="md" data-testid="workspace-save-draft" onClick={handleSaveDraft}>
              Guardar borrador
            </Button>
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
            <Panel title="Información" description="Lo esencial para identificar la propiedad.">
              <BasicInfoSection />
            </Panel>
            <Panel title="Características" description="Ambientes y comodidades.">
              <FeaturesSection />
            </Panel>
            <Panel title="Propietario" description="Quién es el dueño de la propiedad.">
              <OwnerSection />
            </Panel>
            <Panel title="Descripción" description="Contala vos o dejá que VERA la redacte.">
              <DescriptionSection />
            </Panel>
            <Panel title="Fotografías" description="El corazón de la publicación.">
              <PhotosSection
                photos={studio.photos}
                onAddFiles={studio.addFiles}
                onRemove={studio.removePhoto}
                onSetCover={studio.setCover}
                onMove={studio.movePhoto}
              />
            </Panel>
            <Panel title="Documentos" description="Sumá el plano y otros documentos (PDF, JPG o PNG).">
              <DocumentsSection
                documents={documents.documents}
                onAdd={documents.addDocument}
                onRemove={documents.removeDocument}
              />
            </Panel>
            <Panel title="Vera Studio" description="VERA analiza tus fotos y sugiere mejoras.">
              <VeraStudioSection
                photos={studio.photos}
                stages={studio.stages}
                processing={studio.processing}
                detectedRooms={studio.detectedRooms}
                duplicatesRemoved={studio.duplicatesRemoved}
              />
            </Panel>
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
