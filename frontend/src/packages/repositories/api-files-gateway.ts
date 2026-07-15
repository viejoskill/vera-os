import { env } from '@vera/config';

export interface UploadedImage {
  id: string;
  isCover: boolean;
}

/** Uploads property files through the VERA backend. The frontend never touches
 *  Supabase Storage — the backend signs and stores everything. */
export interface PropertyFilesGateway {
  uploadImage(propertyId: string, file: File): Promise<UploadedImage>;
  uploadDocument(propertyId: string, file: File, docType: string): Promise<{ id: string }>;
  setCover(propertyId: string, imageId: string): Promise<void>;
}

export class ApiPropertyFilesGateway implements PropertyFilesGateway {
  private readonly base = `${env.backendUrl}/api/properties`;

  async uploadImage(propertyId: string, file: File): Promise<UploadedImage> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${this.base}/${propertyId}/images`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload image failed: ${res.status}`);
    const json = await res.json();
    return { id: json.id, isCover: json.isCover };
  }

  async uploadDocument(propertyId: string, file: File, docType: string): Promise<{ id: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', docType);
    const res = await fetch(`${this.base}/${propertyId}/documents`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload document failed: ${res.status}`);
    const json = await res.json();
    return { id: json.id };
  }

  async setCover(propertyId: string, imageId: string): Promise<void> {
    const res = await fetch(`${this.base}/${propertyId}/images/${imageId}/cover`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error(`Set cover failed: ${res.status}`);
  }
}
