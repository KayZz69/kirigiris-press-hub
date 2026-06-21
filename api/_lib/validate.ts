// Server-side input validation. Client values are proposals, not facts.

// Platega payment methods: 2=СБП(QR), 3=ЕРИП, 11=карты РФ, 12=международная
// карта, 13=крипта.
export const PAYMENT_METHODS: ReadonlySet<number> = new Set([2, 3, 11, 12, 13]);

// Whole rubles only: integer, ≥ 1, no decimals/NaN/Infinity. JSON numbers
// like `5.0` or `5e0` parse to the integer 5 and are indistinguishable from
// `5`, which is fine — what matters is the resulting value is a safe integer.
export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function isValidPaymentMethod(value: unknown): value is number {
  return typeof value === 'number' && PAYMENT_METHODS.has(value);
}

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_RE.test(value);
}
