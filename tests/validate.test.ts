import { describe, expect, it } from 'vitest';
import {
  isValidAmount,
  isValidPaymentMethod,
  isUuidV4,
  PAYMENT_METHODS,
} from '../api/_lib/validate.js';

describe('isValidAmount', () => {
  it('accepts whole rubles ≥ 1', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(999_999)).toBe(true);
  });

  it('rejects zero, negatives, decimals, NaN, Infinity, unsafe ints', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(1.5)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
    expect(isValidAmount(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('rejects non-numbers (strings, null, objects, booleans)', () => {
    expect(isValidAmount('5')).toBe(false);
    expect(isValidAmount(null)).toBe(false);
    expect(isValidAmount(undefined)).toBe(false);
    expect(isValidAmount({})).toBe(false);
    expect(isValidAmount(true)).toBe(false);
  });
});

describe('isValidPaymentMethod', () => {
  it('accepts exactly {2,3,11,12,13}', () => {
    for (const m of PAYMENT_METHODS) expect(isValidPaymentMethod(m)).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isValidPaymentMethod(1)).toBe(false);
    expect(isValidPaymentMethod(4)).toBe(false);
    expect(isValidPaymentMethod(0)).toBe(false);
    expect(isValidPaymentMethod('2')).toBe(false);
    expect(isValidPaymentMethod(null)).toBe(false);
    expect(isValidPaymentMethod(2.5)).toBe(false);
  });
});

describe('isUuidV4', () => {
  it('accepts v4 uuids', () => {
    expect(isUuidV4('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBe(true);
    expect(isUuidV4(crypto.randomUUID())).toBe(true);
  });

  it('rejects non-v4, malformed, and non-strings', () => {
    expect(isUuidV4('a1b2c3d4-e5f6-1a7b-8c9d-0e1f2a3b4c5d')).toBe(false); // v1
    expect(isUuidV4('not-a-uuid')).toBe(false);
    expect(isUuidV4('')).toBe(false);
    expect(isUuidV4(42)).toBe(false);
    expect(isUuidV4(null)).toBe(false);
  });
});
