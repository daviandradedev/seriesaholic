import https from "node:https";

const TMDB_BASE = "https://api.themoviedb.org/3";

const resolveCache = new Map<string, number | null>();

let tmdbImportMode = false;

export function setTmdbImportMode(enabled: boolean) {
  tmdbImportMode = enabled;
}

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key || key === "your_tmdb_api_key_here") {
    throw new Error(
      "TMDB_API_KEY is not set. Get one at https://www.themoviedb.org/settings/api",
    );
  }
  return key;
}

export function clearResolveCache() {
  resolveCache.clear();
}

export function parseTitleYear(title: string): { name: string; year?: number } {
  const match = title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
  if (match) return { name: match[1].trim(), year: parseInt(match[2], 10) };
  return { name: title.trim() };
}

function nodeHttpsGet(
  url: string,
  signal?: AbortSignal,
  timeoutMs = 8_000,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 500,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    const fail = (err: Error) => {
      clearTimeout(timeoutId);
      reject(err);
    };

    req.on("error", fail);

    const timeoutId = setTimeout(() => {
      req.destroy(new Error(`TMDB timeout: ${url}`));
    }, timeoutMs);

    req.on("close", () => clearTimeout(timeoutId));

    if (signal) {
      if (signal.aborted) {
        req.destroy(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => req.destroy(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    }
  });
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  url.searchParams.set("language", "pt-BR");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    if (tmdbImportMode) {
      const { status, body } = await nodeHttpsGet(url.toString(), signal);
      if (status >= 400) {
        throw new Error(`TMDB ${path}: ${status} ${body}`);
      }
      return JSON.parse(body) as T;
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TMDB ${path}: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export type TmdbSearchResult = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  popularity?: number;
};

export type TmdbShowDetails = TmdbSearchResult & {
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id: string | null; tvdb_id: number | null };
};

export type TmdbSeason = {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  episodes: TmdbEpisode[];
};

export type TmdbEpisode = {
  id: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  runtime: number | null;
};

export async function searchShows(query: string, page = 1, year?: number) {
  const params: Record<string, string> = { query, page: String(page) };
  if (year) params.first_air_date_year = String(year);
  return tmdbFetch<{ results: TmdbSearchResult[]; total_pages: number }>(
    "/search/tv",
    params,
  );
}

type TmdbListResponse = { results: TmdbSearchResult[]; total_pages: number };

export async function getTrendingShows(page = 1) {
  return tmdbFetch<TmdbListResponse>("/trending/tv/day", { page: String(page) });
}

export async function getPopularShows(page = 1) {
  return tmdbFetch<TmdbListResponse>("/tv/popular", { page: String(page) });
}

export async function getTopRatedShows(page = 1) {
  return tmdbFetch<TmdbListResponse>("/tv/top_rated", { page: String(page) });
}

let genreIdCache: Map<string, number> | null = null;

export async function getGenreIdMap() {
  if (genreIdCache) return genreIdCache;
  const data = await tmdbFetch<{ genres: { id: number; name: string }[] }>("/genre/tv/list");
  genreIdCache = new Map(data.genres.map((g) => [g.name, g.id]));
  return genreIdCache;
}

export async function discoverByGenres(genreIds: number[], page = 1) {
  return tmdbFetch<TmdbListResponse>("/discover/tv", {
    with_genres: genreIds.join(","),
    sort_by: "popularity.desc",
    page: String(page),
  });
}

export async function getShowDetails(tmdbId: number, signal?: AbortSignal) {
  return tmdbFetch<TmdbShowDetails>(
    `/tv/${tmdbId}`,
    { append_to_response: "external_ids" },
    signal,
  );
}

export async function getSeasonDetails(tmdbId: number, seasonNumber: number) {
  return tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${seasonNumber}`);
}

type TmdbFindByTvdb = {
  tv_results: TmdbSearchResult[];
  tv_episode_results?: Array<{
    show_id: number;
    name: string;
    season_number?: number;
    episode_number?: number;
  }>;
};

export async function findShowByShowTvdbId(tvdbId: number, signal?: AbortSignal) {
  const data = await tmdbFetch<TmdbFindByTvdb>(
    "/find/" + tvdbId,
    { external_source: "tvdb_id" },
    signal,
  );
  return data.tv_results[0] ?? null;
}

export async function findShowByEpisodeTvdbId(episodeTvdbId: number, signal?: AbortSignal) {
  const data = await tmdbFetch<TmdbFindByTvdb>(
    "/find/" + episodeTvdbId,
    { external_source: "tvdb_id" },
    signal,
  );

  const ep = data.tv_episode_results?.[0];
  if (!ep?.show_id) return null;

  const details = await getShowDetails(ep.show_id, signal);
  return {
    show: details,
    seasonNumber: ep.season_number ?? null,
    episodeNumber: ep.episode_number ?? null,
  };
}

export async function findByImdbId(imdbId: string, signal?: AbortSignal) {
  const data = await tmdbFetch<{ tv_results: TmdbSearchResult[] }>(
    "/find/" + imdbId,
    { external_source: "imdb_id" },
    signal,
  );
  return data.tv_results[0] ?? null;
}

function cacheKey(ids: {
  showTvdb?: number;
  episodeTvdb?: number;
  tvdb?: number;
  imdb?: string;
  title?: string;
}) {
  const showTvdb = ids.showTvdb ?? ids.tvdb;
  const { name, year } = ids.title ? parseTitleYear(ids.title) : { name: "" };
  return `${showTvdb ?? ""}|${ids.episodeTvdb ?? ""}|${ids.imdb ?? ""}|${name.toLowerCase()}|${year ?? ""}`;
}

export async function resolveShowFromExternalIds(
  ids: {
    tvdb?: number;
    showTvdb?: number;
    episodeTvdb?: number;
    imdb?: string;
    title?: string;
  },
  signal?: AbortSignal,
): Promise<TmdbSearchResult | null> {
  const key = cacheKey(ids);
  if (resolveCache.has(key)) {
    const cachedId = resolveCache.get(key);
    if (cachedId == null) return null;
    return getShowDetails(cachedId, signal);
  }

  const showTvdb = ids.showTvdb ?? ids.tvdb;
  const hadExternalId = Boolean(showTvdb || ids.episodeTvdb || ids.imdb);

  if (showTvdb) {
    const show = await findShowByShowTvdbId(showTvdb, signal);
    if (show) {
      resolveCache.set(key, show.id);
      return show;
    }
  }

  if (ids.episodeTvdb) {
    const hit = await findShowByEpisodeTvdbId(ids.episodeTvdb, signal);
    if (hit?.show) {
      resolveCache.set(key, hit.show.id);
      return hit.show;
    }
  }

  if (ids.imdb) {
    const show = await findByImdbId(ids.imdb, signal);
    if (show) {
      resolveCache.set(key, show.id);
      return show;
    }
  }

  if (hadExternalId) {
    resolveCache.set(key, null);
    return null;
  }

  resolveCache.set(key, null);
  return null;
}

export async function getEpisodeRuntime(
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  seasonCache: Map<string, TmdbSeason>,
): Promise<number | null> {
  const cacheKey = `${tmdbId}-${seasonNumber}`;
  let season = seasonCache.get(cacheKey);
  if (!season) {
    season = await getSeasonDetails(tmdbId, seasonNumber);
    seasonCache.set(cacheKey, season);
  }
  const ep = season.episodes.find((e) => e.episode_number === episodeNumber);
  return ep?.runtime ?? null;
}

export async function getUpcomingEpisodes(tmdbIds: number[]) {
  const episodes: Array<{
    tmdbShowId: number;
    showName: string;
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string;
    airDate: string;
  }> = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 14);

  for (const tmdbId of tmdbIds.slice(0, 20)) {
    try {
      const show = await getShowDetails(tmdbId);
      const season = await getSeasonDetails(tmdbId, show.number_of_seasons);
      for (const ep of season.episodes) {
        if (!ep.air_date) continue;
        const air = new Date(ep.air_date);
        if (air >= today && air <= limit) {
          episodes.push({
            tmdbShowId: tmdbId,
            showName: show.name,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            episodeName: ep.name,
            airDate: ep.air_date,
          });
        }
      }
    } catch {
    }
  }

  return episodes.sort(
    (a, b) => new Date(a.airDate).getTime() - new Date(b.airDate).getTime(),
  );
}
