import { NextRequest, NextResponse } from "next/server";
import { createGuestId, GUEST_COOKIE, GUEST_HEADER, isGuestId } from "@/lib/guest-session";

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("session_token") && cookie.value.length > 0);
}

function continueWithGuest(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  if (hasSessionCookie(request)) {
    requestHeaders.delete(GUEST_HEADER);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const existing = request.cookies.get(GUEST_COOKIE)?.value;
  const guestId = isGuestId(existing) ? existing : createGuestId();
  requestHeaders.set(GUEST_HEADER, guestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!isGuestId(existing)) {
    response.cookies.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (searchParams.has("ott")) {
    const bootstrap = new URL("/api/auth/bootstrap", request.url);
    bootstrap.searchParams.set("ott", searchParams.get("ott")!);
    bootstrap.searchParams.set("next", pathname);
    return NextResponse.redirect(bootstrap);
  }

  return continueWithGuest(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
