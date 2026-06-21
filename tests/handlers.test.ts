// Handler-level integration tests with Platega mocked at the fetch boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import createHandler from '../api/donate/create.js';
import statusHandler from '../api/donate/status.js';
import callbackHandler from '../api/donate/callback.js';
import { resetRateLimit } from '../api/_lib/rate-limit.js';
import { jsonResponse, mockReq, mockRes, TEST_ENV } from './helpers.js';

const ALLOWED_ORIGIN = 'https://kirigiris.press';
const EVIL_ORIGIN = 'https://evil.example';
const UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const fetchMock = vi.fn();

beforeEach(() => {
  for (const [k, v] of Object.entries(TEST_ENV)) vi.stubEnv(k, v);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  resetRateLimit();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/donate/create', () => {
  const validBody = { amount: 100, paymentMethod: 2 };

  it('creates a transaction and returns redirect + server-generated uuid', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { transactionId: 'x', redirect: 'https://pay.platega.test/abc', status: 'PENDING' }),
    );
    const { res, statusCode, jsonBody } = mockRes();
    await createHandler(mockReq({ method: 'POST', body: validBody }), res);

    expect(statusCode()).toBe(200);
    const out = jsonBody() as { redirect: string; transactionId: string };
    expect(out.redirect).toBe('https://pay.platega.test/abc');
    expect(out.transactionId).toMatch(/^[0-9a-f-]{36}$/);

    // Upstream call carries auth headers and the server-built body.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://platega.test/transaction/process');
    expect(init.headers['X-MerchantId']).toBe('test-merchant');
    expect(init.headers['X-Secret']).toBe('test-secret');
    const sent = JSON.parse(init.body);
    expect(sent.id).toBe(out.transactionId);
    expect(sent.paymentDetails).toEqual({ amount: 100, currency: 'RUB' });
    expect(sent.return).toBe(`https://kirigiris.press/guidebook/?donate=result&id=${out.transactionId}`);
  });

  it.each([
    [{ amount: 0, paymentMethod: 2 }],
    [{ amount: -5, paymentMethod: 2 }],
    [{ amount: 1.5, paymentMethod: 2 }],
    [{ amount: '100', paymentMethod: 2 }],
    [{ amount: 100, paymentMethod: 4 }],
    [{ amount: 100, paymentMethod: '2' }],
    [{ amount: 100 }],
    [{}],
    [null],
  ])('rejects invalid input %j with 400 and never calls Platega', async (body) => {
    const { res, statusCode } = mockRes();
    await createHandler(mockReq({ method: 'POST', body }), res);
    expect(statusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied id (server generates its own)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { redirect: 'https://pay.platega.test/abc' }));
    const { res } = mockRes();
    await createHandler(
      mockReq({ method: 'POST', body: { ...validBody, id: 'client-chosen-id' } }),
      res,
    );
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(sent.id).not.toBe('client-chosen-id');
  });

  it('maps upstream failure to 502', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
    const { res, statusCode } = mockRes();
    await createHandler(mockReq({ method: 'POST', body: validBody }), res);
    expect(statusCode()).toBe(502);
  });

  it('rate-limits repeated calls from one IP with 429', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { redirect: 'https://pay.platega.test/abc' }));
    const headers = { 'x-forwarded-for': '203.0.113.7' };
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const { res, statusCode } = mockRes();
      await createHandler(mockReq({ method: 'POST', body: validBody, headers }), res);
      last = statusCode()!;
    }
    expect(last).toBe(429);
  });

  it('test mode skips Platega and redirects straight to the return URL', async () => {
    vi.stubEnv('PLATEGA_TEST_MODE', 'true');
    const { res, statusCode, jsonBody } = mockRes();
    await createHandler(mockReq({ method: 'POST', body: validBody }), res);
    expect(statusCode()).toBe(200);
    const out = jsonBody() as { redirect: string; transactionId: string };
    expect(out.redirect).toBe(
      `https://kirigiris.press/guidebook/?donate=result&id=${out.transactionId}`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-POST with 405', async () => {
    const { res, statusCode } = mockRes();
    await createHandler(mockReq({ method: 'GET' }), res);
    expect(statusCode()).toBe(405);
  });
});

describe('GET /api/donate/status', () => {
  it('re-queries Platega and returns only status/amount/currency', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        id: UUID,
        status: 'CONFIRMED',
        paymentDetails: { amount: 100, currency: 'RUB' },
        merchantSecretLeak: 'should-never-surface',
      }),
    );
    const { res, statusCode, jsonBody } = mockRes();
    await statusHandler(mockReq({ method: 'GET', query: { id: UUID } }), res);
    expect(statusCode()).toBe(200);
    expect(jsonBody()).toEqual({ status: 'CONFIRMED', amount: 100, currency: 'RUB' });
  });

  it('returns 404 for an id Platega does not know', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'not found' }));
    const { res, statusCode } = mockRes();
    await statusHandler(mockReq({ method: 'GET', query: { id: UUID } }), res);
    expect(statusCode()).toBe(404);
  });

  it('rejects a malformed id with 400 without calling Platega', async () => {
    const { res, statusCode } = mockRes();
    await statusHandler(mockReq({ method: 'GET', query: { id: 'nope' } }), res);
    expect(statusCode()).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/donate/callback', () => {
  it('re-queries Platega instead of trusting the body, and returns 200', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: 'PENDING', paymentDetails: { amount: 100, currency: 'RUB' } }),
    );
    const { res, statusCode } = mockRes();
    // Forged callback claims CONFIRMED; the verified status is PENDING.
    await callbackHandler(
      mockReq({ method: 'POST', body: { id: UUID, status: 'CONFIRMED', amount: 100 } }),
      res,
    );
    expect(statusCode()).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://platega.test/transaction/${UUID}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns 200 even for garbage bodies (no retry-storm)', async () => {
    for (const body of [null, {}, { id: 'not-a-uuid', status: 'CONFIRMED' }]) {
      const { res, statusCode } = mockRes();
      await callbackHandler(mockReq({ method: 'POST', body }), res);
      expect(statusCode()).toBe(200);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 200 even when the re-query itself fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { res, statusCode } = mockRes();
    await callbackHandler(mockReq({ method: 'POST', body: { id: UUID, status: 'CONFIRMED' } }), res);
    expect(statusCode()).toBe(200);
  });
});

describe('CORS', () => {
  it('allows preflight from an allowlisted origin', async () => {
    const { res, statusCode, header } = mockRes();
    await createHandler(
      mockReq({ method: 'OPTIONS', headers: { origin: ALLOWED_ORIGIN } }),
      res,
    );
    expect(statusCode()).toBe(204);
    expect(header('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
    expect(header('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('blocks preflight from a disallowed origin', async () => {
    const { res, statusCode, header } = mockRes();
    await createHandler(mockReq({ method: 'OPTIONS', headers: { origin: EVIL_ORIGIN } }), res);
    expect(statusCode()).toBe(403);
    expect(header('Access-Control-Allow-Origin')).toBeUndefined();
  });

  it('does not reflect a disallowed origin on actual requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { redirect: 'https://pay.platega.test/x' }));
    const { res, header } = mockRes();
    await createHandler(
      mockReq({
        method: 'POST',
        body: { amount: 100, paymentMethod: 2 },
        headers: { origin: EVIL_ORIGIN },
      }),
      res,
    );
    expect(header('Access-Control-Allow-Origin')).toBeUndefined();
  });
});
