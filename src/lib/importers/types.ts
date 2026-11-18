export type ImportAction = "history" | "watchlist" | "ratings" | "dropped";

export type ImportItem = {
  action: ImportAction;
  type: "show" | "episode" | "movie";
  ids: {
    tvdb?: number;
    showTvdb?: number;
    episodeTvdb?: number;
    imdb?: string;
    tmdb?: number;
  };
  title?: string;
  season?: number;
  episode?: number;
  watchedAt?: string;
  rating?: number;
};

export type ImportResult = {
  items: ImportItem[];
  format: "gdpr" | "liberator" | "json" | "unknown";
  filesProcessed: string[];
};

export type ImportLogShowEntry = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  episodesAdded: number;
  isNew: boolean;
};

export type ImportStats = {
  showsAdded: number;
  showsUpdated: number;
  episodesAdded: number;
  episodesSkipped: number;
  errors: number;
  errorMessages: string[];
  addedShows: ImportLogShowEntry[];
  failures: ImportFailureGroup[];
};

export type ImportFailedEpisode = {
  season: number;
  episode: number;
  watchedAt?: string;
  episodeTvdb?: number;
  line: string;
};

export type ImportFailureGroup = {
  id: string;
  groupKey: string;
  title: string;
  message: string;
  reason: "show_not_found" | "episode_error" | "watchlist_not_found";
  ids: ImportItem["ids"];
  episodes: ImportFailedEpisode[];
  resolved?: boolean;
};

export type ImportProgressPhase =
  | "parsing"
  | "episodes"
  | "watchlist"
  | "dropped"
  | "status"
  | "complete";

export type ImportProgressEvent = {
  phase: ImportProgressPhase;
  current: number;
  total: number;
  label?: string;
};
