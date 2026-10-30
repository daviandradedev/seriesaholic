import { NextRequest, NextResponse } from "next/server";
import { searchShows, tmdbLanguage } from "@/lib/tmdb";
import { prisma } from "@/lib/db";
import { getTranslator } from "@/lib/i18n";
import { getOptionalUserId } from "@/lib/session-user";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q");
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const [{ language }, userId] = await Promise.all([getTranslator(), getOptionalUserId()]);
    const data = await searchShows(query, 1, undefined, tmdbLanguage(language));
    const tracked = userId
      ? await prisma.show.findMany({
          where: { userId, tmdbId: { in: data.results.map((r) => r.id) } },
          select: { tmdbId: true, status: true },
        })
      : [];
    const trackedMap = new Map(tracked.map((t) => [t.tmdbId, t.status]));

    const results = data.results.map((r) => ({
      ...r,
      tracked: trackedMap.has(r.id),
      status: trackedMap.get(r.id) ?? null,
    }));

    return NextResponse.json({ results, totalPages: data.total_pages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
