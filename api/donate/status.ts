// GET /api/donate/status?id=<uuid v4>
// Response: { "status": "PENDING|CONFIRMED|CANCELED|CHARGEBACKED",
//             "amount": <int>, "currency": "RUB" }
//
// Always re-queries Platega — this endpoint is the donor-facing source of
// truth. Response is deliberately minimal: no merchant id, no commission,
// nothing beyond the three fields above.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readEnv } from '../_lib/env.js';
import { applyCors } from '../_lib/cors.js';
import { isUuidV4 } from '../_lib/validate.js';
import { getTransaction, UpstreamError } from '../_lib/platega.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let env;
  try {
    env = readEnv();
  } catch {
    return res.status(503).json({ error: 'service_unavailable' });
  }

  if (applyCors(req, res, env)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!isUuidV4(id)) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  // Test mode: canned success so the receipt page can be exercised end to
  // end without money. Amount is a placeholder 1 ₽.
  if (env.testMode) {
    return res.status(200).json({ status: 'CONFIRMED', amount: 1, currency: 'RUB' });
  }

  try {
    const tx = await getTransaction(env, id);
    if (!tx) return res.status(404).json({ error: 'not_found' });
    return res
      .status(200)
      .json({ status: tx.status, amount: tx.amount, currency: tx.currency });
  } catch (err) {
    console.error(
      `[donate:status] upstream failure id=${id}`,
      err instanceof UpstreamError ? `status=${err.status}` : err,
    );
    return res.status(502).json({ error: 'upstream_failure' });
  }
}
