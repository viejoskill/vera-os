import { useState } from 'react';
import { aiContentService } from '@vera/services';
import type { AiPropertyContext } from '@vera/repositories';

type Status = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Title suggestions from VERA. Keeps its own UI state (no global store).
 * VERA PROPONE, el profesional decide — the hook only exposes suggestions;
 * applying one is the caller's decision.
 */
export const useTitleSuggestions = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const generate = async (context: AiPropertyContext) => {
    setStatus('loading');
    try {
      const result = await aiContentService.suggestTitles(context);
      setSuggestions(result);
      setStatus(result.length ? 'ready' : 'error');
    } catch {
      setSuggestions([]);
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('idle');
    setSuggestions([]);
  };

  return { status, suggestions, generate, reset };
};
