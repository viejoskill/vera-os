import type { Property } from '@vera/types';
import type { PropertyFilesGateway, PropertyRepository } from '@vera/repositories';

export interface WorkspacePhoto {
  file: File;
  isCover: boolean;
}

export interface WorkspaceDocument {
  file: File;
  docType: string;
}

export interface SavePropertyInput {
  values: Partial<Property>;
  photos: WorkspacePhoto[];
  documents: WorkspaceDocument[];
}

/**
 * WorkspaceService — orchestrates persisting a full property from the Workspace:
 * creates the record, uploads photos (in order) and documents, and honours the
 * user's manual cover choice. Depends on abstractions, never on the backend impl.
 */
export class WorkspaceService {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly files: PropertyFilesGateway,
  ) {}

  async save(input: SavePropertyInput): Promise<Property> {
    const created = await this.properties.create(input.values as Property);

    const uploaded = [];
    for (const photo of input.photos) {
      uploaded.push(await this.files.uploadImage(created.id, photo.file));
    }

    const coverIndex = input.photos.findIndex((p) => p.isCover);
    if (coverIndex > 0 && uploaded[coverIndex]) {
      await this.files.setCover(created.id, uploaded[coverIndex].id);
    }

    for (const doc of input.documents) {
      await this.files.uploadDocument(created.id, doc.file, doc.docType);
    }

    return created;
  }
}
