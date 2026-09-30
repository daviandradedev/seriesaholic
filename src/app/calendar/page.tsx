import Link from "next/link";
import { getShowsWithProgress } from "@/lib/shows";
import { getSeasonDetails, getShowDetails } from "@/lib/tmdb";
import { getTranslator } from "@/lib/i18n";
import { formatDate, startOfDay } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CalendarEntry = {
  tmdbId: number;
  showTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeName: string;
  airDate: string;
};

type WatchingShow = {
  tmdbId: number | null;
  title: string;
};

export default async function CalendarPage() {
  const { t, language } = await getTranslator();
  const shows = (await getShowsWithProgress("WATCHING")).filter(
    (s) => s.watchedCount > 0,
  );

  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + 30);

  const watched = shows.filter((show) => show.tmdbId != null).slice(0, 15);
  const groups = await mapWithConcurrency(watched, 4, (show) =>
    upcomingForShow(show, today, end),
  );
  const entries = groups.flat();

  entries.sort((a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime());

  const byDate = entries.reduce<Record<string, CalendarEntry[]>>((acc, entry) => {
    (acc[entry.airDate] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("calendarTitle")}</h1>
        <p className="mt-1 text-zinc-400">{t("calendarSubtitle")}</p>
      </div>

      {Object.keys(byDate).length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-zinc-500">
          {t("calendarEmpty")}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDate).map(([date, eps]) => (
            <section key={date}>
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-violet-400">
                {formatDate(date, language)}
              </h2>
              <div className="space-y-2">
                {eps.map((ep) => (
                  <Link
                    key={`${ep.tmdbId}-${ep.seasonNumber}-${ep.episodeNumber}`}
                    href={`/shows/${ep.tmdbId}`}
                    className="block rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 hover:bg-white/[0.05]"
                  >
                    <p className="font-medium text-white">{ep.showTitle}</p>
                    <p className="text-sm text-zinc-400">
                      S{ep.seasonNumber}E{ep.episodeNumber} · {ep.episodeName}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

async function upcomingForShow(show: WatchingShow, today: Date, end: Date): Promise<CalendarEntry[]> {
  if (show.tmdbId == null) return [];
  try {
    const details = await getShowDetails(show.tmdbId);
    const lastSeason = details.number_of_seasons;
    if (lastSeason <= 0) return [];

    const seasonNumbers = [];
    for (let season = Math.max(1, lastSeason - 1); season <= lastSeason; season++) {
      seasonNumbers.push(season);
    }

    const seasons = await Promise.all(
      seasonNumbers.map(async (seasonNumber) => {
        try {
          return await getSeasonDetails(show.tmdbId!, seasonNumber);
        } catch {
          return null;
        }
      }),
    );

    const entries: CalendarEntry[] = [];
    for (const season of seasons) {
      if (!season) continue;
      for (const episode of season.episodes) {
        if (!episode.air_date) continue;
        const air = startOfDay(new Date(episode.air_date));
        if (air < today || air > end) continue;
        entries.push({
          tmdbId: show.tmdbId,
          showTitle: show.title,
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
          episodeName: episode.name,
          airDate: episode.air_date,
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
