/**
 * Input validation utilities for API security hardening (Phase 9B.3)
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether a string is a well-formed UUID v4 / UUID.
 */
export function isValidUUID(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Sanitizes and bounds input string to max allowed characters.
 * Returns null if input is not a non-empty string.
 */
export function sanitizeString(
  input: unknown,
  maxLength: number,
  minLength: number = 1
): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Safely parse bounded integer with fallback and bounds
 */
export function parseBoundedInt(
  input: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (typeof input !== 'number' && typeof input !== 'string') return defaultValue;
  const val = typeof input === 'number' ? input : parseInt(String(input), 10);
  if (!Number.isFinite(val)) return defaultValue;
  return Math.min(Math.max(min, Math.floor(val)), max);
}
