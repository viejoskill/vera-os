import { useState } from 'react';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Generic VERA content generation state (proposals). Keeps its own UI state.
 * VERA PROPONE, el profesional decide — the hook only exposes the result;
 * applying it is the caller's decision.
 */
export const useAiContent = <T>() => {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<T | null>(null);

  const run = async (producer: () => Promise<T>) => {
    setStatus('loading');
    try {
      const result = await producer();
      setData(result);
      setStatus('ready');
    } catch {
      setData(null);
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setData(null);
  };

  return { status, data, run, reset };
};
