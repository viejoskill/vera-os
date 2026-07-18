import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  ListChecks,
  Radio,
  Star,
  CalendarDays,
  CheckSquare,
  Activity,
  CloudSun,
  Newspaper,
  TrendingUp,
  Play,
  Pause,
  Volume2,
  ArrowUpRight,
  MapPin,
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudSnow,
  CloudFog,
  CloudLightning,
  type LucideIcon,
} from 'lucide-react';
import { useToday } from '@app/hooks/useToday';
import { useProperties } from '@app/hooks/useProperties';
import { useAuthUser } from '@app/auth/useAuthUser';
import { useWeather } from '@app/hooks/useWeather';
import { useDolar } from '@app/hooks/useDolar';
import type { InboxRecommendation } from '@vera/types';

/* --------------------------- Saludo / Fecha / Hora ---------------------- */
const greetingText = (h: number) => (h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches');

export const GreetingWidget = () => {
  const { greetingName } = useAuthUser();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="vera-w-greeting" data-testid="widget-body-greeting">
      <p className="vera-w-greeting__hello">{greetingText(now.getHours())}, {greetingName}</p>
      <p className="vera-w-greeting__time">{time}</p>
      <p className="vera-w-greeting__date">{date}</p>
    </div>
  );
};

/* ----------------------------- Prioridades (VIE) ------------------------ */
const recUrl = (r: InboxRecommendation): string => {
  const t = r.target;
  if (!t?.entityId) return '/propiedades';
  const p = new URLSearchParams({ section: t.section });
  if (t.focus) p.set('focus', t.focus);
  return `/propiedades/${t.entityId}?${p.toString()}`;
};

/** Miniatura de la foto principal de una propiedad; si la imagen falla, cae al
 * punto de prioridad (nunca deja un recuadro vacío). */
const PrioThumb = ({ src, priority, dotClass }: { src: string; priority: string; dotClass: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`vera-dot vera-dot--${dotClass}`} />;
  return (
    <span className={`vera-w-prio__thumb vera-w-prio__thumb--${priority}`}>
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
};

export const PrioridadesWidget = () => {
  const { data, isLoading } = useToday();
  const { data: properties } = useProperties();
  const navigate = useNavigate();

  const coverById = useMemo(() => {
    const m = new Map<string, string>();
    (properties ?? []).forEach((p) => {
      if (p.coverImage) m.set(p.id, p.coverImage);
    });
    return m;
  }, [properties]);

  const items = (data?.recommendations ?? []).slice(0, 3);
  if (isLoading) return <p className="vera-muted">VERA está revisando tu día…</p>;
  if (!items.length)
    return <p className="vera-muted" data-testid="widget-body-prioridades">Todo al día. Sin pendientes urgentes ✨</p>;
  return (
    <ul className="vera-w-list" data-testid="widget-body-prioridades">
      {items.map((r) => {
        const dotClass = r.priority === 'alta' ? 'error' : r.priority === 'atencion' ? 'pending' : 'published';
        const cover = r.target?.entity === 'property' ? coverById.get(r.target.entityId) : undefined;
        return (
          <li key={r.id}>
            <button type="button" className="vera-w-listitem vera-w-prio" onClick={() => navigate(recUrl(r))}>
              {cover ? (
                <PrioThumb src={cover} priority={r.priority} dotClass={dotClass} />
              ) : (
                <span className={`vera-dot vera-dot--${dotClass}`} />
              )}
              <span className="vera-w-listitem__text">
                <span className="vera-w-listitem__title">{r.title}</span>
                <span className="vera-w-listitem__sub">{r.subject}</span>
              </span>
              <ArrowUpRight size={15} />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

/* --------------------------------- Audio -------------------------------- */
const STATIONS = [
  { id: 'aspen', name: 'Aspen 102.3', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3' },
  { id: 'rockpop', name: 'Rock & Pop 95.9', stream: 'https://ipanel.instream.audio:7002/stream' },
  { id: 'la100', name: 'La 100 · 99.9', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/FM999_56AAC.aac' },
  { id: 'metro', name: 'Metro 95.1', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO.mp3' },
  { id: 'vorterix', name: 'Vorterix 92.1', stream: 'https://ice2.edge-apps.net/radio1_high-20057.audio' },
];

export const AudioWidget = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, station]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    setError(false);
    setLoading(true);
    el.volume = volume;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const pick = (s: typeof STATIONS[number]) => {
    const wasPlaying = playing;
    setStation(s);
    setPlaying(false);
    setError(false);
    window.setTimeout(async () => {
      const el = audioRef.current;
      if (!el) return;
      el.load();
      el.volume = volume;
      if (wasPlaying) {
        try {
          await el.play();
          setPlaying(true);
        } catch {
          setError(true);
        }
      }
    }, 0);
  };

  const label = error ? 'No disponible' : loading ? 'Conectando…' : playing ? 'En vivo' : 'En pausa';

  return (
    <div className="vera-w-audio" data-testid="widget-body-audio">
      <audio
        ref={audioRef}
        src={station.stream}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setError(true);
          setLoading(false);
        }}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
        }}
      />
      <div className="vera-w-audio__now">
        <span className={`vera-w-audio__eq ${playing ? 'is-on' : ''}`.trim()} aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <div>
          <p className="vera-w-audio__station">{station.name}</p>
          <p className="vera-w-audio__label">{label}</p>
        </div>
        <button type="button" className="vera-w-audio__play" data-testid="audio-toggle" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
      <div className="vera-w-audio__stations">
        {STATIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`vera-chip ${station.id === s.id ? 'vera-chip--active' : ''}`.trim()}
            data-testid={`station-${s.id}`}
            onClick={() => pick(s)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="vera-w-audio__vol">
        <Volume2 size={15} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          data-testid="audio-volume"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audioRef.current) audioRef.current.volume = v;
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------- Favoritos ----------------------------- */
const FAVS = [
  { title: 'Casa 3 amb. en Costa del Este', place: 'Costa del Este', code: 'VAR-102' },
  { title: 'Departamento con balcón', place: 'Palermo', code: 'VAR-118' },
  { title: 'PH luminoso a reciclar', place: 'Caballito', code: 'VAR-131' },
];

export const FavoritesWidget = () => (
  <ul className="vera-w-list" data-testid="widget-body-favoritos">
    {FAVS.map((f) => (
      <li key={f.code}>
        <div className="vera-w-listitem vera-w-listitem--static">
          <Star size={15} className="vera-w-star" />
          <span className="vera-w-listitem__text">
            <span className="vera-w-listitem__title">{f.title}</span>
            <span className="vera-w-listitem__sub"><MapPin size={11} /> {f.place} · {f.code}</span>
          </span>
        </div>
      </li>
    ))}
  </ul>
);

/* -------------------------------- Agenda -------------------------------- */
const EVENTS = [
  { time: '10:30', title: 'Visita — Casa Costa del Este' },
  { time: '13:00', title: 'Llamado con propietario' },
  { time: '17:00', title: 'Firma de reserva' },
];
export const AgendaWidget = () => (
  <ul className="vera-w-agenda" data-testid="widget-body-agenda">
    {EVENTS.map((e) => (
      <li key={e.time}>
        <span className="vera-w-agenda__time">{e.time}</span>
        <span className="vera-w-agenda__title">{e.title}</span>
      </li>
    ))}
  </ul>
);

/* -------------------------------- Tareas -------------------------------- */
const TASKS = ['Actualizar precio de 2 propiedades', 'Responder consulta de Zonaprop', 'Subir fotos nuevas'];
export const TasksWidget = () => {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <ul className="vera-w-tasks" data-testid="widget-body-tareas">
      {TASKS.map((t, i) => (
        <li key={t}>
          <button
            type="button"
            className={`vera-w-task ${done[i] ? 'is-done' : ''}`.trim()}
            onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
          >
            <span className="vera-w-task__box"><CheckSquare size={14} /></span>
            {t}
          </button>
        </li>
      ))}
    </ul>
  );
};

/* --------------------------- Actividad reciente ------------------------- */
const ACTIVITY = [
  { who: 'Vos', what: 'publicaste "Casa Costa del Este" en Mercado Libre', when: 'hace 12 min' },
  { who: 'VERA', what: 'sugirió actualizar el precio de 2 avisos', when: 'hace 1 h' },
  { who: 'Vos', what: 'registraste una visita', when: 'ayer' },
];
export const ActivityWidget = () => (
  <ul className="vera-w-list" data-testid="widget-body-actividad">
    {ACTIVITY.map((a, i) => (
      <li key={i}>
        <div className="vera-w-listitem vera-w-listitem--static">
          <Activity size={15} className="vera-w-star" />
          <span className="vera-w-listitem__text">
            <span className="vera-w-listitem__title">{a.what}</span>
            <span className="vera-w-listitem__sub">{a.who} · {a.when}</span>
          </span>
        </div>
      </li>
    ))}
  </ul>
);

/* --------------------------------- Clima -------------------------------- */
const weatherIcon = (code: number): LucideIcon => {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code <= 48) return CloudFog;
  if (code <= 57) return CloudDrizzle;
  if (code <= 67) return CloudRain;
  if (code <= 77) return CloudSnow;
  if (code <= 82) return CloudRain;
  if (code <= 86) return CloudSnow;
  return CloudLightning;
};

export const WeatherWidget = () => {
  const { data, isLoading, isError } = useWeather();
  if (isLoading) return <p className="vera-muted" data-testid="widget-body-clima">Cargando clima…</p>;
  if (isError || !data)
    return <p className="vera-muted" data-testid="widget-body-clima">Clima no disponible</p>;
  const Icon = weatherIcon(data.code);
  return (
    <div className="vera-w-weather" data-testid="widget-body-clima">
      <Icon size={40} className="vera-w-weather__icon" />
      <div>
        <p className="vera-w-weather__temp">{data.temp}°</p>
        <p className="vera-w-weather__desc">{data.description} · {data.city}</p>
      </div>
    </div>
  );
};

/* -------------------------------- Noticias ------------------------------ */
const NEWS = [
  'El mercado inmobiliario crece 8% interanual',
  'Nuevas líneas de crédito hipotecario',
  'Costa Atlántica: fuerte demanda de alquiler turístico',
];
export const NewsWidget = () => (
  <ul className="vera-w-list" data-testid="widget-body-noticias">
    {NEWS.map((n, i) => (
      <li key={i}>
        <div className="vera-w-listitem vera-w-listitem--static">
          <Newspaper size={15} className="vera-w-star" />
          <span className="vera-w-listitem__text"><span className="vera-w-listitem__title">{n}</span></span>
        </div>
      </li>
    ))}
  </ul>
);

/* ------------------------------ Cotizaciones ---------------------------- */
/** Dólar hoy en vivo (DolarApi). Anima solo el número cuando cambia el valor. */
export const QuotesWidget = () => {
  const { data, isLoading, isError } = useDolar();
  const [flash, setFlash] = useState<Record<string, boolean>>({});
  const prev = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!data) return;
    const changed: Record<string, boolean> = {};
    data.forEach((q) => {
      if (prev.current[q.label] !== undefined && prev.current[q.label] !== q.venta) {
        changed[q.label] = true;
      }
      prev.current[q.label] = q.venta;
    });
    if (Object.keys(changed).length) {
      setFlash(changed);
      const t = window.setTimeout(() => setFlash({}), 700);
      return () => window.clearTimeout(t);
    }
  }, [data]);

  if (isLoading) return <p className="vera-muted" data-testid="widget-body-cotizaciones">Cargando cotizaciones…</p>;
  if (isError || !data)
    return <p className="vera-muted" data-testid="widget-body-cotizaciones">Cotizaciones no disponibles</p>;

  return (
    <ul className="vera-w-quotes" data-testid="widget-body-cotizaciones">
      {data.map((q) => (
        <li key={q.label}>
          <span className="vera-w-quotes__label">{q.label}</span>
          <span className={`vera-w-quotes__value ${flash[q.label] ? 'is-flash' : ''}`.trim()}>
            $ {q.venta.toLocaleString('es-AR')}
          </span>
        </li>
      ))}
    </ul>
  );
};

/* ------------------------------- Calendario ----------------------------- */
/** Vista mensual (distinta de Agenda, que es una lista). Mock: marca hoy y
 * algunos días con eventos. No requiere integración real todavía. */
const EVENT_DAYS = new Set([3, 9, 12, 18, 24, 27]);
const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const CalendarWidget = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const monthLabel = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS: 0=Sunday..6=Saturday → shift to Monday-first (0=Mon..6=Sun).
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="vera-w-cal" data-testid="widget-body-calendario">
      <p className="vera-w-cal__month">{monthLabel}</p>
      <div className="vera-w-cal__grid">
        {WEEK_DAYS.map((d, i) => (
          <span key={`h-${i}`} className="vera-w-cal__dow">{d}</span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e-${i}`} className="vera-w-cal__cell" />;
          const isToday = d === today;
          const hasEvent = EVENT_DAYS.has(d);
          return (
            <span
              key={`d-${d}`}
              className={`vera-w-cal__cell vera-w-cal__day ${isToday ? 'is-today' : ''}`.trim()}
            >
              {d}
              {hasEvent && !isToday && <span className="vera-w-cal__dot" />}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const WIDGET_ICONS = {
  Clock, ListChecks, Radio, Star, CalendarDays, CheckSquare, Activity, CloudSun, Newspaper, TrendingUp,
};
