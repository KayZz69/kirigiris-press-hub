// CORS restricted to the ALLOWED_ORIGINS allowlist. Note that requests from
// kirigiris.press/guidebook are same-origin with this hub (the hub serves the
// domain), so CORS mainly matters for the direct *.vercel.app preview origin.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DonateEnv } from './env.js';

// Returns true when the request was fully handled (preflight) and the
// handler should stop.
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  env: DonateEnv,
): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const allowed = origin !== '' && env.allowedOrigins.includes(origin.replace(/\/+$/, ''));

  res.setHeader('Vary', 'Origin');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    // Preflight from a disallowed origin gets an explicit 403 (and no
    // Access-Control-* headers, so the browser blocks it either way).
    res.status(allowed ? 204 : 403).end();
    return true;
  }
  return false;
}
