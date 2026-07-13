/**
 * Two-layer rate limiter — Campus WiFi safe
 *
 * Layer 1 (primary spam guard): Keyed on device_id from X-Device-ID header
 *   → 5 reports per 10 minutes per device
 *   → Prevents individual student spamming, NOT affected by shared campus IP
 *
 * Layer 2 (DoS guard only): Keyed on IP address
 *   → 100 requests per minute per IP
 *   → High threshold, only blocks scripted attacks
 *
 * Uses in-memory maps (resets on server restart, suitable for free tier).
 * For production at scale, swap the in-memory stores with Redis/Upstash.
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

// In-memory stores
const deviceWindows = new Map<string, WindowEntry>();
const ipWindows = new Map<string, WindowEntry>();

// Cleanup old entries every 15 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of deviceWindows.entries()) {
    if (now - entry.windowStart > DEVICE_WINDOW_MS * 2) deviceWindows.delete(key);
  }
  for (const [key, entry] of ipWindows.entries()) {
    if (now - entry.windowStart > IP_WINDOW_MS * 2) ipWindows.delete(key);
  }
}, 15 * 60 * 1000);

const DEVICE_LIMIT = 5;
const DEVICE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const IP_LIMIT = 100;
const IP_WINDOW_MS = 60 * 1000; // 1 minute

function checkLimit(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // Start new window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: windowMs - (now - entry.windowStart),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetMs: windowMs - (now - entry.windowStart),
  };
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "device_limit" | "ip_limit";
  remaining?: number;
  resetMs?: number;
}

export function checkRateLimit(deviceId: string, ip: string): RateLimitResult {
  // Layer 1: Device ID check (primary, campus-WiFi safe)
  const deviceResult = checkLimit(deviceWindows, deviceId, DEVICE_LIMIT, DEVICE_WINDOW_MS);
  if (!deviceResult.allowed) {
    console.warn(`[RateLimit] Device blocked: ${deviceId.slice(0, 8)}...`);
    return {
      allowed: false,
      reason: "device_limit",
      remaining: 0,
      resetMs: deviceResult.resetMs,
    };
  }

  // Layer 2: IP check (coarse DoS guard)
  const ipResult = checkLimit(ipWindows, ip, IP_LIMIT, IP_WINDOW_MS);
  if (!ipResult.allowed) {
    console.warn(`[RateLimit] IP blocked: ${ip}`);
    return {
      allowed: false,
      reason: "ip_limit",
      remaining: 0,
      resetMs: ipResult.resetMs,
    };
  }

  return {
    allowed: true,
    remaining: Math.min(deviceResult.remaining, ipResult.remaining),
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
