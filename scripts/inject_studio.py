#!/usr/bin/env python3
"""Inyecta el puente de persistencia de VERA OS en un HTML de Vera Studio.

El puente sobrescribe `window.storage` para que Studio guarde su estado
(identidad, logo, plan) en el backend de VERA atado al usuario logueado
(?u=<userId>), sincronizando entre PCs. Sin usuario, cae a localStorage.

Uso:
    python /app/scripts/inject_studio.py <origen.html> <destino.html>
"""
import sys

BRIDGE = """<script>
/* === VERA OS \u00b7 puente de persistencia ==========================================
 * Studio ya soporta un adaptador `window.storage`. Al embeberlo dentro del OS le
 * inyectamos uno que guarda el estado (identidad, logo, plan) en el backend de
 * VERA, atado al usuario logueado (?u=<userId>). Asi sincroniza entre PCs.
 * Si no hay usuario (uso standalone del archivo), cae solo a localStorage.
 * ============================================================================== */
(function () {
  var uid = null;
  try { uid = new URLSearchParams(location.search).get('u'); } catch (e) {}
  if (!uid) return; // sin usuario -> el tool usa localStorage como siempre

  function kvUrl(key) {
    return '/api/studio/kv/' + encodeURIComponent(key) + '?u=' + encodeURIComponent(uid);
  }

  window.storage = {
    async get(key) {
      try {
        var r = await fetch(kvUrl(key), { headers: { 'Accept': 'application/json' } });
        if (!r.ok) return null;
        var j = await r.json();
        return (j && j.value != null) ? { value: j.value } : null;
      } catch (e) { return null; }
    },
    async set(key, value) {
      try {
        await fetch(kvUrl(key), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: value })
        });
      } catch (e) {
        try { localStorage.setItem(key, value); } catch (e2) {}
      }
    }
  };
})();
</script>
</head>"""


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, "r", encoding="utf-8") as f:
        html = f.read()
    if "puente de persistencia" in html or "/api/studio/kv/" in html:
        print("El HTML ya tiene el puente inyectado; no se reinyecta.")
        out = html
    elif "</head>" not in html:
        raise SystemExit("ERROR: el HTML no tiene </head>; no se puede inyectar.")
    else:
        out = html.replace("</head>", BRIDGE, 1)
        print("Puente inyectado antes de </head>.")
    with open(dst, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Guardado en {dst} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
