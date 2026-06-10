// POST /api/donate/create
// Request:  { "amount": <int rubles ≥ 1>, "paymentMethod": 2|3|11|12|13 }
// Response: { "redirect": "<platega url>", "transactionId": "<uuid v4>" }
//
// The transaction id is generated server-side; clients never supply ids.
// return/failedUrl come from GUIDEBOOK_RETURN_BASE, never from the request.

import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readEnv } from '../_lib/env.js';
import { applyCors } from '../_lib/cors.js';
import { isValidAmount, isValidPaymentMethod } from '../_lib/validate.js';
import { clientIp, rateLimitOk } from '../_lib/rate-limit.js';
import { createTransaction, UpstreamError } from '../_lib/platega.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let env;
  try {
    env = readEnv();
  } catch {
    return res.status(503).json({ error: 'service_unavailable' });
  }

  if (applyCors(req, res, env)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!rateLimitOk(clientIp(req.headers))) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const body: unknown = req.body;
  const amount = (body as { amount?: unknown } | null)?.amount;
  const paymentMethod = (body as { paymentMethod?: unknown } | null)?.paymentMethod;
  if (!isValidAmount(amount) || !isValidPaymentMethod(paymentMethod)) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const id = randomUUID();

  // Test mode: skip Platega entirely and send the donor straight to the
  // return URL so the full UI flow can be exercised with zero money.
  if (env.testMode) {
    return res.status(200).json({
      redirect: `${env.returnBase}/?donate=result&id=${id}`,
      transactionId: id,
    });
  }

  try {
    const { redirect } = await createTransaction(env, { id, amount, paymentMethod });
    return res.status(200).json({ redirect, transactionId: id });
  } catch (err) {
    console.error(
      `[donate:create] upstream failure id=${id}`,
      err instanceof UpstreamError ? `status=${err.status}` : err,
    );
    return res.status(502).json({ error: 'upstream_failure' });
  }
}
