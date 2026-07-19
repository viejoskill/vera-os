"""Capa de Conversaciones — dominio vendor-agnóstico de VERA.

Define el CONTRATO permanente (`ConversationProvider`) y su modelo de dominio
canónico. VERA Brain y el Insights Engine consumen SÓLO este contrato; nunca a un
proveedor concreto (Arturito, WhatsApp Cloud, Kommo, HubSpot, Tokko, EasyBroker…).

Filosofía "sistema operativo": los proveedores son DRIVERS. VERA define la
interfaz; cualquier proveedor compatible se conecta implementándola. Lo permanente
es el contrato, no la herramienta.
"""
