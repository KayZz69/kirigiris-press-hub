// Environment access for the donation endpoints. Secrets live only here —
// never echo them into responses or logs.

export interface DonateEnv {
  merchantId: string;
  secret: string;
  base: string;
  returnBase: string;
  allowedOrigins: string[];
  testMode: boolean;
}

export class ConfigError extends Error {}

export function readEnv(env: NodeJS.ProcessEnv = process.env): DonateEnv {
  const testMode = (env.PLATEGA_TEST_MODE ?? '').trim().toLowerCase() === 'true';
  const merchantId = (env.PLATEGA_MERCHANT_ID ?? '').trim();
  const secret = (env.PLATEGA_SECRET ?? '').trim();
  const returnBase = (env.GUIDEBOOK_RETURN_BASE ?? '').trim().replace(/\/+$/, '');

  if (!testMode && (!merchantId || !secret)) {
    throw new ConfigError('Platega credentials are not configured');
  }
  if (!returnBase) {
    throw new ConfigError('GUIDEBOOK_RETURN_BASE is not configured');
  }

  return {
    merchantId,
    secret,
    base: (env.PLATEGA_BASE ?? '').trim().replace(/\/+$/, '') || 'https://app.platega.io',
    returnBase,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/+$/, ''))
      .filter(Boolean),
    testMode,
  };
}
