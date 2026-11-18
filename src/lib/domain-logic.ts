export type UserTasteProfile = {
  genreWeights: Record<string, number>;
  topGenres: string[];
  totalWeightedEpisodes: number;
};

export type QueueBucket =
  | "watchNext"
  | "backlog"
  | "upToDate"
  | "notStarted"
  | "finished"
  | "dropped";

export function scoreShowCompatibility(
  showGenres: string[],
  profile: UserTasteProfile,
): { score: number; matching: string[] } {
  if (showGenres.length === 0 || Object.keys(profile.genreWeights).length === 0) {
    return { score: 0, matching: [] };
  }

  const maxWeight = Math.max(...Object.values(profile.genreWeights), 1);
  let score = 0;
  const matching: string[] = [];

  for (const genre of showGenres) {
    const w = profile.genreWeights[genre];
    if (w) {
      score += w / maxWeight;
      matching.push(genre);
    }
  }

  const normalized = score / showGenres.length;
  return { score: Math.round(normalized * 100), matching };
}

export function buildGenreWeights(
  shows: Array<{ genres: string[]; episodeCount: number }>,
): UserTasteProfile {
  const genreWeights = new Map<string, number>();
  let totalWeightedEpisodes = 0;

  for (const show of shows) {
    const weight = show.episodeCount > 0 ? show.episodeCount : 1;
    totalWeightedEpisodes += weight;
    if (show.genres.length === 0) continue;

    const share = weight / show.genres.length;
    for (const genre of show.genres) {
      genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + share);
    }
  }

  const sorted = [...genreWeights.entries()].sort((a, b) => b[1] - a[1]);
  return {
    genreWeights: Object.fromEntries(genreWeights),
    topGenres: sorted.slice(0, 5).map(([g]) => g),
    totalWeightedEpisodes,
  };
}

export type LibraryStatus =
  | "WATCHING"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED"
  | "PLAN_TO_WATCH";

export function inferLibraryStatus(input: {
  watchedCount: number;
  totalEpisodes: number;
  tmdbStatus?: string | null;
  currentStatus?: LibraryStatus;
}): LibraryStatus {
  if (input.currentStatus === "DROPPED" || input.currentStatus === "ON_HOLD") {
    return input.currentStatus;
  }
  if (input.watchedCount <= 0) return "PLAN_TO_WATCH";
  if (
    input.totalEpisodes > 0 &&
    input.watchedCount >= input.totalEpisodes &&
    isShowEnded(input.tmdbStatus)
  ) {
    return "COMPLETED";
  }
  return "WATCHING";
}

export function isShowInProduction(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s.includes("returning") ||
    s.includes("production") ||
    s.includes("pilot") ||
    s.includes("em exibição") ||
    s.includes("in production")
  );
}

export function isShowEnded(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s.includes("ended") ||
    s.includes("canceled") ||
    s.includes("cancelled") ||
    s.includes("encerrada") ||
    s.includes("cancelada")
  );
}

export function pendingAiredEpisodes(input: {
  watchedCount: number;
  totalEpisodes?: number | null;
  unwatchedAiredCount?: number | null;
  nextAirDate?: string | null;
  today?: string;
  tmdbStatus?: string | null;
}): number | null {
  const total = input.totalEpisodes ?? 0;
  const catalogComplete = total > 0 && input.watchedCount >= total;
  if (catalogComplete && isShowEnded(input.tmdbStatus)) return 0;

  const newlyAired =
    input.nextAirDate && input.today && input.nextAirDate <= input.today ? 1 : 0;
  if (input.unwatchedAiredCount != null) {
    return input.unwatchedAiredCount + (input.unwatchedAiredCount === 0 ? newlyAired : 0);
  }
  if (catalogComplete) return newlyAired;
  if (total > 0) return total - input.watchedCount;
  return newlyAired > 0 ? newlyAired : null;
}

export function classifyShowQueueBucket(input: {
  isDropped: boolean;
  watchedCount: number;
  watchedRecently: boolean;
  tmdbStatus: string | null | undefined;
  status?: LibraryStatus;
  inWatchlist?: boolean;
  totalEpisodes?: number | null;
  unwatchedAiredCount?: number | null;
  nextAirDate?: string | null;
  today?: string;
}): QueueBucket | null {
  if (input.isDropped || input.status === "DROPPED") return "dropped";
  if (input.watchedCount <= 0) return input.inWatchlist ? "notStarted" : null;
  if (input.status === "COMPLETED") return "finished";

  const pending = pendingAiredEpisodes(input);
  if (pending == null) return "upToDate";
  if (pending > 0) return input.watchedRecently ? "watchNext" : "backlog";
  return isShowEnded(input.tmdbStatus) ? "finished" : "upToDate";
}

export function recentlyAddedShows<T extends { createdAt: string }>(
  shows: T[],
  now = Date.now(),
  days = 30,
): T[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return shows
    .filter((show) => Date.parse(show.createdAt) >= cutoff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function libraryStatusFromQueueBucket(
  bucket: QueueBucket,
  currentStatus: LibraryStatus,
): LibraryStatus | null {
  if (currentStatus === "DROPPED" || currentStatus === "ON_HOLD") return null;
  if (bucket === "notStarted") return "PLAN_TO_WATCH";
  if (bucket === "finished") return "COMPLETED";
  if (bucket === "watchNext" || bucket === "backlog" || bucket === "upToDate") {
    return "WATCHING";
  }
  return null;
}

export function catchUpEpisodesPerWeek(episodesInLast60Days: number): number {
  return Math.round((episodesInLast60Days / (60 / 7)) * 100) / 100;
}

export function isRegularSeason(seasonNumber: number) {
  return seasonNumber >= 1;
}

/** Calendar day in local time as YYYY-MM-DD. */
export function localIsoDay(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD air date as a local calendar day (never via Date("YYYY-MM-DD")). */
export function parseCalendarDay(isoDay: string): Date {
  const [y, m, d] = isoDay.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * An episode is watchable once it has aired.
 * Missing air dates stay markable (custom shows); future dates stay locked until launch day.
 * Compare civil dates as strings — `new Date("YYYY-MM-DD")` is UTC and shifts a day behind in Brazil.
 */
export function isEpisodeAired(
  airDate: string | null | undefined,
  today: string = localIsoDay(),
): boolean {
  if (!airDate) return true;
  return airDate.slice(0, 10) <= today;
}

export function airedWatchProgress(
  episodes: Array<{
    air_date?: string | null;
    airDate?: string | null;
    watched: boolean;
  }>,
  today: string = localIsoDay(),
): { airedTotal: number; airedWatched: number; percent: number } {
  let airedTotal = 0;
  let airedWatched = 0;
  for (const ep of episodes) {
    if (!isEpisodeAired(ep.air_date ?? ep.airDate, today)) continue;
    airedTotal += 1;
    if (ep.watched) airedWatched += 1;
  }
  return {
    airedTotal,
    airedWatched,
    percent:
      airedTotal === 0 ? 0 : Math.round((airedWatched / airedTotal) * 100),
  };
}

export function sumRealMinutes(
  items: Array<{ runtimeMinutes: number | null | undefined }>,
): number {
  return items.reduce((sum, item) => {
    const m = item.runtimeMinutes;
    if (m == null || m <= 0) return sum;
    return sum + m;
  }, 0);
}
