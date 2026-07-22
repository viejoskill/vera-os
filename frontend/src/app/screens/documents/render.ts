/** Render de documentos: interpolación de variables + bloques condicionales.
 * Reutilizado por la pantalla de firma y el detalle del documento (y, a futuro,
 * por el generador de PDF). Un documento se firma, no un PDF. */

export interface DocBlock {
  type: string;
  value: string;
  condition?: DocCondition;
}
export interface DocCondition {
  var: string;
  equals?: string | number;
  in?: (string | number)[];
  notEmpty?: boolean;
}
export interface DocBody {
  blocks?: DocBlock[];
}

export function interpolate(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null || v === '' ? '' : String(v);
  });
}

export function isBlockVisible(block: DocBlock, vars: Record<string, unknown>): boolean {
  const c = block.condition;
  if (!c) return true;
  const value = vars[c.var];
  if (c.notEmpty) return value !== undefined && value !== null && value !== '';
  if (c.in) return c.in.map(String).includes(String(value));
  if (c.equals !== undefined) return String(value) === String(c.equals);
  return true;
}

/** Bloques visibles con su texto interpolado (respeta condiciones). */
export function renderBlocks(body: unknown, vars: Record<string, unknown>): DocBlock[] {
  const blocks = (body as DocBody)?.blocks ?? [];
  return blocks
    .filter((b) => isBlockVisible(b, vars))
    .map((b) => ({ ...b, value: interpolate(b.value, vars) }));
}
