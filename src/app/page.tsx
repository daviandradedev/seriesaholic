import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DashboardStatsBar } from "@/components/DashboardStatsBar";
import { HomeRecommendations } from "@/components/HomeRecommendations";
import { WatchQueueSection, HOME_QUEUE_PREVIEW } from "@/components/WatchQueueSection";
import { getCachedHomeLibrary, getCachedHomeUpcoming } from "@/lib/home-data";
import { getTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { t } = await getTranslator();
  const { stats, queue, watchingTmdbIds } = await getCachedHomeLibrary();

  const hasQueue =
    queue.watchNext.length > 0 ||
    queue.backlog.length > 0 ||
    queue.upToDate.length > 0 ||
    queue.notStarted.length > 0 ||
    queue.finished.length > 0 ||
    queue.dropped.length > 0;

  return (
    <div className="space-y-8">
      {stats.totalShows > 0 ? (
        <DashboardStatsBar
          totalShows={stats.totalShows}
          totalEpisodes={stats.totalEpisodes}
          totalWatchMinutes={stats.totalWatchMinutes}
        />
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/shows/new"
          className="inline-flex items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/20"
        >
          <Plus className="h-4 w-4" />
          {t("newShow")}
        </Link>
      </div>

      {stats.totalShows === 0 && (
        <section className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 p-8 text-center">
          <h2 className="text-lg font-semibold text-white">{t("emptyLibrary")}</h2>
          <p className="mt-2 text-sm text-zinc-400">{t("emptyLibraryBody")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/discover"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              {t("discoverShows")}
            </Link>
            <Link
              href="/shows/new"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              {t("createShow")}
            </Link>
            <Link
              href="/import"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              {t("importTvTime")}
            </Link>
          </div>
        </section>
      )}

      {hasQueue && (
        <div className="space-y-8">
          {(
            [
              [t("watchNow"), queue.watchNext, false],
              [t("backlog"), queue.backlog, false],
              [t("upToDate"), queue.upToDate, true],
              [t("notStarted"), queue.notStarted, true],
            ] as const
          ).map(([title, shows, limited], index, sections) => {
            const priorEmpty = sections.slice(0, index).every(([, s]) => s.length === 0);
            return (
              <WatchQueueSection
                key={title}
                title={title}
                shows={shows}
                limit={limited ? HOME_QUEUE_PREVIEW : undefined}
                priority={shows.length > 0 && priorEmpty}
              />
            );
          })}
          <WatchQueueSection
            title={t("finished")}
            shows={queue.finished}
            limit={HOME_QUEUE_PREVIEW}
            seeAllHref="/shows/finished"
            priority={
              queue.finished.length > 0 &&
              queue.watchNext.length === 0 &&
              queue.backlog.length === 0 &&
              queue.upToDate.length === 0 &&
              queue.notStarted.length === 0
            }
          />
          <WatchQueueSection
            title={t("dropped")}
            shows={queue.dropped}
            limit={HOME_QUEUE_PREVIEW}
          />
        </div>
      )}

      {watchingTmdbIds.length > 0 ? (
        <Suspense
          fallback={<p className="text-sm text-zinc-500">{t("loadingUpcoming")}</p>}
        >
          <HomeUpcoming watchingTmdbIds={watchingTmdbIds} />
        </Suspense>
      ) : null}

      {stats.totalShows > 0 ? <HomeRecommendations /> : null}
    </div>
  );
}

async function HomeUpcoming({ watchingTmdbIds }: { watchingTmdbIds: number[] }) {
  const { t, language } = await getTranslator();
  const upcoming = await getCachedHomeUpcoming(watchingTmdbIds);
  if (upcoming.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">{t("upcomingEpisodes")}</h2>
      <div className="space-y-2">
        {upcoming.slice(0, 8).map((ep) => (
          <Link
            key={`${ep.tmdbShowId}-${ep.seasonNumber}-${ep.episodeNumber}`}
            href={`/shows/${ep.tmdbShowId}`}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05]"
          >
            <div>
              <p className="font-medium text-white">{ep.showName}</p>
              <p className="text-sm text-zinc-400">
                S{ep.seasonNumber}E{ep.episodeNumber} · {ep.episodeName}
              </p>
            </div>
            <span className="text-xs text-violet-400">{formatDate(ep.airDate, language)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
