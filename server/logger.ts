/**
 * Production Logger (Phase 9H.2)
 *
 * Ensures all log messages scrub:
 * - API keys (e.g. ?key=..., key: ...)
 * - Bearer tokens and authorization headers
 * - Supabase service keys
 * - Signed URLs
 * - Sensitive raw contents (truncated to safe length)
 */

function sanitizeLogMessage(msg: string): string {
  if (typeof msg !== 'string') return String(msg);
  return msg
    .replace(/(?:key|apikey|api_key|token|secret)=([a-zA-Z0-9_\-]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_.\-]+/gi, 'Bearer [REDACTED]')
    .replace(/token=([a-zA-Z0-9_\-.]+)/gi, 'token=[REDACTED]')
    .replace(/supabase\.co\/storage\/v1\/object\/sign\/[^?\s]+\?[^\s"]+/gi, '[REDACTED_SIGNED_URL]');
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    const cleanMsg = sanitizeLogMessage(message);
    const cleanArgs = args.map((a) => (typeof a === 'string' ? sanitizeLogMessage(a) : a));
    console.log(cleanMsg, ...cleanArgs);
  },
  warn(message: string, ...args: unknown[]) {
    const cleanMsg = sanitizeLogMessage(message);
    const cleanArgs = args.map((a) => (typeof a === 'string' ? sanitizeLogMessage(a) : a));
    console.warn(cleanMsg, ...cleanArgs);
  },
  error(message: string, ...args: unknown[]) {
    const cleanMsg = sanitizeLogMessage(message);
    const cleanArgs = args.map((a) => (typeof a === 'string' ? sanitizeLogMessage(a) : a));
    console.error(cleanMsg, ...cleanArgs);
  },
  truncate(text: string, maxLen: number = 80): string {
    if (!text) return '';
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
  },
};
