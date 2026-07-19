import { useCallback } from 'react';
import { messagingProvider } from './provider';

/**
 * Acceso desacoplado al motor de mensajería activo. La UI consume esto,
 * nunca un proveedor concreto — así intercambiar el motor no toca la vista.
 */
export const useMessaging = () => {
  const provider = messagingProvider;

  const launch = useCallback(() => {
    if (provider.mode === 'launch' && provider.url) {
      window.open(provider.url, '_blank', 'noopener,noreferrer');
    }
  }, [provider]);

  return { provider, launch };
};
