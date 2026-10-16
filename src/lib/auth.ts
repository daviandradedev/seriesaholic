import { betterAuth } from "better-auth";
import { bearer, oneTimeToken } from "better-auth/plugins";
import { Pool } from "pg";
import { appBaseUrlForHost, authHubUrlForHost } from "@/lib/auth-public";

function parseOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const cookieDomain = process.env.BETTER_AUTH_COOKIE_DOMAIN?.trim();
const appUrl = appBaseUrlForHost();
const authHubUrl = authHubUrlForHost();

const globalForAuth = globalThis as typeof globalThis & {
  __seriesaholicAuthPool?: Pool;
};

const authPool =
  globalForAuth.__seriesaholicAuthPool ??
  new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuth.__seriesaholicAuthPool = authPool;
}

export const auth = betterAuth({
  database: authPool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appUrl,
  trustedOrigins: [authHubUrl, appUrl, ...parseOrigins(process.env.BETTER_AUTH_TRUSTED_ORIGINS)],
  advanced: cookieDomain
    ? {
        crossSubDomainCookies: {
          enabled: true,
          domain: cookieDomain,
        },
      }
    : undefined,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [bearer(), oneTimeToken()],
});

export { authHubUrlForHost };
