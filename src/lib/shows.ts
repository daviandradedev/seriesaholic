import { prisma } from "@/lib/db";
import { getEpisodeRuntime, getSeasonDetails, getShowDetails } from "@/lib/tmdb";
import { genresFromTmdb, parseGenresJson } from "@/lib/genres";
import { withSchemaFallback } from "@/lib/prisma-safe";
import { inferLibraryStatus, isRegularSeason } from "@/lib/domain-logic";
import { progressPercent, showPath } from "@/lib/utils";
import { invalidateLibraryCache } from "@/lib/cache-tags";
import { getTotalWatchMinutesFromDb } from "@/lib/watch-runtime";
import { recomputeShowAiredPending } from "@/lib/watch-queue";
import { requireUserId } from "@/lib/session-user";
import type { ShowStatus } from "@prisma/client";

export { showPath };

export async function resolveShowParam(id: string) {
  const userId = await requireUserId();
  if (/^\d+$/.test(id)) {
    const byTmdb = await prisma.show.findFirst({
      where: { userId, tmdbId: parseInt(id, 10) },
    });
    if (byTmdb) return byTmdb;
  }
  return prisma.show.findFirst({ where: { userId, id } });
}

function genreLabels(raw: string | null | undefined) {
  return parseGenresJson(raw).map((name) => ({ name }));
}

export async function getShowsWithProgress(status?: ShowStatus) {
  const userId = await requireUserId();
  const shows = await prisma.show.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      _count: {
        select: {
          episodes: { where: { watched: true, seasonNumber: { gte: 1 } } },
        },
      },
      seasons: { include: { _count: { select: { episodes: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return Promise.all(
    shows.map(async (show) => {
      let totalEpisodes = 0;
      if (show.isCustom || show.tmdbId == null) {
        totalEpisodes = show.seasons.reduce((s, season) => s + season._count.episodes, 0);
      } else {
        try {
          const details = await getShowDetails(show.tmdbId);
          totalEpisodes = details.number_of_episodes;
        } catch {
          totalEpisodes = show._count.episodes;
        }
      }

      return {
        ...show,
        watchedCount: show._count.episodes,
        totalEpisodes,
        progress: progressPercent(show._count.episodes, totalEpisodes),
      };
    }),
  );
}

export async function getShowWithSeasons(id: string) {
  const show = await resolveShowParam(id);
  if (!show) return null;

  const watches = await prisma.episodeWatch.findMany({
    where: { showId: show.id, seasonNumber: { gte: 1 } },
    orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
  });

  const watchedMap = new Map(
    watches.map((e) => [`${e.seasonNumber}-${e.episodeNumber}`, e]),
  );

  const useLocal = show.isCustom || show.tmdbId == null;

  if (useLocal) {
    const localSeasons = await prisma.localSeason.findMany({
      where: { showId: show.id },
      include: { episodes: { orderBy: { episodeNumber: "asc" } } },
      orderBy: { seasonNumber: "asc" },
    });

    const seasons = localSeasons
      .filter((s) => isRegularSeason(s.seasonNumber))
      .map((season) => {
        const episodes = season.episodes.map((ep) => {
          const watch = watchedMap.get(`${season.seasonNumber}-${ep.episodeNumber}`);
          return {
            id: ep.id,
            season_number: season.seasonNumber,
            episode_number: ep.episodeNumber,
            name: ep.name ?? `Episode ${ep.episodeNumber}`,
            overview: ep.overview ?? "",
            air_date: ep.airDate,
            still_path: ep.stillPath,
            runtime: ep.runtimeMinutes,
            watched: watch?.watched ?? false,
            watchedAt: watch?.watchedAt ?? null,
            rating: watch?.rating ?? null,
            watchId: watch ? `${show.id}-${season.seasonNumber}-${ep.episodeNumber}` : null,
          };
        });
        return {
          id: season.id,
          season_number: season.seasonNumber,
          name: season.name || `Season ${season.seasonNumber}`,
          episode_count: episodes.length,
          episodes,
          watchedCount: episodes.filter((e) => e.watched).length,
        };
      });

    const totalEpisodes = seasons.reduce((s, season) => s + season.episodes.length, 0);
    const watchedCount = watches.filter((e) => e.watched).length;

    return {
      show,
      details: {
        number_of_seasons: seasons.length,
        number_of_episodes: totalEpisodes,
        vote_average: 0,
        genres: genreLabels(show.genres),
        status: show.tmdbStatus,
      },
      seasons,
      watchedCount,
      totalEpisodes,
    };
  }

  const details = await getShowDetails(show.tmdbId!);

  if (show.totalEpisodes !== details.number_of_episodes) {
    await prisma.show
      .update({
        where: { id: show.id },
        data: { totalEpisodes: details.number_of_episodes },
      })
      .catch(() => undefined);
  }

  const seasons = await Promise.all(
    Array.from({ length: details.number_of_seasons }, (_, i) => i + 1).map(
      async (seasonNumber) => {
        const season = await getSeasonDetails(show.tmdbId!, seasonNumber);
        const episodes = season.episodes.map((ep) => {
          const watch = watchedMap.get(`${ep.season_number}-${ep.episode_number}`);
          return {
            ...ep,
            watched: watch?.watched ?? false,
            watchedAt: watch?.watchedAt ?? null,
            rating: watch?.rating ?? null,
            watchId: watch
              ? `${show.id}-${ep.season_number}-${ep.episode_number}`
              : null,
          };
        });
        return {
          ...season,
          episodes,
          watchedCount: episodes.filter((e) => e.watched).length,
        };
      },
    ),
  );

  const watchedInListed = seasons.reduce((s, season) => s + season.watchedCount, 0);

  return {
    show,
    details,
    seasons,
    watchedCount: watchedInListed,
    totalEpisodes: details.number_of_episodes,
  };
}

export async function addShowToLibrary(tmdbId: number, inWatchlist = true) {
  const userId = await requireUserId();
  const details = await getShowDetails(tmdbId);
  const external = details.external_ids;
  const meta = genresFromTmdb(details);

  const baseCreate = {
    userId,
    tmdbId,
    tvdbId: external?.tvdb_id ?? null,
    imdbId: external?.imdb_id ?? null,
    title: details.name,
    overview: details.overview,
    posterPath: details.poster_path,
    backdropPath: details.backdrop_path,
    firstAirDate: details.first_air_date,
    inWatchlist,
    isCustom: false,
    totalEpisodes: details.number_of_episodes,
    status: (inWatchlist ? "PLAN_TO_WATCH" : "WATCHING") as ShowStatus,
  };

  const existing = await prisma.show.findFirst({ where: { userId, tmdbId } });
  if (existing) {
    return withSchemaFallback(
      () =>
        prisma.show.update({
          where: { id: existing.id },
          data: { ...meta, totalEpisodes: details.number_of_episodes },
        }),
      () =>
        prisma.show.update({
          where: { id: existing.id },
          data: { totalEpisodes: details.number_of_episodes },
        }),
    ).then((show) => {
      invalidateLibraryCache();
      return show;
    });
  }

  return withSchemaFallback(
    () => prisma.show.create({ data: { ...baseCreate, ...meta } }),
    () => prisma.show.create({ data: baseCreate }),
  ).then((show) => {
    invalidateLibraryCache();
    return show;
  });
}

export type CustomShowInput = {
  title: string;
  overview?: string | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  firstAirDate?: string | null;
  genres?: string[];
  tmdbStatus?: string | null;
  status?: ShowStatus;
  seasons?: Array<{
    seasonNumber: number;
    name?: string | null;
    episodes?: Array<{
      episodeNumber: number;
      name?: string | null;
      overview?: string | null;
      airDate?: string | null;
      runtimeMinutes?: number | null;
      stillPath?: string | null;
    }>;
  }>;
};

export async function createCustomShow(input: CustomShowInput) {
  const userId = await requireUserId();
  const show = await prisma.show.create({
    data: {
      userId,
      title: input.title.trim(),
      overview: input.overview ?? null,
      posterPath: input.posterPath ?? null,
      backdropPath: input.backdropPath ?? null,
      firstAirDate: input.firstAirDate ?? null,
      genres: input.genres ? JSON.stringify(input.genres) : null,
      tmdbStatus: input.tmdbStatus ?? "Returning Series",
      status: input.status ?? "PLAN_TO_WATCH",
      inWatchlist: true,
      isCustom: true,
      tmdbId: null,
    },
  });

  if (input.seasons?.length) {
    await replaceLocalSeasons(show.id, input.seasons);
  }

  invalidateLibraryCache();
  return show;
}

export async function updateShowDetails(
  id: string,
  input: Partial<CustomShowInput> & { title?: string },
) {
  const show = await resolveShowParam(id);
  if (!show) throw new Error("Show not found");

  const data: Record<string, unknown> = {};
  if (input.title != null) data.title = input.title.trim();
  if (input.overview !== undefined) data.overview = input.overview;
  if (input.posterPath !== undefined) data.posterPath = input.posterPath;
  if (input.backdropPath !== undefined) data.backdropPath = input.backdropPath;
  if (input.firstAirDate !== undefined) data.firstAirDate = input.firstAirDate;
  if (input.genres !== undefined) data.genres = JSON.stringify(input.genres);
  if (input.tmdbStatus !== undefined) data.tmdbStatus = input.tmdbStatus;
  if (input.status !== undefined) data.status = input.status;

  const updated = await prisma.show.update({
    where: { id: show.id },
    data,
  });

  if (input.seasons) {
    await replaceLocalSeasons(show.id, input.seasons);
  }

  invalidateLibraryCache();
  return updated;
}

async function replaceLocalSeasons(
  showId: string,
  seasons: NonNullable<CustomShowInput["seasons"]>,
) {
  await prisma.localSeason.deleteMany({ where: { showId } });

  for (const season of seasons) {
    await prisma.localSeason.create({
      data: {
        showId,
        seasonNumber: season.seasonNumber,
        name: season.name ?? `Season ${season.seasonNumber}`,
        episodes: {
          create: (season.episodes ?? []).map((ep) => ({
            episodeNumber: ep.episodeNumber,
            name: ep.name ?? `Episode ${ep.episodeNumber}`,
            overview: ep.overview ?? null,
            airDate: ep.airDate ?? null,
            runtimeMinutes: ep.runtimeMinutes ?? null,
            stillPath: ep.stillPath ?? null,
          })),
        },
      },
    });
  }
}

export async function deleteShow(id: string) {
  const show = await resolveShowParam(id);
  if (!show) throw new Error("Show not found");
  await prisma.show.delete({ where: { id: show.id } });
  invalidateLibraryCache();
  return { ok: true };
}

export async function toggleEpisodeWatch(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean,
  episodeName?: string,
) {
  if (!isRegularSeason(seasonNumber)) {
    throw new Error("Specials (season 0) do not count toward progress");
  }

  const show = await resolveShowParam(id);
  if (!show) throw new Error("Show is not in the library");

  let runtimeMinutes: number | null = null;
  if (watched && (show.isCustom || show.tmdbId == null)) {
    const local = await prisma.localEpisode.findFirst({
      where: {
        episodeNumber,
        season: { showId: show.id, seasonNumber },
      },
    });
    runtimeMinutes = local?.runtimeMinutes ?? null;
  }

  if (watched) {
    await prisma.episodeWatch.upsert({
      where: {
        showId_seasonNumber_episodeNumber: {
          showId: show.id,
          seasonNumber,
          episodeNumber,
        },
      },
      create: {
        showId: show.id,
        seasonNumber,
        episodeNumber,
        episodeName,
        watched: true,
        watchedAt: new Date(),
        runtimeMinutes,
      },
      update: {
        watched: true,
        watchedAt: new Date(),
        ...(runtimeMinutes != null ? { runtimeMinutes } : {}),
      },
    });
  } else {
    await prisma.episodeWatch.deleteMany({
      where: { showId: show.id, seasonNumber, episodeNumber },
    });
  }

  if (show.tmdbId != null && !show.isCustom) {
    void fillWatchMetadata(show.id, show.tmdbId, seasonNumber, episodeNumber, watched).catch(
      () => undefined,
    );
  }

  return refreshShowProgress(show);
}

export async function setEpisodesWatched(
  id: string,
  seasonNumber: number,
  watched: boolean,
  episodes: Array<{ episodeNumber: number; episodeName?: string }>,
) {
  if (!isRegularSeason(seasonNumber)) {
    throw new Error("Specials (season 0) do not count toward progress");
  }

  const show = await resolveShowParam(id);
  if (!show) throw new Error("Show is not in the library");

  const unique = new Map<number, string | undefined>();
  for (const episode of episodes) {
    const episodeNumber = Number(episode.episodeNumber);
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) continue;
    unique.set(episodeNumber, episode.episodeName);
  }
  const list = [...unique.entries()];
  if (list.length === 0) throw new Error("No episodes provided");

  if (watched) {
    const runtimeByEpisode = new Map<number, number | null>();
    if (show.isCustom || show.tmdbId == null) {
      const locals = await prisma.localEpisode.findMany({
        where: {
          episodeNumber: { in: list.map(([episodeNumber]) => episodeNumber) },
          season: { showId: show.id, seasonNumber },
        },
        select: { episodeNumber: true, runtimeMinutes: true },
      });
      for (const local of locals) {
        runtimeByEpisode.set(local.episodeNumber, local.runtimeMinutes);
      }
    }
    const watchedAt = new Date();
    await prisma.episodeWatch.createMany({
      data: list.map(([episodeNumber, episodeName]) => ({
        showId: show.id,
        seasonNumber,
        episodeNumber,
        episodeName,
        watched: true,
        watchedAt,
        runtimeMinutes: runtimeByEpisode.get(episodeNumber) ?? null,
      })),
      skipDuplicates: true,
    });
  } else {
    await prisma.episodeWatch.deleteMany({
      where: {
        showId: show.id,
        seasonNumber,
        episodeNumber: { in: list.map(([episodeNumber]) => episodeNumber) },
      },
    });
  }

  if (show.tmdbId != null && !show.isCustom) {
    void fillSeasonWatchMetadata(
      show.id,
      show.tmdbId,
      seasonNumber,
      list.map(([episodeNumber]) => episodeNumber),
      watched,
    ).catch(() => undefined);
  }

  return refreshShowProgress(show);
}

async function refreshShowProgress(show: {
  id: string;
  totalEpisodes: number | null;
  isCustom: boolean;
  tmdbId: number | null;
  tmdbStatus: string | null;
  status: ShowStatus;
}) {
  const watchedCount = await prisma.episodeWatch.count({
    where: { showId: show.id, watched: true, seasonNumber: { gte: 1 } },
  });

  let totalEpisodes = show.totalEpisodes ?? 0;
  if (show.isCustom || show.tmdbId == null) {
    totalEpisodes = await prisma.localEpisode.count({
      where: { season: { showId: show.id, seasonNumber: { gte: 1 } } },
    });
  }

  const status = inferLibraryStatus({
    watchedCount,
    totalEpisodes,
    tmdbStatus: show.tmdbStatus,
    currentStatus: show.status,
  });

  await prisma.show.update({
    where: { id: show.id },
    data: { status, inWatchlist: false, updatedAt: new Date() },
  });

  invalidateLibraryCache();
  return { watchedCount, status };
}

async function fillWatchMetadata(
  showId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean,
) {
  if (watched) {
    const runtimeMinutes = await getEpisodeRuntime(
      tmdbId,
      seasonNumber,
      episodeNumber,
      new Map(),
    );
    if (runtimeMinutes != null) {
      await prisma.episodeWatch.updateMany({
        where: { showId, seasonNumber, episodeNumber },
        data: { runtimeMinutes },
      });
    }
  }
  await recomputeShowAiredPending(showId);
  invalidateLibraryCache();
}

async function fillSeasonWatchMetadata(
  showId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumbers: number[],
  watched: boolean,
) {
  if (watched) {
    const season = await getSeasonDetails(tmdbId, seasonNumber);
    const selected = new Set(episodeNumbers);
    await Promise.all(
      season.episodes
        .filter(
          (episode) =>
            selected.has(episode.episode_number) && episode.runtime != null,
        )
        .map((episode) =>
          prisma.episodeWatch.updateMany({
            where: {
              showId,
              seasonNumber,
              episodeNumber: episode.episode_number,
            },
            data: { runtimeMinutes: episode.runtime },
          }),
        ),
    );
  }
  await recomputeShowAiredPending(showId);
  invalidateLibraryCache();
}

export async function updateShowStatus(id: string, status: ShowStatus) {
  const show = await resolveShowParam(id);
  if (!show) throw new Error("Show not found");
  const updated = await prisma.show.update({
    where: { id: show.id },
    data: { status, updatedAt: new Date() },
  });
  invalidateLibraryCache();
  return updated;
}

export async function getDashboardStats(userId?: string) {
  const scopeUserId = userId ?? (await requireUserId());
  const showScope = { userId: scopeUserId };
  const [totalShows, watching, completed, planToWatch, dropped, totalEpisodes, watchTime] =
    await Promise.all([
      prisma.show.count({ where: showScope }),
      prisma.show.count({ where: { ...showScope, status: "WATCHING" } }),
      prisma.show.count({ where: { ...showScope, status: "COMPLETED" } }),
      prisma.show.count({ where: { ...showScope, status: "PLAN_TO_WATCH" } }),
      prisma.show.count({ where: { ...showScope, status: "DROPPED" } }),
      prisma.episodeWatch.count({
        where: { watched: true, seasonNumber: { gte: 1 }, show: showScope },
      }),
      getTotalWatchMinutesFromDb(scopeUserId),
    ]);

  return {
    totalShows,
    watching,
    completed,
    planToWatch,
    dropped,
    totalEpisodes,
    totalWatchMinutes: watchTime.totalWatchMinutes,
  };
}

const FINISHED_PAGE_SIZE = 24;

export async function getFinishedShowsPage(page = 1, pageSize = FINISHED_PAGE_SIZE) {
  const userId = await requireUserId();
  const safePage = Math.max(1, page);
  const where = {
    userId,
    status: "COMPLETED" as const,
    episodes: { some: { watched: true, seasonNumber: { gte: 1 } } },
  };

  const [total, shows] = await Promise.all([
    prisma.show.count({ where }),
    prisma.show.findMany({
      where,
      select: {
        id: true,
        tmdbId: true,
        title: true,
        posterPath: true,
        status: true,
        updatedAt: true,
        _count: {
          select: {
            episodes: { where: { watched: true, seasonNumber: { gte: 1 } } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    shows: shows.map((s) => ({
      ...s,
      watchedCount: s._count.episodes,
      href: showPath(s),
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export async function getImportLog(id: string) {
  const userId = await requireUserId();
  return prisma.importLog.findFirst({
    where: { id, userId },
    include: {
      addedShows: { orderBy: { episodesAdded: "desc" } },
    },
  });
}

export async function getImportLogs() {
  const userId = await requireUserId();
  return prisma.importLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { addedShows: true } } },
  });
}
