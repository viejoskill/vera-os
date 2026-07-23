/**
 * VERA OS Studio — Cloudflare Worker (v2 · con contador de consumo por código)
 * ---------------------------------------------------------------------------
 * Función:
 *   - Valida el código de acceso (X-Vera-Code) contra VERA_CODES.
 *   - Reenvía los pedidos de IA a OpenAI con la key central (OPENAI_KEY).
 *   - Guarda modelos permitidos: gpt-4o-mini (texto) y gpt-image-1 (imagen, n=1).
 *   - NUEVO: registra cada generación exitosa por código en D1 (contador).
 *   - NUEVO: panel de administración en /admin?key=ADMIN_KEY (consumo por cliente).
 *
 * Rutas que usa el HTML de Studio:
 *   POST /chat    -> OpenAI chat completions  (texto: ideas, copys, plan del mes)
 *   POST /imagen  -> OpenAI images generations (fondos)
 *
 * Bindings/Variables (Cloudflare → Worker → Settings):
 *   OPENAI_KEY  (Secret)  — API key de OpenAI (única del sistema)
 *   VERA_CODES  (Text)    — códigos válidos separados por coma. Ej: VARELA-CDE-2026,VARELA-TUYU-2026
 *   ADMIN_KEY   (Secret)  — clave para ver el panel /admin
 *   DB          (D1)      — base D1 con la tabla `usage` (ver schema.sql)
 */

const OPENAI = {
  chat: "https://api.openai.com/v1/chat/completions",
  imagen: "https://api.openai.com/v1/images/generations",
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Vera-Code",
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(), ...extra },
  });
}

function validCodes(env) {
  return String(env.VERA_CODES || "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** Registra 1 generación (best-effort; nunca rompe el pedido si D1 falla). */
async function track(env, code, kind) {
  if (!env.DB || !code) return;
  const ym = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
  try {
    await env.DB.prepare(
      `INSERT INTO usage (code, kind, ym, n, last_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(code, kind, ym)
       DO UPDATE SET n = n + 1, last_at = excluded.last_at`
    )
      .bind(code, kind, ym, new Date().toISOString())
      .run();
  } catch (e) {
    /* no-op */
  }
}

async function handleAI(pathname, request, env) {
  const code = (request.headers.get("X-Vera-Code") || "").trim();
  if (!code) return json({ error: { message: "Falta el código de acceso." } }, 400);
  if (!validCodes(env).includes(code))
    return json({ error: { message: "Código de acceso inválido." } }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "Cuerpo inválido." } }, 400);
  }

  let target, kind;
  if (pathname === "/chat") {
    target = OPENAI.chat;
    kind = "texto";
    body.model = "gpt-4o-mini"; // guarda: solo texto barato
  } else {
    target = OPENAI.imagen;
    kind = "imagen";
    body.model = "gpt-image-1"; // guarda: solo este modelo
    body.n = 1; // guarda: máximo 1 imagen por pedido
  }

  const r = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (r.ok) {
    // Solo contamos generaciones exitosas.
    await track(env, code, kind);
  }
  return json(data, r.status);
}

/** Panel /admin (HTML) y /admin/usage (JSON) — protegidos por ADMIN_KEY. */
async function handleAdmin(url, env) {
  const key = url.searchParams.get("key") || "";
  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY)
    return json({ error: { message: "No autorizado." } }, 401);
  if (!env.DB) return json({ error: { message: "D1 no configurada (binding DB)." } }, 500);

  const { results } = await env.DB.prepare(
    `SELECT code, kind, ym, n, last_at FROM usage ORDER BY code, ym DESC, kind`
  ).all();

  if (url.pathname === "/admin/usage") return json({ rows: results || [] });

  // Agregado por código: mes actual + total histórico.
  const ymNow = new Date().toISOString().slice(0, 7);
  const byCode = {};
  for (const row of results || []) {
    const bucket = (byCode[row.code] = byCode[row.code] || {
      code: row.code,
      mesTexto: 0,
      mesImagen: 0,
      totTexto: 0,
      totImagen: 0,
      last: "",
    });
    if (row.kind === "texto") bucket.totTexto += row.n;
    else bucket.totImagen += row.n;
    if (row.ym === ymNow) {
      if (row.kind === "texto") bucket.mesTexto += row.n;
      else bucket.mesImagen += row.n;
    }
    if (row.last_at && row.last_at > bucket.last) bucket.last = row.last_at;
  }
  const codes = Object.values(byCode).sort((a, b) => a.code.localeCompare(b.code));

  const rowsHtml =
    codes
      .map(
        (x) => `<tr>
      <td class="code">${x.code}</td>
      <td>${x.mesTexto}</td>
      <td>${x.mesImagen}</td>
      <td class="tot">${x.mesTexto + x.mesImagen}</td>
      <td>${x.totTexto}</td>
      <td>${x.totImagen}</td>
      <td class="tot">${x.totTexto + x.totImagen}</td>
      <td class="muted">${x.last ? new Date(x.last).toLocaleString("es-AR") : "—"}</td>
    </tr>`
      )
      .join("") ||
    `<tr><td colspan="8" class="muted" style="text-align:center;padding:24px">Sin consumo registrado todavía.</td></tr>`;

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VERA Studio · Consumo por código</title>
<style>
  :root{ --oro:#f2e23c; --bg:#0e0e10; --card:#17181c; --line:#2a2b30; --txt:#f5f1e6; --muted:#8a8b90; }
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:28px}
  h1{font-size:1.4rem;margin:0 0 4px;letter-spacing:.02em}
  .sub{color:var(--muted);font-size:.85rem;margin-bottom:22px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  table{width:100%;border-collapse:collapse}
  th,td{padding:11px 14px;text-align:right;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
  th:first-child,td:first-child{text-align:left}
  thead th{background:#101114;color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;position:sticky;top:0}
  .code{font-weight:700;color:var(--oro)}
  .tot{font-weight:700}
  .muted{color:var(--muted)}
  .grp{background:#101114;color:var(--muted);font-size:.72rem}
  caption{caption-side:top;text-align:left;color:var(--muted);font-size:.75rem;padding:8px 14px}
</style></head><body>
  <h1>VERA Studio · Consumo por código</h1>
  <div class="sub">Mes actual: <b>${ymNow}</b> · texto = gpt-4o-mini (copys/ideas/plan) · imagen = gpt-image-1 (fondos)</div>
  <div class="card">
    <table>
      <thead>
        <tr>
          <th rowspan="2">Código</th>
          <th colspan="3" class="grp" style="text-align:center">Mes actual</th>
          <th colspan="3" class="grp" style="text-align:center">Histórico</th>
          <th rowspan="2">Última actividad</th>
        </tr>
        <tr>
          <th>Texto</th><th>Imagen</th><th>Total</th>
          <th>Texto</th><th>Imagen</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=UTF-8", ...cors() },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    if (url.pathname === "/" || url.pathname === "")
      return new Response("servidor activo", { headers: cors() });

    if (url.pathname === "/admin" || url.pathname === "/admin/usage")
      return handleAdmin(url, env);

    if (request.method === "POST" && (url.pathname === "/chat" || url.pathname === "/imagen"))
      return handleAI(url.pathname, request, env);

    return json({ error: { message: "Ruta no encontrada." } }, 404);
  },
};
