import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
});

export function goToLogin(callbackURL = typeof window !== "undefined" ? window.location.href : "/") {
  const hub = process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3100";
  const url = new URL(hub);
  url.searchParams.set("callbackURL", callbackURL);
  window.location.href = url.toString();
}
