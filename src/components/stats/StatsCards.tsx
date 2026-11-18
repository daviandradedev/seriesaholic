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
  const { t } = usePreferences();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">{title}</h2>
      <div className="relative mt-6">
        {unit && (
          <span
            aria-hidden="true"
            className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase text-zinc-600"
          >
            {unit}
          </span>
        )}
        <ul className="flex items-end justify-between gap-1 pl-4 sm:gap-2">
          {data.map((item) => {
            const height = item.value > 0 ? Math.max(8, (item.value / max) * 100) : 4;
            return (
              <li key={item.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {item.value > 0 ? `${item.value}${valueSuffix}` : "0"}
                  {unit && <span className="sr-only"> {unit}</span>}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "bar-fill block w-full max-w-8 rounded-t-sm transition-all",
                    item.isCurrent
                      ? "bg-emerald-400"
                      : item.value > 0
                        ? "bg-zinc-600"
                        : "bg-zinc-800",
                  )}
                  style={{ height: `${height}px` }}
                />
                <span className={cn("text-[10px] text-zinc-600", item.isCurrent && "font-semibold")}>
                  {item.label}
                  {item.isCurrent && <span className="sr-only"> ({t("currentPeriod")})</span>}
                </span>
              </li>
            );
          })}
        </ul>
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
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">{title}</h2>
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
      <h2 id="top-genres-title" className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        {t("topGenres")}
      </h2>
      {genres.length === 0 ? (
        <p className="mt-4 py-4 text-sm text-zinc-500">{t("noGenres")}</p>
      ) : (
        <table aria-labelledby="top-genres-title" className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-600">
              <th scope="col" className="pb-2 font-normal">{t("genre")}</th>
              <th scope="col" className="pb-2 text-right font-normal">{t("series")}</th>
            </tr>
          </thead>
          <tbody>
            {genres.map((g) => (
              <tr key={g.genre} className="border-b border-white/5 last:border-0">
                <th scope="row" className="py-3 font-normal text-white">{g.genre}</th>
                <td className="py-3 text-right tabular-nums text-zinc-400">{g.shows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
      <h2 id="marathons-title" className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        {t("marathons")}
      </h2>
      {marathons.length === 0 ? (
        <p className="mt-4 py-4 text-sm text-zinc-500">{t("noMarathons")}</p>
      ) : (
        <table aria-labelledby="marathons-title" className="mt-4 w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-600">
              <th scope="col" className="pb-2 font-normal">{t("marathonShow")}</th>
              <th scope="col" className="w-14 pb-2 text-right font-normal">{t("marathonEp")}</th>
              <th scope="col" className="w-16 pb-2 text-right font-normal">{t("marathonHours")}</th>
            </tr>
          </thead>
          <tbody>
            {marathons.map((m, i) => (
              <tr key={`${m.showTmdbId}-${i}`} className="border-b border-white/5 last:border-0">
                <th scope="row" className="truncate py-3 font-normal text-white">{m.showTitle}</th>
                <td className="py-3 text-right tabular-nums text-zinc-400">{m.episodes}</td>
                <td className="py-3 text-right tabular-nums text-zinc-400">{m.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
