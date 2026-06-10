// POST /api/donate/callback — Platega → us.
//
// ⚠️ Platega's callback is UNSIGNED (no HMAC/signature in their schema), so
// the body is untrusted by design. This endpoint never acts on the claimed
// status: it re-queries GET /transaction/{id} and logs the verified
// lifecycle. There is no ledger in v1 — the guidebook's receipt page polls
// /api/donate/status itself.
//
// Always responds 200, even for unknown/stale/garbage ids, so Platega does
// not retry-storm us.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readEnv } from '../_lib/env.js';
import { isUuidV4 } from '../_lib/validate.js';
import { getTransaction } from '../_lib/platega.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Whatever happens below, Platega gets a 200.
  const ok = () => res.status(200).json({ ok: true });

  if (req.method !== 'POST') return ok();

  let env;
  try {
    env = readEnv();
  } catch {
    console.error('[donate:callback] dropped: env not configured');
    return ok();
  }

  const body = (req.body ?? {}) as { id?: unknown; status?: unknown };
  const claimedStatus = typeof body.status === 'string' ? body.status : 'unknown';

  if (!isUuidV4(body.id)) {
    console.warn('[donate:callback] dropped: missing/malformed id');
    return ok();
  }
  const id = body.id;

  if (env.testMode) {
    console.log(`[donate:callback] test-mode id=${id} claimed=${claimedStatus}`);
    return ok();
  }

  try {
    const tx = await getTransaction(env, id);
    if (!tx) {
      console.warn(`[donate:callback] id=${id} claimed=${claimedStatus} verified=UNKNOWN_ID`);
    } else {
      console.log(
        `[donate:callback] id=${id} claimed=${claimedStatus} verified=${tx.status} amount=${tx.amount} ${tx.currency}`,
      );
    }
  } catch (err) {
    console.error(`[donate:callback] id=${id} re-query failed`, err);
  }
  return ok();
}
