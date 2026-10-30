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
}): number | null {
  const total = input.totalEpisodes ?? 0;
  if (total > 0 && input.watchedCount >= total) return 0;
  const newlyAired =
    input.nextAirDate && input.today && input.nextAirDate <= input.today ? 1 : 0;
  if (input.unwatchedAiredCount != null) return input.unwatchedAiredCount + newlyAired;
  return total > 0 ? total - input.watchedCount : null;
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

export function sumRealMinutes(
  items: Array<{ runtimeMinutes: number | null | undefined }>,
): number {
  return items.reduce((sum, item) => {
    const m = item.runtimeMinutes;
    if (m == null || m <= 0) return sum;
    return sum + m;
  }, 0);
}
