import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/api/auth";
import { claimGuestLibrary } from "@/lib/claim-guest";
import { GUEST_COOKIE, isGuestId } from "@/lib/guest-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const guestId = request.cookies.get(GUEST_COOKIE)?.value;
  if (!user?.id || !isGuestId(guestId)) {
    return new NextResponse(null, { status: 204 });
  }

  await claimGuestLibrary(guestId, user.id);
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(GUEST_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
