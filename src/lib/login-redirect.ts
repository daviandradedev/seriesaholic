import { authHubUrlPublic } from "@/lib/auth-public";

export function redirectToAuthLogin() {
  if (typeof window === "undefined") return;
  const login = new URL(authHubUrlPublic);
  login.searchParams.set("callbackURL", window.location.href);
  window.location.assign(login.toString());
}

export function saveWasRejected(response: Response) {
  if (response.status !== 401) return false;
  redirectToAuthLogin();
  return true;
}
