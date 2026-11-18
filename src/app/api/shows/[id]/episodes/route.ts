import { NextRequest, NextResponse } from "next/server";
import { setEpisodesWatched, toggleEpisodeWatch } from "@/lib/shows";
import { jsonError } from "@/lib/session-user";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = Array.isArray(body.episodes)
      ? await setEpisodesWatched(id, body.seasonNumber, body.watched === true, body.episodes)
      : await toggleEpisodeWatch(
          id,
          body.seasonNumber,
          body.episodeNumber,
          body.watched,
          body.episodeName,
        );
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Failed to mark episode");
  }
}
