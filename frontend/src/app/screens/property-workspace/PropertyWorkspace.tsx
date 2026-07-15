import { useMemo, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Panel, Toast } from '@vera/ui';
import { assistantService } from '@vera/services';
import { useVeraStudio } from '@app/hooks/useVeraStudio';
import {
  propertyFormSchema,
  defaultPropertyForm,
  type PropertyFormValues,
} from './form-schema';
import { BasicInfoSection } from './BasicInfoSection';
import { FeaturesSection } from './FeaturesSection';
import { DescriptionSection } from './DescriptionSection';
import { PhotosSection } from './PhotosSection';
import { VeraPanel } from './VeraPanel';

interface ToastState {
  message: string;
  tone: 'default' | 'success';
}

export const PropertyWorkspace = () => {
  const navigate = useNavigate();
  const studio = useVeraStudio();
  const [toast, setToast] = useState<ToastState | null>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: defaultPropertyForm,
    mode: 'onChange',
  });

  const values = form.watch();

  const insights = useMemo(
    () =>
      assistantService.analyze({
        values,
        photoCount: studio.photos.length,
        detectedRooms: studio.detectedRooms,
      }),
    [values, studio.photos.length, studio.detectedRooms],
  );

  const showToast = (state: ToastState) => {
    setToast(state);
    window.setTimeout(() => setToast(null), 2600);
  };

  const handleSaveDraft = () => showToast({ message: 'Borrador guardado (simulado)', tone: 'default' });

  const handleSave = form.handleSubmit(
    () => showToast({ message: 'Propiedad guardada (simulado)', tone: 'success' }),
    () => showToast({ message: 'Revisá los campos obligatorios', tone: 'default' }),
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
              <p className="vera-muted">Cargá una propiedad en minutos con la ayuda de VERA.</p>
            </div>
          </div>
          <div className="vera-workspace__actions">
            <Button variant="ghost" size="md" data-testid="workspace-cancel-btn" onClick={() => navigate('/propiedades')}>
              Cancelar
            </Button>
            <Button variant="secondary" size="md" data-testid="workspace-save-draft" onClick={handleSaveDraft}>
              Guardar borrador
            </Button>
            <Button variant="primary" size="md" data-testid="workspace-save" onClick={handleSave}>
              Guardar
            </Button>
          </div>
        </header>

        <div className="vera-workspace__grid">
          <div className="vera-workspace__main">
            <Panel title="Datos básicos" description="Lo esencial para identificar la propiedad.">
              <BasicInfoSection />
            </Panel>
            <Panel title="Características" description="Ambientes y comodidades.">
              <FeaturesSection />
            </Panel>
            <Panel title="Descripción" description="Contala vos o dejá que VERA la redacte.">
              <DescriptionSection />
            </Panel>
            <Panel title="Fotografías" description="El corazón de la publicación.">
              <PhotosSection
                photos={studio.photos}
                stages={studio.stages}
                processing={studio.processing}
                duplicatesRemoved={studio.duplicatesRemoved}
                onAddFiles={studio.addFiles}
                onRemove={studio.removePhoto}
              />
            </Panel>
          </div>

          <VeraPanel insights={insights} />
        </div>

        {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
    </FormProvider>
  );
};
