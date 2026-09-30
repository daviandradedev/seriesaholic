"use client";

import { usePreferences } from "@/components/Preferences";
import type { CopyKey } from "@/lib/copy";

export function PageLoading({
  labelKey = "loading",
  accent = "violet",
}: {
  labelKey?: CopyKey;
  accent?: "violet" | "emerald";
}) {
  const { t } = usePreferences();
  const ring = accent === "emerald" ? "border-emerald-400" : "border-violet-500";

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className={`h-8 w-8 animate-spin rounded-full border-2 ${ring} border-t-transparent`} />
        <p className="text-sm text-zinc-500">{t(labelKey)}</p>
      </div>
    </div>
  );
}
