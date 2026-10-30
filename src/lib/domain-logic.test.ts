import {
  buildGenreWeights,
  catchUpEpisodesPerWeek,
  classifyShowQueueBucket,
  inferLibraryStatus,
  isRegularSeason,
  isShowEnded,
  isShowInProduction,
  libraryStatusFromQueueBucket,
  pendingAiredEpisodes,
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

describe("pendingAiredEpisodes", () => {
  it("counts nothing pending once every episode is watched", () => {
    expect(pendingAiredEpisodes({ watchedCount: 10, totalEpisodes: 10, unwatchedAiredCount: 3 })).toBe(0);
  });

  it("adds the next episode once its air date has passed", () => {
    expect(
      pendingAiredEpisodes({
        watchedCount: 8,
        totalEpisodes: 10,
        unwatchedAiredCount: 0,
        nextAirDate: "2026-10-29",
        today: "2026-10-30",
      }),
    ).toBe(1);
    expect(
      pendingAiredEpisodes({
        watchedCount: 8,
        totalEpisodes: 10,
        unwatchedAiredCount: 0,
        nextAirDate: "2026-11-05",
        today: "2026-10-30",
      }),
    ).toBe(0);
  });

  it("falls back to the episode total and returns null without data", () => {
    expect(pendingAiredEpisodes({ watchedCount: 4, totalEpisodes: 121 })).toBe(117);
    expect(pendingAiredEpisodes({ watchedCount: 4 })).toBeNull();
  });
});

describe("classifyShowQueueBucket", () => {
  const base = {
    isDropped: false,
    watchedRecently: false,
    tmdbStatus: "Returning Series",
    status: "WATCHING" as const,
  };

  it("keeps dropped and unstarted shows in their own lists", () => {
    expect(classifyShowQueueBucket({ ...base, isDropped: true, watchedCount: 5 })).toBe("dropped");
    expect(classifyShowQueueBucket({ ...base, watchedCount: 0, inWatchlist: true })).toBe("notStarted");
    expect(classifyShowQueueBucket({ ...base, watchedCount: 0, inWatchlist: false })).toBeNull();
  });

  it("puts a show with aired episodes left in Watch now when marked in the last 45 days", () => {
    expect(
      classifyShowQueueBucket({
        ...base,
        watchedCount: 143,
        totalEpisodes: 145,
        unwatchedAiredCount: 2,
        watchedRecently: true,
      }),
    ).toBe("watchNext");
  });

  it("puts a show with aired episodes left in Behind when nothing was marked in 45 days", () => {
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 143, totalEpisodes: 145, unwatchedAiredCount: 2 }),
    ).toBe("backlog");
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 4, totalEpisodes: 121, tmdbStatus: "Ended" }),
    ).toBe("backlog");
  });

  it("keeps a show with every aired episode watched in Up to date while it is still running", () => {
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 10, totalEpisodes: 12, unwatchedAiredCount: 0 }),
    ).toBe("upToDate");
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 10, totalEpisodes: 10, unwatchedAiredCount: 3 }),
    ).toBe("upToDate");
  });

  it("moves an up-to-date show to Watch now once a new episode airs", () => {
    expect(
      classifyShowQueueBucket({
        ...base,
        watchedCount: 10,
        totalEpisodes: 12,
        unwatchedAiredCount: 0,
        nextAirDate: "2026-10-29",
        today: "2026-10-30",
        watchedRecently: true,
      }),
    ).toBe("watchNext");
  });

  it("finishes a show only when every episode is watched and it will not return", () => {
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 121, totalEpisodes: 121, unwatchedAiredCount: 5, tmdbStatus: "Ended" }),
    ).toBe("finished");
    expect(
      classifyShowQueueBucket({ ...base, watchedCount: 24, totalEpisodes: 24, tmdbStatus: "Canceled" }),
    ).toBe("finished");
    expect(classifyShowQueueBucket({ ...base, watchedCount: 1, status: "COMPLETED", tmdbStatus: "Ended" })).toBe(
      "finished",
    );
  });

  it("leaves a show without episode data in Up to date", () => {
    expect(classifyShowQueueBucket({ ...base, watchedCount: 3, tmdbStatus: null })).toBe("upToDate");
  });
});

describe("domain-logic", () => {
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
            titleEn: null,
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
