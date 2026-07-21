"""VERA Core — projections (read-models) derivadas del Event Pipeline.

Los eventos son la fuente de verdad (inmutables). Este paquete contiene las
ENTIDADES DE NEGOCIO derivadas (Leads, Oportunidades, Tareas) y los projection
handlers que reaccionan a cada evento para crearlas/actualizarlas. Toda la lógica
de negocio vive acá; ningún proveedor conversacional la conoce."""
