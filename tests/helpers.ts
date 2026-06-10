// Minimal VercelRequest/VercelResponse doubles for handler-level tests.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface MockResponse {
  res: VercelResponse;
  statusCode: () => number | undefined;
  jsonBody: () => unknown;
  header: (name: string) => string | undefined;
}

export function mockReq(init: {
  method: string;
  body?: unknown;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string | string[]>;
}): VercelRequest {
  return {
    method: init.method,
    body: init.body,
    query: init.query ?? {},
    headers: init.headers ?? {},
  } as unknown as VercelRequest;
}

export function mockRes(): MockResponse {
  let status: number | undefined;
  let body: unknown;
  const headers = new Map<string, string>();

  const res = {
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    status(code: number) {
      status = code;
      return res;
    },
    json(value: unknown) {
      body = value;
      return res;
    },
    end() {
      return res;
    },
  } as unknown as VercelResponse;

  return {
    res,
    statusCode: () => status,
    jsonBody: () => body,
    header: (name) => headers.get(name.toLowerCase()),
  };
}

export const TEST_ENV = {
  PLATEGA_MERCHANT_ID: 'test-merchant',
  PLATEGA_SECRET: 'test-secret',
  PLATEGA_BASE: 'https://platega.test',
  GUIDEBOOK_RETURN_BASE: 'https://kirigiris.press/guidebook',
  ALLOWED_ORIGINS: 'https://kirigiris.press,https://shinri-trial-guidebook.vercel.app',
  PLATEGA_TEST_MODE: '',
} as const;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
