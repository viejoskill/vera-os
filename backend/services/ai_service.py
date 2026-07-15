"""AI Service — intelligence layer. Currently MOCKED (deterministic, data-driven).
Contract is designed so the internals can be swapped for a real LLM without
changing Apps or other Services."""
from datetime import datetime, timedelta, timezone

# Argentina UTC-3
AR_TZ = timezone(timedelta(hours=-3))


class AiService:
    def __init__(self, insight_service):
        self.insights = insight_service

    def _greeting(self, hour):
        if hour < 12:
            return "Buenos días"
        if hour < 20:
            return "Buenas tardes"
        return "Buenas noches"

    async def daily_summary(self):
        ov = await self.insights.overview()
        c = ov["counts"]
        val = f"US$ {ov['portfolio_value']:,.0f}".replace(",", ".")
        summary = (
            f"Tenés {c['active']} propiedades activas por un valor de cartera de {val} "
            f"y {c['open_operations']} operaciones abiertas. "
        )
        if c["open_operations"] > 0:
            summary += "Hay pipeline en movimiento: priorizá las visitas y negociaciones de hoy."
        else:
            summary += "No hay operaciones abiertas: buen momento para captar nuevos leads."
        return summary

    async def focus(self):
        ov = await self.insights.overview()
        c = ov["counts"]
        items = []
        if c["reserved"] > 0:
            items.append(f"Seguí las {c['reserved']} propiedades reservadas para cerrar reserva.")
        items.append("Respondé los leads sin contactar dentro de las próximas 2 horas.")
        if c["active"] > 0:
            items.append("Actualizá fotos y precios de las publicaciones destacadas.")
        items.append("Confirmá las visitas agendadas para mañana.")
        return items[:4]

    async def ask(self, prompt: str):
        ov = await self.insights.overview()
        return {
            "answer": (
                f"[VERA AI · demo] Sobre \"{prompt.strip()[:80]}\": actualmente gestionás "
                f"{ov['counts']['active']} propiedades activas y {ov['counts']['open_operations']} "
                f"operaciones abiertas. Conectá el AI Service real para respuestas completas."
            ),
            "mocked": True,
        }

    def context(self):
        now = datetime.now(AR_TZ)
        meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        dias = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
        return {
            "greeting": self._greeting(now.hour),
            "date": now.isoformat(),
            "date_label": f"{dias[now.weekday()]}, {now.day} de {meses[now.month - 1]}",
        }
