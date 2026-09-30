import { BarChart3 } from "lucide-react";
import { getWatchStats } from "@/lib/stats";
import {
  BarChart,
  GenreTable,
  MarathonTable,
  StatBlock,
} from "@/components/stats/StatsCards";
import { numberLocale } from "@/lib/copy";
import { getTranslator } from "@/lib/i18n";
import { formatWatchTimeDetailed } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const { t, language } = await getTranslator();
  const locale = numberLocale(language);
  let stats: Awaited<ReturnType<typeof getWatchStats>> | null = null;
  let error: string | null = null;

  try {
    stats = await getWatchStats();
  } catch (err) {
    error = err instanceof Error ? err.message : t("statsLoadError");
  }

  const hoursLast7Days = stats
    ? Math.round((stats.watchMinutesLast7Days / 60) * 10) / 10
    : 0;

  const watchTimeSubtitle =
    stats && stats.totalWatchMinutes > 0
      ? t("episodesWithRuntime", {
          n: stats.episodesWithRuntime.toLocaleString(locale),
          hours: hoursLast7Days,
        })
      : stats && stats.episodesWithRuntime === 0
        ? t("watchTimeNoRuntime")
        : t("watchTimeLast7", { hours: hoursLast7Days });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">{t("statsTitle")}</h1>
        </div>
        <p className="mt-1 text-zinc-400">{t("statsSubtitle")}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {stats && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <StatBlock
              title={t("watchTime")}
              value={
                stats.totalWatchMinutes > 0
                  ? formatWatchTimeDetailed(stats.totalWatchMinutes, language)
                  : "—"
              }
              subtitle={watchTimeSubtitle}
            />
            <StatBlock
              title={t("totalEpisodes")}
              value={stats.totalEpisodes.toLocaleString(locale)}
              subtitle={t("episodesLast7", { n: stats.episodesLast7Days })}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title={t("watchTime")}
              data={stats.hoursByWeek}
              unit={t("hoursUnit")}
              footer={t("perWeekRuntime")}
            />
            <BarChart
              title={t("episodes")}
              data={stats.episodesByWeek}
              unit={t("episodesUnit")}
              footer={t("perWeek")}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <StatBlock
              title={t("remainingEpisodes")}
              value={stats.remainingEpisodes.toLocaleString(locale)}
              subtitle={t("inStartedShows", { n: stats.startedShows })}
            />
            <StatBlock
              title={t("catchUp")}
              value={t("catchUpValue", { n: stats.catchUpEpisodesPerWeek })}
              subtitle={t("catchUpBase")}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title={t("upcomingEpisodes")}
              data={stats.upcomingByMonth}
              unit={t("episodesUnit")}
              footer={t("perMonth")}
            />
            <StatBlock
              title={t("timeToWatch")}
              value={stats.timeToWatchHours.toLocaleString(locale)}
              subtitle={t("hoursUnit")}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <BarChart
              title={t("futureAirtime")}
              data={stats.futureWatchHoursByMonth}
              unit={t("hoursUnit")}
              footer={t("perMonth")}
            />
            <StatBlock
              title={t("addedShows")}
              value={stats.addedShows.toLocaleString(locale)}
              subtitle={t("stillInProduction", { n: stats.stillInProduction })}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <MarathonTable marathons={stats.marathons} />
            <GenreTable genres={stats.topGenres} />
          </section>
        </>
      )}
    </div>
  );
}
