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

export function isShowFullyWatched(watchedCount: number, totalEpisodes: number) {
  return totalEpisodes > 0 && watchedCount >= totalEpisodes;
}

export function isFinishedQueueShow(input: {
  status?: LibraryStatus;
  watchedCount: number;
  totalEpisodes?: number | null;
  unwatchedAiredCount?: number | null;
  tmdbStatus?: string | null | undefined;
}): boolean {
  if (input.watchedCount <= 0) return false;
  if (input.status === "COMPLETED") return true;

  const ended = isShowEnded(input.tmdbStatus);
  if (!ended) return false;

  const catalogComplete =
    input.totalEpisodes != null &&
    input.totalEpisodes > 0 &&
    input.watchedCount >= input.totalEpisodes;
  if (catalogComplete) return true;

  if (input.unwatchedAiredCount === 0) {
    if (
      input.totalEpisodes != null &&
      input.totalEpisodes > 0 &&
      input.watchedCount < input.totalEpisodes
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function classifyShowQueueBucket(input: {
  isDropped: boolean;
  watchedCount: number;
  unwatchedAiredCount: number;
  recentUnwatchedCount: number;
  watchedRecently: boolean;
  tmdbStatus: string | null | undefined;
  inWatchlist?: boolean;
  totalEpisodes?: number;
  status?: LibraryStatus;
}): QueueBucket | null {
  if (input.isDropped) return "dropped";
  if (input.watchedCount <= 0) {
    return input.inWatchlist ? "notStarted" : null;
  }

  if (
    isFinishedQueueShow({
      status: input.status,
      watchedCount: input.watchedCount,
      totalEpisodes: input.totalEpisodes,
      unwatchedAiredCount: input.unwatchedAiredCount,
      tmdbStatus: input.tmdbStatus,
    })
  ) {
    return "finished";
  }

  const fullyWatchedTotal =
    input.totalEpisodes != null &&
    isShowFullyWatched(input.watchedCount, input.totalEpisodes);

  if (fullyWatchedTotal) {
    if (isShowEnded(input.tmdbStatus)) return "finished";
    return "upToDate";
  }

  if (input.unwatchedAiredCount === 0) {
    return "upToDate";
  }

  if (input.unwatchedAiredCount > 0) {
    if (
      isShowEnded(input.tmdbStatus) &&
      input.totalEpisodes != null &&
      input.totalEpisodes > 0 &&
      input.watchedCount >= input.totalEpisodes
    ) {
      return "finished";
    }
    if (input.watchedRecently) return "watchNext";
    return "backlog";
  }

  return "upToDate";
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

export function classifyShowQueueBucketFromLibrary(input: {
  isDropped: boolean;
  watchedCount: number;
  watchedRecently: boolean;
  status: LibraryStatus;
  tmdbStatus: string | null | undefined;
  inWatchlist?: boolean;
  totalEpisodes?: number;
  unwatchedAiredCount?: number | null;
}): QueueBucket | null {
  if (input.isDropped || input.status === "DROPPED") return "dropped";

  if (input.watchedCount <= 0) {
    return input.inWatchlist ? "notStarted" : null;
  }

  if (
    isFinishedQueueShow({
      status: input.status,
      watchedCount: input.watchedCount,
      totalEpisodes: input.totalEpisodes,
      unwatchedAiredCount: input.unwatchedAiredCount,
      tmdbStatus: input.tmdbStatus,
    })
  ) {
    return "finished";
  }

  const fullyWatched =
    input.totalEpisodes != null &&
    isShowFullyWatched(input.watchedCount, input.totalEpisodes);

  if (fullyWatched && input.watchedCount > 0) {
    if (isShowEnded(input.tmdbStatus)) return "finished";
    return "upToDate";
  }

  if (input.unwatchedAiredCount != null) {
    if (input.unwatchedAiredCount === 0 && input.watchedCount > 0) {
      return "upToDate";
    }
    return classifyShowQueueBucket({
      isDropped: false,
      watchedCount: input.watchedCount,
      unwatchedAiredCount: input.unwatchedAiredCount,
      recentUnwatchedCount: 0,
      watchedRecently: input.watchedRecently,
      tmdbStatus: input.tmdbStatus,
      inWatchlist: input.inWatchlist,
      totalEpisodes: input.totalEpisodes,
      status: input.status,
    });
  }

  if (
    input.totalEpisodes != null &&
    isShowFullyWatched(input.watchedCount, input.totalEpisodes)
  ) {
    if (isShowEnded(input.tmdbStatus) || input.status === "COMPLETED") {
      return "finished";
    }
    return "upToDate";
  }

  if (
    isShowEnded(input.tmdbStatus) &&
    input.totalEpisodes != null &&
    input.watchedCount < input.totalEpisodes
  ) {
    if (input.watchedRecently) return "watchNext";
    return "backlog";
  }

  if (isShowEnded(input.tmdbStatus) && input.watchedCount > 0) {
    if (
      input.totalEpisodes != null &&
      input.watchedCount < input.totalEpisodes
    ) {
      return "backlog";
    }
    if (
      input.totalEpisodes != null &&
      input.watchedCount >= input.totalEpisodes
    ) {
      return "finished";
    }
    return "upToDate";
  }

  if (isShowInProduction(input.tmdbStatus)) {
    return "upToDate";
  }

  return "upToDate";
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
