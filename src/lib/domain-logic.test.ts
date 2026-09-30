import {
  buildGenreWeights,
  catchUpEpisodesPerWeek,
  classifyShowQueueBucket,
  classifyShowQueueBucketFromLibrary,
  inferLibraryStatus,
  isRegularSeason,
  isShowEnded,
  isShowInProduction,
  libraryStatusFromQueueBucket,
  scoreShowCompatibility,
  sumRealMinutes,
} from "@/lib/domain-logic";
import { genresFromTmdb, parseGenresJson, serializeGenres } from "@/lib/genres";
import { isSchemaFieldError } from "@/lib/prisma-safe";
import { isResetConfirmPhrase, resetConfirmPhrase } from "@/lib/reset-confirm";
import {
  formatWatchTime,
  formatWatchTimeDetailed,
  progressPercent,
  showPath,
  startOfDay,
} from "@/lib/utils";
import { collectTrackedTmdbIds } from "@/lib/catalog";
import {
  countImportWork,
  episodeWatchKey,
  findLocalShow,
  importItemKey,
} from "@/lib/importers/apply";
import type { ImportItem } from "@/lib/importers/types";
import { hashImportPayload } from "@/lib/import-jobs";
import { describe, expect, it } from "vitest";

describe("genres", () => {
  it("parses and serializes genres", () => {
    const raw = serializeGenres(["Drama", "Comedy"]);
    expect(parseGenresJson(raw)).toEqual(["Drama", "Comedy"]);
    expect(parseGenresJson(null)).toEqual([]);
    expect(parseGenresJson("invalid")).toEqual([]);
  });

  it("extracts genres from TMDB", () => {
    const meta = genresFromTmdb({
      genres: [{ id: 1, name: "Drama" }],
      status: "Returning Series",
    });
    expect(parseGenresJson(meta.genres)).toEqual(["Drama"]);
    expect(meta.tmdbStatus).toBe("Returning Series");
  });
});

describe("inferLibraryStatus", () => {
  it("keeps DROPPED and ON_HOLD", () => {
    expect(
      inferLibraryStatus({
        watchedCount: 10,
        totalEpisodes: 10,
        tmdbStatus: "Ended",
        currentStatus: "DROPPED",
      }),
    ).toBe("DROPPED");
    expect(
      inferLibraryStatus({
        watchedCount: 0,
        totalEpisodes: 10,
        currentStatus: "ON_HOLD",
      }),
    ).toBe("ON_HOLD");
  });

  it("sets PLAN_TO_WATCH when there is no progress", () => {
    expect(
      inferLibraryStatus({ watchedCount: 0, totalEpisodes: 10, tmdbStatus: "Ended" }),
    ).toBe("PLAN_TO_WATCH");
  });

  it("completes only when the show has ended and progress covers the total", () => {
    expect(
      inferLibraryStatus({
        watchedCount: 10,
        totalEpisodes: 10,
        tmdbStatus: "Ended",
      }),
    ).toBe("COMPLETED");
    expect(
      inferLibraryStatus({
        watchedCount: 10,
        totalEpisodes: 10,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("WATCHING");
    expect(
      inferLibraryStatus({
        watchedCount: 5,
        totalEpisodes: 10,
        tmdbStatus: "Ended",
      }),
    ).toBe("WATCHING");
  });
});

describe("libraryStatusFromQueueBucket", () => {
  it("maps buckets without overwriting DROPPED or ON_HOLD", () => {
    expect(libraryStatusFromQueueBucket("finished", "DROPPED")).toBeNull();
    expect(libraryStatusFromQueueBucket("finished", "WATCHING")).toBe("COMPLETED");
    expect(libraryStatusFromQueueBucket("notStarted", "WATCHING")).toBe("PLAN_TO_WATCH");
    expect(libraryStatusFromQueueBucket("backlog", "PLAN_TO_WATCH")).toBe("WATCHING");
  });
});

describe("classifyShowQueueBucketFromLibrary", () => {
  it("classifies without TMDB air dates", () => {
    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 0,
        watchedRecently: false,
        status: "PLAN_TO_WATCH",
        tmdbStatus: "Returning Series",
        inWatchlist: true,
      }),
    ).toBe("notStarted");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 0,
        watchedRecently: false,
        status: "PLAN_TO_WATCH",
        tmdbStatus: "Returning Series",
        inWatchlist: false,
      }),
    ).toBeNull();

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 5,
        watchedRecently: true,
        status: "WATCHING",
        tmdbStatus: "Returning Series",
        unwatchedAiredCount: 2,
      }),
    ).toBe("watchNext");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 8,
        watchedRecently: true,
        status: "WATCHING",
        tmdbStatus: "Returning Series",
        unwatchedAiredCount: 0,
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 10,
        watchedRecently: false,
        status: "COMPLETED",
        tmdbStatus: "Ended",
      }),
    ).toBe("finished");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 1,
        watchedRecently: false,
        status: "COMPLETED",
        tmdbStatus: "Ended",
      }),
    ).toBe("finished");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 5,
        watchedRecently: false,
        status: "WATCHING",
        tmdbStatus: "Returning Series",
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 10,
        watchedRecently: true,
        status: "WATCHING",
        tmdbStatus: "Returning Series",
        totalEpisodes: 10,
        unwatchedAiredCount: 0,
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 10,
        watchedRecently: true,
        status: "WATCHING",
        tmdbStatus: "Returning Series",
        totalEpisodes: 10,
        unwatchedAiredCount: 3,
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 3,
        watchedRecently: false,
        status: "WATCHING",
        tmdbStatus: null,
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 2,
        watchedRecently: false,
        status: "PLAN_TO_WATCH",
        tmdbStatus: "Ended",
        inWatchlist: true,
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 4,
        watchedRecently: false,
        status: "WATCHING",
        tmdbStatus: "Ended",
        totalEpisodes: 121,
      }),
    ).toBe("backlog");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 1,
        watchedRecently: false,
        status: "WATCHING",
        tmdbStatus: "Ended",
        totalEpisodes: 1,
      }),
    ).toBe("finished");
  });

  it("keeps a fully watched ended show out of the active queue", () => {
    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 121,
        unwatchedAiredCount: 5,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Ended",
        totalEpisodes: 121,
      }),
    ).toBe("finished");

    expect(
      classifyShowQueueBucketFromLibrary({
        isDropped: false,
        watchedCount: 121,
        watchedRecently: false,
        status: "WATCHING",
        tmdbStatus: "Ended",
        totalEpisodes: 121,
        unwatchedAiredCount: 8,
      }),
    ).toBe("finished");
  });
});

describe("domain-logic", () => {
  it("classifies the full queue with the confirmed flow", () => {
    expect(
      classifyShowQueueBucket({
        isDropped: true,
        watchedCount: 5,
        unwatchedAiredCount: 2,
        recentUnwatchedCount: 1,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("dropped");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 0,
        unwatchedAiredCount: 10,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
        inWatchlist: true,
      }),
    ).toBe("notStarted");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 0,
        unwatchedAiredCount: 10,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
        inWatchlist: false,
      }),
    ).toBeNull();

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 3,
        unwatchedAiredCount: 2,
        recentUnwatchedCount: 2,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("backlog");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 3,
        unwatchedAiredCount: 5,
        recentUnwatchedCount: 0,
        watchedRecently: true,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("watchNext");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 3,
        unwatchedAiredCount: 5,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("backlog");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 10,
        unwatchedAiredCount: 0,
        recentUnwatchedCount: 0,
        watchedRecently: true,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 10,
        unwatchedAiredCount: 0,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Returning Series",
      }),
    ).toBe("upToDate");

    expect(
      classifyShowQueueBucket({
        isDropped: false,
        watchedCount: 10,
        unwatchedAiredCount: 0,
        recentUnwatchedCount: 0,
        watchedRecently: false,
        tmdbStatus: "Ended",
      }),
    ).toBe("finished");
  });

  it("scores compatibility by genre", () => {
    const profile = buildGenreWeights([
      { genres: ["Drama", "Thriller"], episodeCount: 100 },
      { genres: ["Comedy"], episodeCount: 20 },
    ]);

    const dramaMatch = scoreShowCompatibility(["Drama", "Mystery"], profile);
    expect(dramaMatch.matching).toContain("Drama");
    expect(dramaMatch.score).toBeGreaterThan(0);

    const noMatch = scoreShowCompatibility(["Animation"], profile);
    expect(noMatch.score).toBe(0);
  });

  it("detects editorial status", () => {
    expect(isShowInProduction("Returning Series")).toBe(true);
    expect(isShowInProduction("Ended")).toBe(false);
    expect(isShowEnded("Ended")).toBe(true);
    expect(isShowEnded("Canceled")).toBe(true);
    expect(isRegularSeason(0)).toBe(false);
    expect(isRegularSeason(1)).toBe(true);
  });

  it("sums only real minutes", () => {
    expect(sumRealMinutes([{ runtimeMinutes: 45 }, { runtimeMinutes: null }])).toBe(45);
    expect(sumRealMinutes([{ runtimeMinutes: null }])).toBe(0);
    expect(sumRealMinutes([{ runtimeMinutes: 0 }])).toBe(0);
  });

  it("calculates weekly catch-up", () => {
    expect(catchUpEpisodesPerWeek(60)).toBe(7);
  });
});

describe("catalog helpers", () => {
  it("excludes null tmdbId from notIn", () => {
    expect(
      collectTrackedTmdbIds([
        { tmdbId: 1 },
        { tmdbId: null },
        { tmdbId: 42 },
        { tmdbId: null },
      ]),
    ).toEqual([1, 42]);
  });
});

describe("import work", () => {
  it("counts episodes and exclusive watchlist or dropped rows", () => {
    const items: ImportItem[] = [
      {
        action: "history",
        type: "episode",
        ids: { showTvdb: 10 },
        title: "Show A",
        season: 1,
        episode: 1,
      },
      {
        action: "history",
        type: "episode",
        ids: { showTvdb: 10 },
        title: "Show A",
        season: 1,
        episode: 2,
      },
      {
        action: "watchlist",
        type: "show",
        ids: { showTvdb: 10 },
        title: "Show A",
      },
      {
        action: "watchlist",
        type: "show",
        ids: { showTvdb: 20 },
        title: "Show B",
      },
      {
        action: "dropped",
        type: "show",
        ids: { showTvdb: 30 },
        title: "Show C",
      },
    ];

    const work = countImportWork(items);
    expect(work.episodeItems).toHaveLength(2);
    expect(work.watchlistOnly).toBe(1);
    expect(work.droppedOnly).toBe(1);
    expect(work.total).toBe(4);
  });

  it("resolves a local show by tvdb or imdb without TMDB", () => {
    const index = {
      byTvdb: new Map([
        [
          99,
          {
            id: "local-1",
            tmdbId: 1,
            tvdbId: 99,
            imdbId: "tt1",
            title: "Local",
            posterPath: null,
            status: "WATCHING" as const,
            inWatchlist: false,
            userRating: null,
          },
        ],
      ]),
      byImdb: new Map(),
      byTmdb: new Map(),
    };

    expect(findLocalShow({ showTvdb: 99 }, index)?.id).toBe("local-1");
    expect(findLocalShow({ showTvdb: 1 }, index)).toBeNull();
    expect(episodeWatchKey("a", 1, 2)).toBe("a:1:2");
    expect(importItemKey({ ids: { showTvdb: 1 }, title: "Foo (2020)" })).toContain("1-");
  });

  it("keeps the payload hash stable and sensitive to content", () => {
    const a = [{ name: "a.zip", buffer: new TextEncoder().encode("hello").buffer }];
    const b = [{ name: "a.zip", buffer: new TextEncoder().encode("hello").buffer }];
    const c = [{ name: "a.zip", buffer: new TextEncoder().encode("world").buffer }];
    expect(hashImportPayload(a)).toBe(hashImportPayload(b));
    expect(hashImportPayload(a)).not.toBe(hashImportPayload(c));
  });
});

describe("utils", () => {
  it("formats watch time", () => {
    expect(formatWatchTime(0, "en")).toBe("0h");
    expect(formatWatchTime(90, "en")).toBe("1.5h");
    expect(formatWatchTime(60 * 24 * 30 * 6.6, "en")).toContain("months");
  });

  it("formats detailed watch time", () => {
    const text = formatWatchTimeDetailed(60 * 24 * 30 * 7 + 60 * 24 * 5, "en");
    expect(text).toContain("months");
    expect(text).toContain("hours");
  });

  it("calculates progress and paths", () => {
    expect(progressPercent(5, 10)).toBe(50);
    expect(progressPercent(0, 0)).toBe(0);
    expect(showPath({ id: "abc", tmdbId: 99 })).toBe("/shows/99");
    expect(showPath({ id: "abc", tmdbId: null })).toBe("/shows/abc");
  });

  it("normalizes the start of the day", () => {
    const d = startOfDay(new Date("2024-06-15T18:30:00"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("reset confirmation", () => {
  it("accepts the Portuguese and English phrases", () => {
    expect(resetConfirmPhrase("pt")).toBe("APAGAR TUDO");
    expect(resetConfirmPhrase("en")).toBe("DELETE ALL");
    expect(isResetConfirmPhrase("apagar tudo")).toBe(true);
    expect(isResetConfirmPhrase(" delete all ")).toBe(true);
    expect(isResetConfirmPhrase("erase everything")).toBe(false);
  });
});

describe("prisma-safe", () => {
  it("identifies an unknown field error", () => {
    expect(isSchemaFieldError(new Error("Unknown argument `genres`"))).toBe(true);
    expect(isSchemaFieldError(new Error("other"))).toBe(false);
  });
});
