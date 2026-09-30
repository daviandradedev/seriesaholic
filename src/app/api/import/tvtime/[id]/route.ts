import { NextRequest, NextResponse } from "next/server";
import { getImportLog } from "@/lib/shows";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const log = await getImportLog(id);
    if (!log) {
      return NextResponse.json({ error: "Import not found" }, { status: 404 });
    }
    return NextResponse.json(log);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load import" },
      { status: 500 },
    );
  }
}
