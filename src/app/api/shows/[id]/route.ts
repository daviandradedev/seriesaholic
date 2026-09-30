import { NextRequest, NextResponse } from "next/server";
import {
  getShowWithSeasons,
  addShowToLibrary,
  updateShowStatus,
  updateShowDetails,
  deleteShow,
} from "@/lib/shows";
import type { ShowStatus } from "@prisma/client";
import { jsonError } from "@/lib/session-user";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await getShowWithSeasons(id);
    if (!data) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err, "Failed to load show");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tmdbId = parseInt(id, 10);
    if (Number.isNaN(tmdbId)) {
      return NextResponse.json({ error: "Invalid TMDB id" }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const show = await addShowToLibrary(tmdbId, body.inWatchlist ?? true);
    return NextResponse.json(show);
  } catch (err) {
    return jsonError(err, "Failed to add show");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.status && Object.keys(body).length === 1) {
      const show = await updateShowStatus(id, body.status as ShowStatus);
      return NextResponse.json(show);
    }

    const show = await updateShowDetails(id, body);
    return NextResponse.json(show);
  } catch (err) {
    return jsonError(err, "Failed to update show");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await deleteShow(id);
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Failed to delete show");
  }
}
