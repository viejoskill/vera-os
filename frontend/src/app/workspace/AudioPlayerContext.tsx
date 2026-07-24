import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Station { id: string; name: string; stream: string; }

export const STATIONS: Station[] = [
  { id: 'aspen', name: 'Aspen 102.3', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/ASPEN.mp3' },
  { id: 'rockpop', name: 'Rock & Pop 95.9', stream: 'https://ipanel.instream.audio:7002/stream' },
  { id: 'la100', name: 'La 100 · 99.9', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/FM999_56AAC.aac' },
  { id: 'metro', name: 'Metro 95.1', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO.mp3' },
  { id: 'vorterix', name: 'Vorterix 92.1', stream: 'https://ice2.edge-apps.net/radio1_high-20057.audio' },
];

interface AudioPlayerState {
  station: Station;
  playing: boolean;
  loading: boolean;
  error: boolean;
  volume: number;
  toggle: () => void;
  pick: (s: Station) => void;
  setVolume: (v: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null);

/** Reproductor global: el <audio> vive acá (montado en el layout), por eso la radio
 * sigue sonando al cambiar de pantalla. El widget de "Hoy" es solo un control. */
export const AudioPlayerProvider = ({ children }: { children: ReactNode }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState<Station>(STATIONS[0]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [volume, setVolumeState] = useState(0.7);

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

  const pick = (s: Station) => {
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

  const setVolume = (v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const value = useMemo<AudioPlayerState>(
    () => ({ station, playing, loading, error, volume, toggle, pick, setVolume }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [station, playing, loading, error, volume],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={station.stream}
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setError(true); setLoading(false); }}
        onPlaying={() => { setLoading(false); setPlaying(true); }}
      />
      {children}
    </AudioPlayerContext.Provider>
  );
};

export const useAudioPlayer = (): AudioPlayerState => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer debe usarse dentro de AudioPlayerProvider');
  return ctx;
};
