import { NextRequest, NextResponse } from "next/server";
import { createCustomShow, searchLibraryShows, showPath } from "@/lib/shows";
import { getTranslator } from "@/lib/i18n";
import { jsonError } from "@/lib/session-user";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!q) return NextResponse.json({ shows: [] });
    const { language } = await getTranslator();
    return NextResponse.json({ shows: await searchLibraryShows(q, language) });
  } catch (err) {
    return jsonError(err, "Failed to list shows");
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
