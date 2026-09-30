import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api/auth";
import { GUEST_COOKIE, GUEST_HEADER, isGuestId } from "@/lib/guest-session";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function getOptionalUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

async function readGuestId() {
  const headerList = await headers();
  const fromHeader = headerList.get(GUEST_HEADER);
  if (isGuestId(fromHeader)) return fromHeader;
  const fromCookie = (await cookies()).get(GUEST_COOKIE)?.value;
  return isGuestId(fromCookie) ? fromCookie : null;
}

export async function requireUserId(): Promise<string> {
  const userId = (await getOptionalUserId()) ?? (await readGuestId());
  if (!userId) throw new UnauthorizedError();
  return userId;
}

export function jsonError(err: unknown, fallback: string) {
  if (isUnauthorizedError(err)) {
    return NextResponse.json({ error: "Sign in to save changes" }, { status: 401 });
  }
  return NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 },
  );
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
