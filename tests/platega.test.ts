import { describe, expect, it } from 'vitest';
import { readEnv } from '../api/_lib/env.js';
import { buildCreateRequest, mapStatus } from '../api/_lib/platega.js';
import { TEST_ENV } from './helpers.js';

const env = readEnv({ ...TEST_ENV });

describe('mapStatus', () => {
  it('maps the four known statuses', () => {
    expect(mapStatus('PENDING')).toBe('PENDING');
    expect(mapStatus('CONFIRMED')).toBe('CONFIRMED');
    expect(mapStatus('CANCELED')).toBe('CANCELED');
    expect(mapStatus('CHARGEBACKED')).toBe('CHARGEBACKED');
  });

  it('returns null for anything else', () => {
    expect(mapStatus('confirmed')).toBeNull();
    expect(mapStatus('PAID')).toBeNull();
    expect(mapStatus(1)).toBeNull();
    expect(mapStatus(undefined)).toBeNull();
  });
});

describe('buildCreateRequest', () => {
  const id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const { url, body } = buildCreateRequest(env, { id, amount: 500, paymentMethod: 2 });

  it('targets POST /transaction/process on the configured base', () => {
    expect(url).toBe('https://platega.test/transaction/process');
  });

  it('builds the exact Platega body shape', () => {
    expect(body).toEqual({
      paymentMethod: 2,
      id,
      paymentDetails: { amount: 500, currency: 'RUB' },
      description: 'Поддержка проекта Shinri Trial Guidebook',
      return: `https://kirigiris.press/guidebook/?donate=result&id=${id}`,
      failedUrl: `https://kirigiris.press/guidebook/?donate=failed&id=${id}`,
    });
  });

  it('builds return URLs from env only — client cannot influence them', () => {
    expect(body.return.startsWith('https://kirigiris.press/guidebook/')).toBe(true);
    expect(body.failedUrl.startsWith('https://kirigiris.press/guidebook/')).toBe(true);
  });
});

describe('readEnv', () => {
  it('throws when credentials are missing outside test mode', () => {
    expect(() => readEnv({ ...TEST_ENV, PLATEGA_MERCHANT_ID: '' })).toThrow();
    expect(() => readEnv({ ...TEST_ENV, PLATEGA_SECRET: '' })).toThrow();
  });

  it('allows missing credentials in test mode', () => {
    const e = readEnv({
      ...TEST_ENV,
      PLATEGA_MERCHANT_ID: '',
      PLATEGA_SECRET: '',
      PLATEGA_TEST_MODE: 'true',
    });
    expect(e.testMode).toBe(true);
  });

  it('throws when GUIDEBOOK_RETURN_BASE is missing', () => {
    expect(() => readEnv({ ...TEST_ENV, GUIDEBOOK_RETURN_BASE: '' })).toThrow();
  });

  it('strips trailing slashes and defaults the Platega base', () => {
    const e = readEnv({
      ...TEST_ENV,
      PLATEGA_BASE: '',
      GUIDEBOOK_RETURN_BASE: 'https://kirigiris.press/guidebook/',
    });
    expect(e.base).toBe('https://app.platega.io');
    expect(e.returnBase).toBe('https://kirigiris.press/guidebook');
  });
});
