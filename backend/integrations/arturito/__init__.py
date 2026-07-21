"""Arturito — primer adapter conversacional de VERA.

- `adapter.py`: recibe los webhooks de Arturito (lead.created / lead.attended),
  valida la firma HMAC-SHA256 y los traduce al Conversation Adapter Contract
  (`events.pipeline.ingest`). VERA Core reacciona igual que con cualquier adapter.
- `client.py`: cliente tRPC (API Key) para provisionar webhooks hoy y, más
  adelante, hacer el backfill histórico. VERA Core no lo conoce.
"""
