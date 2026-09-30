import { NextRequest, NextResponse } from "next/server";
import {
  getDiscoverShows,
  getCatalogStats,
  syncCatalogFromTmdb,
  syncCatalogIfEmpty,
  type CatalogCategory,
} from "@/lib/catalog";

export async function GET(request: NextRequest) {
  try {
    await syncCatalogIfEmpty();

    const category = request.nextUrl.searchParams.get("category") as CatalogCategory | null;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 24);

    const [shows, stats] = await Promise.all([
      getDiscoverShows({
        category: category ?? undefined,
        limit,
        excludeTracked: true,
      }),
      getCatalogStats(),
    ]);

    return NextResponse.json({ shows, stats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load catalog" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await syncCatalogFromTmdb();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync catalog" },
      { status: 500 },
    );
  }
}
