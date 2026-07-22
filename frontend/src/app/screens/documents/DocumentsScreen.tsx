import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Layers, Plus } from 'lucide-react';
import { Button } from '@vera/ui';
import { TemplatesList } from './TemplatesList';
import { DocumentsList } from './DocumentsList';

type Tab = 'documents' | 'templates';

/** App Documentos — motor documental de VERA (arquitectura fundacional).
 * Un documento es una entidad del negocio, no un PDF. Navegación:
 * Documentos → { Documents (instancias) | Templates (definiciones versionadas) }. */
export const DocumentsScreen = () => {
  const [tab, setTab] = useState<Tab>('documents');
  const navigate = useNavigate();

  return (
    <div className="vera-screen" data-testid="documents-screen">
      <div className="vera-docs__toolbar">
        <div className="vera-docs__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'documents'}
            className={`vera-docs__tab ${tab === 'documents' ? 'is-active' : ''}`}
            onClick={() => setTab('documents')}
            data-testid="tab-documents"
          >
            <FileText size={16} /> Documentos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'templates'}
            className={`vera-docs__tab ${tab === 'templates' ? 'is-active' : ''}`}
            onClick={() => setTab('templates')}
            data-testid="tab-templates"
          >
            <Layers size={16} /> Templates
          </button>
        </div>
        <Button onClick={() => navigate('/documentos/nuevo')} data-testid="new-document-btn">
          <Plus size={16} /> Nuevo Documento
        </Button>
      </div>

      {tab === 'documents' ? <DocumentsList /> : <TemplatesList />}
    </div>
  );
};

export default DocumentsScreen;
