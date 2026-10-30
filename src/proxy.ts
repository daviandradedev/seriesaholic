import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const ott = request.nextUrl.searchParams.get("ott");
  if (!ott) return NextResponse.next();

  const bootstrap = new URL("/api/auth/bootstrap", request.url);
  bootstrap.searchParams.set("ott", ott);
  bootstrap.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(bootstrap);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
