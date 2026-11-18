import { createAuthClient } from "better-auth/react";
import { authHubUrlForHost, clientAppBaseUrl } from "@/lib/auth-public";

export const authClient = createAuthClient({
  baseURL: clientAppBaseUrl(),
});

export function goToLogin(callbackURL = typeof window !== "undefined" ? window.location.href : "/") {
  const hub = authHubUrlForHost(typeof window !== "undefined" ? window.location.hostname : null);
  const url = new URL(hub);
  url.searchParams.set("callbackURL", callbackURL);
  window.location.href = url.toString();
}
