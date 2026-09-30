export function hubAccountHandoffUrl(hub: string, token: string) {
  const target = new URL("/api/auth/bootstrap", hub.replace(/\/$/, ""));
  target.searchParams.set("ott", token);
  target.searchParams.set("next", "/account");
  return target;
}
