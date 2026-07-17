import type {
  PublicationAction,
  PublicationGateway,
  PublicationsMap,
} from '@vera/repositories';

/**
 * PublicationService — administra dónde está publicada la propiedad (Centro de
 * Publicación). VERA nunca publica sola: registra el estado que el profesional decide.
 * Reusable/escalable: agregar proveedores no cambia esta capa.
 */
export class PublicationService {
  constructor(private readonly gateway: PublicationGateway) {}

  setPublication(
    propertyId: string,
    channel: string,
    action: PublicationAction,
  ): Promise<PublicationsMap> {
    return this.gateway.setPublication(propertyId, channel, action);
  }
}
