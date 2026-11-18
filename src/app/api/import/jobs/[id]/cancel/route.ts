import { NextRequest, NextResponse } from "next/server";
import { requestCancelImportJob } from "@/lib/import-jobs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requestCancelImportJob(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to cancel" },
      { status: 400 },
    );
  }
}
