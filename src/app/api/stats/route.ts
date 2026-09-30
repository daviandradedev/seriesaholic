import { NextResponse } from "next/server";
import { getWatchStats } from "@/lib/stats";

export async function GET() {
  try {
    const stats = await getWatchStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 },
    );
  }
}
