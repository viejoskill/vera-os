import type { Owner } from '@vera/types';

const MOCK_OWNERS: Owner[] = [
  { id: 'own-1', name: 'María González', email: 'maria.gonzalez@email.com', phone: '+54 11 5555-1234' },
  { id: 'own-2', name: 'Javier Fernández', email: 'javier.fernandez@email.com', phone: '+54 11 5555-9876' },
  { id: 'own-3', name: 'Estudio Patrimonial SA', email: 'contacto@patrimonial.com', phone: '+54 11 4000-2020' },
];

/**
 * OwnerService — owns the property owners domain (mock).
 * The API returns a list so the UI can later support multiple owners per property.
 */
export class OwnerService {
  listOwners(): Owner[] {
    return [...MOCK_OWNERS];
  }

  getOwner(id: string): Owner | null {
    return MOCK_OWNERS.find((o) => o.id === id) ?? null;
  }
}
