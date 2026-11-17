/**
 * Descarga/abre un archivo protegido del backend de VERA OS (requiere sesión).
 * El navegador no puede mandar el header Authorization en una navegación directa
 * (anchor/window.open/iframe), así que lo pedimos con fetch (el interceptor le
 * agrega el Bearer solo) y lo mostramos como blob.
 */
export async function downloadWithAuth(url: string, filename?: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(res.status === 403 ? 'No tenés permiso para descargar este archivo.' : 'No se pudo descargar el archivo.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  if (filename) a.download = filename;
  else a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}
