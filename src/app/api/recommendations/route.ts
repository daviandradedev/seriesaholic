import { NextRequest, NextResponse } from "next/server";
import { getPersonalizedRecommendations } from "@/lib/recommendations";

export async function GET(request: NextRequest) {
  try {
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 48);
    const result = await getPersonalizedRecommendations(limit);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate recommendations" },
      { status: 500 },
    );
  }
}
