"use client";

import Link from "next/link";
import { BarChart3, Clock, Tv } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { numberLocale } from "@/lib/copy";
import { formatWatchTime } from "@/lib/utils";

type DashboardStatsBarProps = {
  totalShows: number;
  totalEpisodes: number;
  totalWatchMinutes: number;
};

export function DashboardStatsBar({
  totalShows,
  totalEpisodes,
  totalWatchMinutes,
}: DashboardStatsBarProps) {
  const { language, t } = usePreferences();
  const locale = numberLocale(language);

  return (
    <section>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {[
          {
            label: t("series"),
            value: totalShows.toLocaleString(locale),
            icon: Tv,
          },
          {
            label: t("episodes"),
            value: totalEpisodes.toLocaleString(locale),
            icon: Tv,
          },
          {
            label: t("time"),
            value: formatWatchTime(totalWatchMinutes, language),
            icon: Clock,
          },
        ].map(({ label, value, icon: Icon }) => (
          <Link
            key={label}
            href="/stats"
            className="rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.05]"
          >
            <Icon className="mb-1 h-4 w-4 text-violet-400" />
            <p className="text-lg font-bold text-white">{value}</p>
            <p className="text-[10px] text-zinc-500">{label}</p>
          </Link>
        ))}
        <Link
          href="/stats"
          className="col-span-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/10 md:col-span-3"
        >
          <BarChart3 className="h-4 w-4" />
          {t("fullStats")}
        </Link>
      </div>
    </section>
  );
}
