import Papa from "papaparse";
import JSZip from "jszip";
import type { ImportItem } from "./types";

type TrackingV1Row = {
  uuid?: string;
  type?: string;
  entity_type?: string;
  series_name?: string;
  movie_name?: string;
  release_date?: string;
  alpha_range_key?: string;
  season_number?: string;
  episode_number?: string;
  episode_id?: string;
  watch_date_range_key?: string;
  created_at?: string;
};

type TrackingV2Row = {
  key?: string;
  created_at?: string;
  s_id?: string;
  series_name?: string;
  season_number?: string;
  episode_number?: string;
  episode_id?: string;
  is_followed?: string;
  is_for_later?: string;
  is_archived?: string;
};

type FollowedShowRow = {
  tv_show_id?: string;
  tv_show_name?: string;
  archived?: string;
};

type LiberatorRow = {
  imdb_id?: string;
  tvdb_id?: string;
  type?: string;
  title?: string;
  season?: string;
  episode?: string;
  is_watched?: string;
  watched_at?: string;
  is_watchlisted?: string;
  rating?: string;
  status?: string;
};

type TvTimeJsonShow = {
  uuid?: string;
  id?: { tvdb?: number; imdb?: string };
  title?: string;
  status?: string;
  seasons?: Array<{
    number: number;
    episodes?: Array<{
      id?: { tvdb?: number; imdb?: string };
      number: number;
      special?: boolean;
      is_watched?: boolean;
      watched_at?: string;
      rating?: number;
    }>;
  }>;
};

type TvTimeList = {
  name?: string;
  items?: Array<{
    type?: string;
    tvdb_id?: number | string;
    name?: string;
  }>;
};

function toInt(value?: string | number): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

function toISOString(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function parseCsv(text: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

async function unzipEntries(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entries: { name: string; text: string }[] = [];

  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const text = await file.async("string");
    entries.push({ name: name.split("/").pop() ?? name, text });
  }
  return entries;
}

function parseV2Episode(row: TrackingV2Row): ImportItem | null {
  if (!row.key?.startsWith("watch-episode-")) return null;
  const showTvdb = toInt(row.s_id);
  const episodeTvdb = toInt(row.episode_id);
  if (showTvdb == null && episodeTvdb == null) return null;

  return {
    action: "history",
    type: "episode",
    ids: { showTvdb: showTvdb ?? undefined, episodeTvdb: episodeTvdb ?? undefined },
    title: row.series_name,
    season: toInt(row.season_number),
    episode: toInt(row.episode_number),
    watchedAt: toISOString(row.created_at),
  };
}

function parseV2Watchlist(
  rows: TrackingV2Row[],
  watchedShowIds: Set<number>,
): ImportItem[] {
  return rows
    .filter((row) => row.key?.startsWith("user-series-"))
    .filter((row) => row.is_archived !== "true")
    .filter(
      (row) =>
        row.is_for_later === "true" ||
        (row.is_followed === "true" &&
          !watchedShowIds.has(toInt(row.s_id) ?? -1)),
    )
    .flatMap((row) => {
      const tvdbId = toInt(row.s_id);
      if (tvdbId == null) return [];
      return [
        {
          action: "watchlist" as const,
          type: "show" as const,
          ids: { showTvdb: tvdbId, tvdb: tvdbId },
          title: row.series_name,
        },
      ];
    });
}

function parseFollowedWatchlist(
  rows: FollowedShowRow[],
  watchedShowIds: Set<number>,
  seenShowIds: Set<number>,
): ImportItem[] {
  return rows
    .filter((row) => row.archived !== "1")
    .flatMap((row) => {
      const tvdbId = toInt(row.tv_show_id);
      if (tvdbId == null) return [];
      if (watchedShowIds.has(tvdbId) || seenShowIds.has(tvdbId)) return [];
      return [
        {
          action: "watchlist" as const,
          type: "show" as const,
          ids: { showTvdb: tvdbId, tvdb: tvdbId },
          title: row.tv_show_name,
        },
      ];
    });
}

function parseV1Episode(row: TrackingV1Row): ImportItem | null {
  if (row.type !== "watch" || row.entity_type !== "episode") return null;
  const tvdbId = toInt(row.episode_id);
  if (tvdbId == null) return null;

  let watchedAt: string | undefined;
  const match = row.watch_date_range_key?.match(/watch-date-(\d+)/);
  if (match) watchedAt = new Date(Number(match[1]) * 1000).toISOString();
  else watchedAt = toISOString(row.created_at);

  return {
    action: "history",
    type: "episode",
    ids: { episodeTvdb: tvdbId ?? undefined },
    title: row.series_name,
    season: toInt(row.season_number),
    episode: toInt(row.episode_number),
    watchedAt,
  };
}

function parseGdprCsvEntries(entries: { name: string; text: string }[]): ImportItem[] {
  const v1Rows: TrackingV1Row[] = [];
  const v2Rows: TrackingV2Row[] = [];
  const followedRows: FollowedShowRow[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(".csv")) continue;
    const rows = parseCsv(entry.text);
    const first = rows[0];
    if (!first) continue;

    if ("key" in first) v2Rows.push(...(rows as TrackingV2Row[]));
    else if ("type-uuid-n" in first) v1Rows.push(...(rows as TrackingV1Row[]));
    else if ("notification_offset" in first) {
      followedRows.push(...(rows as FollowedShowRow[]));
    }
  }

  const episodes =
    v2Rows.length > 0
      ? v2Rows.map(parseV2Episode).filter((i): i is ImportItem => i !== null)
      : v1Rows.map(parseV1Episode).filter((i): i is ImportItem => i !== null);

  const watchedShowIds = new Set(
    v2Rows
      .filter((row) => row.key?.startsWith("watch-episode-"))
      .map((row) => toInt(row.s_id))
      .filter((id): id is number => id != null),
  );

  const showWatchlist = parseV2Watchlist(v2Rows, watchedShowIds);
  const watchlistedIds = new Set(
    showWatchlist.map((i) => i.ids.tvdb).filter((id): id is number => id != null),
  );
  const followedWatchlist = parseFollowedWatchlist(
    followedRows,
    watchedShowIds,
    watchlistedIds,
  );

  return [...episodes, ...showWatchlist, ...followedWatchlist];
}

function parseLiberatorRows(rows: LiberatorRow[]): ImportItem[] {
  const items: ImportItem[] = [];

  for (const row of rows) {
    const imdbId = row.imdb_id && row.imdb_id !== "-1" ? row.imdb_id : undefined;
    const tvdbId = toInt(row.tvdb_id);
    if (!imdbId && tvdbId == null) continue;

    const typeRaw = row.type?.toLowerCase();
    if (typeRaw === "movie" || typeRaw === "film") continue;

    const type =
      typeRaw === "episode"
        ? "episode"
        : typeRaw === "show" || typeRaw === "series"
          ? "show"
          : null;

    if (!type) continue;

    const base = {
      type: type as "show" | "episode",
      ids: {
        imdb: imdbId,
        showTvdb: type !== "episode" ? tvdbId : undefined,
        tvdb: tvdbId,
      },
      title: row.title,
      season: toInt(row.season),
      episode: toInt(row.episode),
    };

    if (row.is_watched === "true") {
      items.push({
        ...base,
        action: "history",
        watchedAt: toISOString(row.watched_at),
      });
    }
    if (row.is_watchlisted === "true") {
      items.push({ ...base, action: "watchlist" });
    }
    if (row.status === "stopped" && base.type === "show") {
      items.push({ ...base, action: "dropped" });
    }
    const rating = toInt(row.rating);
    if (rating != null && base.type !== "episode") {
      items.push({ ...base, action: "ratings", rating: rating * 2 });
    }
  }

  return items;
}

function isSeriesShowJson(value: unknown): value is TvTimeJsonShow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.title === "string" &&
    (Array.isArray(row.seasons) || typeof row.status === "string")
  );
}

function isListsJson(value: unknown): value is TvTimeList[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const row = value[0] as Record<string, unknown>;
  return typeof row?.name === "string" && Array.isArray(row?.items);
}

function parseJsonShows(data: TvTimeJsonShow[]): ImportItem[] {
  const items: ImportItem[] = [];

  for (const show of data) {
    const showTvdb = show.id?.tvdb;
    const showImdb = show.id?.imdb;

    if (
      show.status === "followed" ||
      show.status === "towatch" ||
      show.status === "not_started_yet"
    ) {
      items.push({
        action: "watchlist",
        type: "show",
        ids: { showTvdb: showTvdb, tvdb: showTvdb, imdb: showImdb },
        title: show.title,
      });
    }

    if (show.status === "stopped") {
      items.push({
        action: "dropped",
        type: "show",
        ids: { showTvdb: showTvdb, tvdb: showTvdb, imdb: showImdb },
        title: show.title,
      });
    }

    for (const season of show.seasons ?? []) {
      for (const ep of season.episodes ?? []) {
        if (ep.special) continue;
        if (ep.is_watched) {
          items.push({
            action: "history",
            type: "episode",
            ids: {
              showTvdb: showTvdb,
              tvdb: showTvdb,
              episodeTvdb: ep.id?.tvdb,
              imdb: showImdb,
            },
            title: show.title,
            season: season.number,
            episode: ep.number,
            watchedAt: toISOString(ep.watched_at),
            rating: ep.rating != null ? ep.rating * 2 : undefined,
          });
        }
      }
    }
  }

  return items;
}

function parseJsonLists(lists: TvTimeList[]): ImportItem[] {
  const items: ImportItem[] = [];
  const seen = new Set<number>();

  for (const list of lists) {
    for (const entry of list.items ?? []) {
      if (entry.type === "movie" || entry.type === "film") continue;
      const tvdbId = toInt(entry.tvdb_id);
      if (tvdbId == null || seen.has(tvdbId)) continue;
      seen.add(tvdbId);
      items.push({
        action: "watchlist",
        type: "show",
        ids: { showTvdb: tvdbId, tvdb: tvdbId },
        title: entry.name,
      });
    }
  }

  return items;
}

function collectJsonPayloads(
  entries: { name: string; text: string }[],
): ImportItem[] {
  const seriesChunks: TvTimeJsonShow[][] = [];
  const listChunks: TvTimeList[][] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(".json")) continue;
    if (entry.name.includes("movie")) continue;

    let data: unknown;
    try {
      data = JSON.parse(entry.text);
    } catch {
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) continue;

    if (isListsJson(data) || entry.name.includes("lists")) {
      if (isListsJson(data)) listChunks.push(data);
      continue;
    }

    if (
      entry.name.includes("series") ||
      data.every((row) => isSeriesShowJson(row))
    ) {
      seriesChunks.push(data.filter(isSeriesShowJson));
    }
  }

  const fromSeries =
    seriesChunks.length > 0
      ? parseJsonShows(
          seriesChunks.reduce((best, cur) =>
            cur.length > best.length ? cur : best,
          ),
        )
      : [];
  if (fromSeries.length > 0) return fromSeries;

  return listChunks.flatMap(parseJsonLists);
}

export async function parseTvTimeExport(
  files: { name: string; buffer: ArrayBuffer }[],
): Promise<{ items: ImportItem[]; format: string; filesProcessed: string[] }> {
  const allEntries: { name: string; text: string }[] = [];
  const filesProcessed: string[] = [];

  for (const file of files) {
    filesProcessed.push(file.name);
    if (file.name.endsWith(".zip")) {
      const entries = await unzipEntries(file.buffer);
      allEntries.push(...entries);
    } else if (file.name.endsWith(".csv")) {
      const text = new TextDecoder().decode(file.buffer);
      allEntries.push({ name: file.name, text });
    } else if (file.name.endsWith(".json")) {
      const text = new TextDecoder().decode(file.buffer);
      allEntries.push({ name: file.name, text });
    }
  }

  if (allEntries.some((e) => e.name === "activity_history.csv")) {
    const rows = allEntries
      .filter((e) => e.name === "activity_history.csv")
      .flatMap((e) => parseCsv(e.text) as LiberatorRow[]);
    return { items: parseLiberatorRows(rows), format: "liberator", filesProcessed };
  }

  const gdprItems = parseGdprCsvEntries(allEntries);
  if (gdprItems.length > 0) {
    return { items: gdprItems, format: "gdpr", filesProcessed };
  }

  const jsonItems = collectJsonPayloads(allEntries);
  if (jsonItems.length > 0) {
    return { items: jsonItems, format: "json", filesProcessed };
  }

  return { items: [], format: "unknown", filesProcessed };
}
