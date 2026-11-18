import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESET_CONFIRM_PHRASES, isResetConfirmPhrase } from "@/lib/reset-confirm";
import { resetAllUserData } from "@/lib/reset-library";
import { jsonError } from "@/lib/session-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (!isResetConfirmPhrase(body?.confirm)) {
      return NextResponse.json(
        {
          error: `Invalid confirmation. Send confirm: "${RESET_CONFIRM_PHRASES.join('" or "')}".`,
        },
        { status: 400 },
      );
    }

    const running = await prisma.importJob.findFirst({
      where: { status: "RUNNING" },
      select: { id: true },
    });

    if (running) {
      return NextResponse.json(
        {
          error:
            "An import is running. Wait for it to finish before clearing.",
        },
        { status: 409 },
      );
    }

    const result = await resetAllUserData();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return jsonError(err, "Failed to clear data");
  }
}
