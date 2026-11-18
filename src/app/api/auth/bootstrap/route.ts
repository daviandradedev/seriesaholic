import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authHubUrlForHost } from "@/lib/auth-public";

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
    const login = new URL(authHubUrlForHost(request.nextUrl.hostname));
    login.searchParams.set("callbackURL", new URL(nextPath, request.url).toString());
    return NextResponse.redirect(login);
  }

  const redirect = NextResponse.redirect(new URL(nextPath, request.url));
  for (const cookie of verifyResponse.headers.getSetCookie()) {
    redirect.headers.append("Set-Cookie", cookie);
  }
  return redirect;
}
