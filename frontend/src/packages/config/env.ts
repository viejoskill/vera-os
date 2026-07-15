/** Typed access to environment variables. The only place that reads `process.env`. */

function read(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

export const env = {
  backendUrl: read('REACT_APP_BACKEND_URL') ?? '',
  nodeEnv: read('NODE_ENV') ?? 'development',
  isProduction: read('NODE_ENV') === 'production',
} as const;
