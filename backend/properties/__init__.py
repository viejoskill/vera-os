"""Capa de Propiedades — dominio vendor-agnóstico de la cartera inmobiliaria.

Define el CONTRATO `PropertyProvider` y el modelo canónico `Property`. VERA razona
sobre la cartera SÓLO a través de este contrato; nunca conoce Supabase ni un CRM
concreto. Cambiar de fuente = implementar la interfaz y cambiar `active_property_provider`.
"""
