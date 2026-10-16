const LOCAL_APP_URL = "http://localhost:3000";
const LOCAL_HUB_URL = "http://localhost:3100";
const PRODUCTION_APP_URL = "https://seriesaholic.daviandrade.dev";
const PRODUCTION_HUB_URL = "https://auth.daviandrade.dev";

function configured(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalUrl(value: string) {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function appBaseUrlForHost(hostname?: string | null) {
  const fromEnv = configured(process.env.NEXT_PUBLIC_APP_URL);
  const hostIsLocal = hostname ? isLocalHostname(hostname) : false;
  if (fromEnv && (hostIsLocal || !isLocalUrl(fromEnv))) return fromEnv;
  if (hostname && !hostIsLocal) return `https://${hostname}`;
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_APP_URL;
  return LOCAL_APP_URL;
}

export function authHubUrlForHost(hostname?: string | null) {
  const fromEnv = configured(process.env.NEXT_PUBLIC_AUTH_URL);
  const hostIsLocal = hostname ? isLocalHostname(hostname) : false;
  if (fromEnv && (hostIsLocal || !isLocalUrl(fromEnv))) return fromEnv;
  if (hostname && !hostIsLocal) return PRODUCTION_HUB_URL;
  if (!hostname && process.env.VERCEL_ENV === "production") return PRODUCTION_HUB_URL;
  return LOCAL_HUB_URL;
}

export function clientAppBaseUrl() {
  const hostname = typeof window !== "undefined" ? window.location.hostname : null;
  return appBaseUrlForHost(hostname);
}
