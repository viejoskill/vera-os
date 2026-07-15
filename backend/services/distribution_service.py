"""Distribution Service — external channels (Mercado Libre, Meta, Google, WhatsApp).
Connection state is MOCKED; the interface is ready for real OAuth integrations."""

CHANNELS = [
    {"id": "mercadolibre", "name": "Mercado Libre", "connected": True, "listings": 12,
     "description": "Publicá y sincronizá tu portafolio en el marketplace #1 de LatAm."},
    {"id": "meta", "name": "Meta (Facebook & Instagram)", "connected": True, "listings": 8,
     "description": "Catálogo y campañas en Facebook Marketplace e Instagram."},
    {"id": "google", "name": "Google Business", "connected": False, "listings": 0,
     "description": "Perfil de negocio y anuncios en la búsqueda de Google."},
    {"id": "whatsapp", "name": "WhatsApp Business", "connected": True, "listings": 0,
     "description": "Respuestas automáticas y difusión de propiedades a leads."},
]


class DistributionService:
    def channels(self):
        return CHANNELS

    def publish(self, channel_id, property_id):
        return {"ok": True, "channel": channel_id, "property_id": property_id, "mocked": True}
