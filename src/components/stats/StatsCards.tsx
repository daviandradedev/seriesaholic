"use client";

import { usePreferences } from "@/components/Preferences";
import { cn } from "@/lib/utils";

type BarChartProps = {
  title: string;
  data: Array<{ label: string; value: number; isCurrent?: boolean }>;
  unit?: string;
  valueSuffix?: string;
  footer?: string;
};

export function BarChart({ title, data, unit, valueSuffix = "", footer }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">{title}</h3>
      <div className="relative mt-6">
        {unit && (
          <span className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase text-zinc-600">
            {unit}
          </span>
        )}
        <div className="flex items-end justify-between gap-1 pl-4 sm:gap-2">
          {data.map((item) => {
            const height = item.value > 0 ? Math.max(8, (item.value / max) * 100) : 4;
            return (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {item.value > 0 ? `${item.value}${valueSuffix}` : "0"}
                </span>
                <div
                  className={cn(
                    "w-full max-w-8 rounded-t-sm transition-all",
                    item.isCurrent
                      ? "bg-emerald-400"
                      : item.value > 0
                        ? "bg-zinc-600"
                        : "bg-zinc-800",
                  )}
                  style={{ height: `${height}px` }}
                />
                <span className="text-[10px] text-zinc-600">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {footer && (
        <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-zinc-600">
          {footer}
        </p>
      )}
    </div>
  );
}

type StatBlockProps = {
  title: string;
  value: string | number;
  subtitle?: string;
};

export function StatBlock({ title, value, subtitle }: StatBlockProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">{title}</h3>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white md:text-4xl">{value}</p>
      {subtitle && (
        <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">{subtitle}</p>
      )}
    </div>
  );
}

type GenreTableProps = {
  genres: Array<{ genre: string; shows: number }>;
};

export function GenreTable({ genres }: GenreTableProps) {
  const { t } = usePreferences();

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        {t("topGenres")}
      </h3>
      <div className="mt-4">
        <div className="flex border-b border-white/5 pb-2 text-[10px] uppercase tracking-widest text-zinc-600">
          <span className="flex-1">{t("genre")}</span>
          <span>{t("series")}</span>
        </div>
        {genres.map((g) => (
          <div
            key={g.genre}
            className="flex items-center border-b border-white/5 py-3 last:border-0"
          >
            <span className="flex-1 text-white">{g.genre}</span>
            <span className="tabular-nums text-zinc-400">{g.shows}</span>
          </div>
        ))}
        {genres.length === 0 && (
          <p className="py-4 text-sm text-zinc-500">{t("noGenres")}</p>
        )}
      </div>
    </div>
  );
}

type MarathonTableProps = {
  marathons: Array<{
    showTitle: string;
    showTmdbId: number;
    episodes: number;
    hours: number;
  }>;
};

export function MarathonTable({ marathons }: MarathonTableProps) {
  const { t } = usePreferences();

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        {t("marathons")}
      </h3>
      <div className="mt-4">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/5 pb-2 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>{t("marathonShow")}</span>
          <span className="text-right">{t("marathonEp")}</span>
          <span className="text-right">{t("marathonHours")}</span>
        </div>
        {marathons.map((m, i) => (
          <div
            key={`${m.showTmdbId}-${i}`}
            className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-white/5 py-3 last:border-0"
          >
            <span className="truncate text-white">{m.showTitle}</span>
            <span className="text-right tabular-nums text-zinc-400">{m.episodes}</span>
            <span className="text-right tabular-nums text-zinc-400">{m.hours}</span>
          </div>
        ))}
        {marathons.length === 0 && (
          <p className="py-4 text-sm text-zinc-500">{t("noMarathons")}</p>
        )}
      </div>
    </div>
  );
}
