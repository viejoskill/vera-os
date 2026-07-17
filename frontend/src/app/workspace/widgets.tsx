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
} from 'lucide-react';
import { useToday } from '@app/hooks/useToday';
import { useAuthUser } from '@app/auth/useAuthUser';
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

export const PrioridadesWidget = () => {
  const { data, isLoading } = useToday();
  const navigate = useNavigate();
  const items = (data?.recommendations ?? []).slice(0, 3);
  if (isLoading) return <p className="vera-muted">VERA está revisando tu día…</p>;
  if (!items.length)
    return <p className="vera-muted" data-testid="widget-body-prioridades">Todo al día. Sin pendientes urgentes ✨</p>;
  return (
    <ul className="vera-w-list" data-testid="widget-body-prioridades">
      {items.map((r) => (
        <li key={r.id}>
          <button type="button" className="vera-w-listitem" onClick={() => navigate(recUrl(r))}>
            <span className={`vera-dot vera-dot--${r.priority === 'alta' ? 'error' : r.priority === 'atencion' ? 'pending' : 'published'}`} />
            <span className="vera-w-listitem__text">
              <span className="vera-w-listitem__title">{r.title}</span>
              <span className="vera-w-listitem__sub">{r.subject}</span>
            </span>
            <ArrowUpRight size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
};

/* --------------------------------- Audio -------------------------------- */
const STATIONS = [
  { id: 'aspen', name: 'Aspen 102.3', stream: 'https://27153.live.streamtheworld.com/ASPEN.mp3' },
  { id: 'rockpop', name: 'Rock & Pop 95.9', stream: 'https://27343.live.streamtheworld.com/ROCK_POP.mp3' },
];

export const AudioWidget = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const pick = (s: typeof STATIONS[number]) => {
    setStation(s);
    setPlaying(false);
    window.setTimeout(() => {
      if (audioRef.current) audioRef.current.load();
    }, 0);
  };

  return (
    <div className="vera-w-audio" data-testid="widget-body-audio">
      <audio ref={audioRef} src={station.stream} preload="none" onEnded={() => setPlaying(false)} />
      <div className="vera-w-audio__now">
        <span className={`vera-w-audio__pulse ${playing ? 'is-on' : ''}`.trim()} />
        <div>
          <p className="vera-w-audio__station">{station.name}</p>
          <p className="vera-w-audio__label">{playing ? 'En vivo' : 'En pausa'}</p>
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
export const WeatherWidget = () => (
  <div className="vera-w-weather" data-testid="widget-body-clima">
    <CloudSun size={40} className="vera-w-weather__icon" />
    <div>
      <p className="vera-w-weather__temp">23°</p>
      <p className="vera-w-weather__desc">Parcialmente nublado · Buenos Aires</p>
    </div>
  </div>
);

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
const QUOTES = [
  { label: 'Dólar Oficial', value: '$ 985', delta: '+0,4%' },
  { label: 'Dólar Blue', value: '$ 1.180', delta: '-0,8%' },
  { label: 'Dólar MEP', value: '$ 1.095', delta: '+0,2%' },
];
export const QuotesWidget = () => (
  <ul className="vera-w-quotes" data-testid="widget-body-cotizaciones">
    {QUOTES.map((q) => (
      <li key={q.label}>
        <span className="vera-w-quotes__label">{q.label}</span>
        <span className="vera-w-quotes__value">{q.value}</span>
        <span className={`vera-w-quotes__delta ${q.delta.startsWith('-') ? 'is-down' : 'is-up'}`}>{q.delta}</span>
      </li>
    ))}
  </ul>
);

export const WIDGET_ICONS = {
  Clock, ListChecks, Radio, Star, CalendarDays, CheckSquare, Activity, CloudSun, Newspaper, TrendingUp,
};
