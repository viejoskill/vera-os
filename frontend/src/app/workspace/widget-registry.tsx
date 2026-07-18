import type { FC } from 'react';
import {
  Clock,
  ListChecks,
  Radio,
  Star,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  Activity,
  CloudSun,
  Newspaper,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  GreetingWidget,
  PrioridadesWidget,
  AudioWidget,
  FavoritesWidget,
  AgendaWidget,
  CalendarWidget,
  TasksWidget,
  ActivityWidget,
  WeatherWidget,
  NewsWidget,
  QuotesWidget,
} from './widgets';

export type WidgetSize = 'sm' | 'md' | 'lg';

export interface WidgetDef {
  id: string;
  title: string;
  icon: LucideIcon;
  size: WidgetSize;
  Component: FC;
  defaultEnabled: boolean;
  demo?: boolean;
}

/** Registro de Widgets — fuente única. Cada widget se "registra" acá con su tamaño
 * por defecto (preparado para resize futuro). Sin hardcodear en la pantalla. */
export const WIDGETS: WidgetDef[] = [
  { id: 'greeting', title: 'Saludo', icon: Clock, size: 'md', Component: GreetingWidget, defaultEnabled: true },
  { id: 'prioridades', title: 'Prioridades de hoy', icon: ListChecks, size: 'md', Component: PrioridadesWidget, defaultEnabled: true },
  { id: 'audio', title: 'Audio', icon: Radio, size: 'sm', Component: AudioWidget, defaultEnabled: true },
  { id: 'calendario', title: 'Calendario', icon: CalendarRange, size: 'sm', Component: CalendarWidget, defaultEnabled: true, demo: true },
  { id: 'favoritos', title: 'Favoritos', icon: Star, size: 'sm', Component: FavoritesWidget, defaultEnabled: true, demo: true },
  { id: 'agenda', title: 'Agenda', icon: CalendarDays, size: 'sm', Component: AgendaWidget, defaultEnabled: true, demo: true },
  { id: 'tareas', title: 'Tareas', icon: CheckSquare, size: 'sm', Component: TasksWidget, defaultEnabled: true, demo: true },
  { id: 'actividad', title: 'Actividad reciente', icon: Activity, size: 'sm', Component: ActivityWidget, defaultEnabled: false, demo: true },
  { id: 'clima', title: 'Clima', icon: CloudSun, size: 'sm', Component: WeatherWidget, defaultEnabled: false },
  { id: 'noticias', title: 'Noticias', icon: Newspaper, size: 'sm', Component: NewsWidget, defaultEnabled: false, demo: true },
  { id: 'cotizaciones', title: 'Cotizaciones', icon: TrendingUp, size: 'sm', Component: QuotesWidget, defaultEnabled: false },
];

export const widgetById = (id: string): WidgetDef | undefined => WIDGETS.find((w) => w.id === id);
