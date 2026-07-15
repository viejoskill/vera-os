import { useRef } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import type { PropertyDocument, DocumentType } from '@vera/types';

interface Slot {
  type: DocumentType;
  label: string;
  hint: string;
}

// Add future document types here — the UI iterates over this list.
const DOCUMENT_SLOTS: Slot[] = [{ type: 'plano', label: 'Plano', hint: 'PDF, JPG o PNG' }];

interface DocumentsSectionProps {
  documents: PropertyDocument[];
  onAdd: (type: DocumentType, file: File) => void;
  onRemove: (id: string) => void;
}

const DocumentSlot = ({
  slot,
  doc,
  onAdd,
  onRemove,
}: {
  slot: Slot;
  doc?: PropertyDocument;
  onAdd: (type: DocumentType, file: File) => void;
  onRemove: (id: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="vera-doc" data-testid={`doc-slot-${slot.type}`}>
      <div className="vera-doc__head">
        <span className="vera-doc__icon">
          <FileText size={16} />
        </span>
        <div>
          <div className="vera-doc__label">{slot.label}</div>
          <div className="vera-muted">{slot.hint}</div>
        </div>
      </div>

      {doc ? (
        <div className="vera-doc__file" data-testid={`doc-${slot.type}`}>
          <span className="vera-doc__name">{doc.name}</span>
          <button
            type="button"
            aria-label={`Quitar ${slot.label}`}
            data-testid={`doc-remove-${slot.type}`}
            className="vera-doc__remove"
            onClick={() => onRemove(doc.id)}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="vera-doc__upload"
          data-testid={`doc-upload-${slot.type}`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} /> Subir {slot.label.toLowerCase()}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        hidden
        data-testid={`doc-input-${slot.type}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(slot.type, file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

export const DocumentsSection = ({ documents, onAdd, onRemove }: DocumentsSectionProps) => (
  <div className="vera-form" data-testid="documents-section">
    {DOCUMENT_SLOTS.map((slot) => (
      <DocumentSlot
        key={slot.type}
        slot={slot}
        doc={documents.find((d) => d.type === slot.type)}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    ))}
  </div>
);
