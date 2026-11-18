import { NextRequest, NextResponse } from "next/server";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { getTranslator } from "@/lib/i18n";
import { jsonError, requireUserId } from "@/lib/session-user";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 48);
    const [userId, { language }] = await Promise.all([requireUserId(), getTranslator()]);
    const result = await getPersonalizedRecommendations(limit, userId, language);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Failed to generate recommendations");
  }
}
