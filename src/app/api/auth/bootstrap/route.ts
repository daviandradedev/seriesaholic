import { NextRequest, NextResponse } from "next/server";
import { auth, authHubUrlPublic } from "@/lib/auth";
import { claimGuestLibrary } from "@/lib/claim-guest";
import { GUEST_COOKIE, isGuestId } from "@/lib/guest-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const ott = request.nextUrl.searchParams.get("ott");
  const requestedNext = request.nextUrl.searchParams.get("next") || "/";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  if (!ott) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const verifyResponse = await auth.handler(
    new Request(new URL("/api/auth/one-time-token/verify", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: ott }),
    }),
  );

  if (!verifyResponse.ok) {
    const login = new URL(authHubUrlPublic);
    login.searchParams.set("callbackURL", new URL(nextPath, request.url).toString());
    return NextResponse.redirect(login);
  }

  const setCookies = verifyResponse.headers.getSetCookie();
  const payload = (await verifyResponse.json().catch(() => null)) as { user?: { id?: string } } | null;
  const guestId = request.cookies.get(GUEST_COOKIE)?.value;
  let claimed = false;
  if (payload?.user?.id && isGuestId(guestId)) {
    try {
      await claimGuestLibrary(guestId, payload.user.id);
      claimed = true;
    } catch {
      claimed = false;
    }
  }

  const redirect = NextResponse.redirect(new URL(nextPath, request.url));
  for (const cookie of setCookies) {
    redirect.headers.append("Set-Cookie", cookie);
  }
  if (claimed) {
    redirect.cookies.set(GUEST_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return redirect;
}
