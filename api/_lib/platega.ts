// Platega HTTP client. All upstream calls go through here so auth headers,
// request shapes, and status mapping live in one place.
//
// Verified API surface (do not extend without re-verifying against Platega):
//   POST {base}/transaction/process  — create transaction
//   GET  {base}/transaction/{id}     — status re-query (the source of truth)

import type { DonateEnv } from './env.js';

export const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELED', 'CHARGEBACKED'] as const;
export type PlategaStatus = (typeof STATUSES)[number];

export function mapStatus(value: unknown): PlategaStatus | null {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? (value as PlategaStatus)
    : null;
}

export class UpstreamError extends Error {
  constructor(public readonly status: number) {
    super(`Platega responded ${status}`);
  }
}

export interface CreateInput {
  id: string;
  amount: number;
  paymentMethod: number;
}

// return/failedUrl are built ONLY from env — never from client input
// (open-redirect guard).
export function buildCreateRequest(env: DonateEnv, input: CreateInput) {
  return {
    url: `${env.base}/transaction/process`,
    body: {
      paymentMethod: input.paymentMethod,
      id: input.id,
      paymentDetails: { amount: input.amount, currency: 'RUB' },
      description: 'Поддержка проекта Shinri Trial Guidebook',
      return: `${env.returnBase}/?donate=result&id=${input.id}`,
      failedUrl: `${env.returnBase}/?donate=failed&id=${input.id}`,
    },
  };
}

function authHeaders(env: DonateEnv): Record<string, string> {
  return {
    'X-MerchantId': env.merchantId,
    'X-Secret': env.secret,
    'Content-Type': 'application/json',
  };
}

export interface CreateResult {
  redirect: string;
}

export async function createTransaction(
  env: DonateEnv,
  input: CreateInput,
): Promise<CreateResult> {
  const { url, body } = buildCreateRequest(env, input);
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(env),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new UpstreamError(resp.status);
  const data = (await resp.json()) as { redirect?: unknown };
  if (typeof data.redirect !== 'string' || data.redirect.length === 0) {
    throw new UpstreamError(502);
  }
  return { redirect: data.redirect };
}

export interface StatusResult {
  status: PlategaStatus;
  amount: number;
  currency: string;
}

// Returns null when Platega does not know the id (upstream 404).
export async function getTransaction(
  env: DonateEnv,
  id: string,
): Promise<StatusResult | null> {
  const resp = await fetch(`${env.base}/transaction/${id}`, {
    method: 'GET',
    headers: authHeaders(env),
  });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new UpstreamError(resp.status);
  const data = (await resp.json()) as {
    status?: unknown;
    paymentDetails?: { amount?: unknown; currency?: unknown };
  };
  const status = mapStatus(data.status);
  if (!status) throw new UpstreamError(502);
  const amount = data.paymentDetails?.amount;
  const currency = data.paymentDetails?.currency;
  return {
    status,
    amount: typeof amount === 'number' ? amount : 0,
    currency: typeof currency === 'string' ? currency : 'RUB',
  };
}
