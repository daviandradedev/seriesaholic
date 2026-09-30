export const GUEST_COOKIE = "sah_guest";
export const GUEST_HEADER = "x-guest-id";

const GUEST_ID = /^guest_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createGuestId() {
  return `guest_${crypto.randomUUID()}`;
}

export function isGuestId(value: string | null | undefined): value is string {
  return typeof value === "string" && GUEST_ID.test(value);
}
