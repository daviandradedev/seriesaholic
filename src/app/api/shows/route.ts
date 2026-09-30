import { NextRequest, NextResponse } from "next/server";
import { createCustomShow, getShowsWithProgress, showPath } from "@/lib/shows";
import { jsonError } from "@/lib/session-user";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const shows = await getShowsWithProgress();
    const filtered =
      q && q.length >= 1
        ? shows.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
        : shows;

    return NextResponse.json({
      shows: filtered.slice(0, 40).map((s) => ({ ...s, href: showPath(s) })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list shows" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const show = await createCustomShow(body);
    return NextResponse.json({ ...show, href: showPath(show) }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Failed to create show");
  }
}
