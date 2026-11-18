import { NextResponse } from "next/server";
import { getActiveImportJob, getLatestImportJob } from "@/lib/import-jobs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  try {
    const active = await getActiveImportJob();
    if (active) {
      return NextResponse.json({ job: active, source: "active" });
    }

    const latest = await getLatestImportJob();
    return NextResponse.json({ job: latest, source: latest ? "latest" : null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load import" },
      { status: 500 },
    );
  }
}
