# Brand assets — logos oficiales de integraciones/herramientas

Colocá acá los PNG OFICIALES de cada marca, con nombres **estandarizados** (sin
prefijos como `google*`). El `BrandRegistry` (`packages/config/brand-registry.ts`)
los resuelve automáticamente y `BrandIcon` (`packages/ui/BrandIcon.tsx`) los usa;
mientras un PNG no exista, se muestra el ícono vectorial de fallback.

Nombres esperados (uno por marca):
gmail.png, whatsapp.png, spotify.png, calendar.png, drive.png, instagram.png,
facebook.png, linkedin.png, youtube.png, tiktok.png, openai.png, claude.png,
gemini.png, notion.png, slack.png, trello.png, canva.png

Formato sugerido: PNG cuadrado con fondo transparente (idealmente 128×128 o 256×256).
