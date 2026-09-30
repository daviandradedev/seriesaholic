import { NextRequest, NextResponse } from "next/server";
import { resolveImportFailure } from "@/lib/import-resolve";
import { jsonError } from "@/lib/session-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.importLogId || !body.failureId || !body.mode) {
      return NextResponse.json(
        { error: "importLogId, failureId, and mode are required" },
        { status: 400 },
      );
    }

    const result = await resolveImportFailure({
      importLogId: body.importLogId,
      failureId: body.failureId,
      mode: body.mode,
      showId: body.showId,
      tmdbId: body.tmdbId,
      title: body.title,
    });

    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err, "Failed to resolve failure");
  }
}
