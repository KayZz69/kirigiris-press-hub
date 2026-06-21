// Best-effort per-IP rate limit for /create. In-memory sliding window —
// state survives only as long as the function instance, but Fluid Compute
// reuses instances across requests, so this meaningfully blunts bursts
// without needing an external store. v1 accepts that a cold start resets
// the window.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const MAX_TRACKED_IPS = 10_000;

const hits = new Map<string, number[]>();

export function rateLimitOk(ip: string, now: number = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED_IPS) hits.clear(); // crude memory guard
  return true;
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const fwd = headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  return (first ?? '').split(',')[0]!.trim() || 'unknown';
}

// Test hook.
export function resetRateLimit(): void {
  hits.clear();
}
