import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseTvTimeExport } from "@/lib/importers/tvtime";
import { countImportWork } from "@/lib/importers/apply";
import { hashImportPayload, runImportJob } from "@/lib/import-jobs";
import { getImportLogs } from "@/lib/shows";
import { requireUserId, jsonError } from "@/lib/session-user";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const running = await prisma.importJob.findFirst({
      where: { userId, status: "RUNNING" },
    });
    if (running) {
      return NextResponse.json(
        { error: "An import is already running.", jobId: running.id },
        { status: 409 },
      );
    }

    const buffers = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        buffer: await file.arrayBuffer(),
      })),
    );

    const contentHash = hashImportPayload(buffers);
    const parsed = await parseTvTimeExport(buffers);

    if (parsed.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum dado reconhecido. Envie o export GDPR (.zip), Liberator ou JSON do TV Time.",
        },
        { status: 400 },
      );
    }

    const { total } = countImportWork(parsed.items);

    const job = await prisma.importJob.create({
      data: {
        userId,
        status: "RUNNING",
        phase: "parsing",
        current: 0,
        total,
        label: "Analisando arquivo...",
        format: parsed.format,
        filesProcessed: JSON.stringify(parsed.filesProcessed),
      },
    });

    const payload = { jobId: job.id, parsed, contentHash, userId };
    const launch = () => {
      void runImportJob(payload.jobId, payload.parsed, {
        contentHash: payload.contentHash,
        userId: payload.userId,
      });
    };

    if (process.env.NODE_ENV === "development") {
      setImmediate(launch);
    } else {
      after(launch);
    }

    return NextResponse.json({
      jobId: job.id,
      total,
      format: parsed.format,
      filesProcessed: parsed.filesProcessed,
      totalItems: parsed.items.length,
      contentHash,
    });
  } catch (err) {
    return jsonError(err, "Failed to start import");
  }
}

export async function GET() {
  const logs = await getImportLogs();
  return Response.json(logs);
}
