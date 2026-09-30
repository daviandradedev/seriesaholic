"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { ProgressBar } from "@/components/ProgressBar";
import { cn } from "@/lib/utils";
import { saveWasRejected } from "@/lib/login-redirect";

type Episode = {
  season_number: number;
  episode_number: number;
  name: string;
  air_date: string | null;
  watched: boolean;
};

type Season = {
  season_number: number;
  name: string;
  episodes: Episode[];
  watchedCount: number;
};

async function readWatchPatch(res: Response) {
  const body = await res.json().catch(() => null);
  if (!body || typeof body.watchedCount !== "number") return undefined;
  return {
    watchedCount: body.watchedCount as number,
    status: typeof body.status === "string" ? body.status : undefined,
  };
}

function seasonInProgress(season: Season) {
  return (
    season.episodes.length > 0 &&
    season.watchedCount > 0 &&
    season.watchedCount < season.episodes.length
  );
}

function initialOpenSeasons(seasons: Season[]) {
  return new Set(seasons.filter(seasonInProgress).map((s) => s.season_number));
}

export function EpisodeList({
  showId,
  tmdbId,
  seasons,
  onToggle,
}: {
  showId?: string;
  tmdbId?: number;
  seasons: Season[];
  onToggle: (patch?: { watchedCount: number; status?: string }) => void;
}) {
  const id = showId ?? String(tmdbId ?? "");
  const { t } = usePreferences();
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(() =>
    initialOpenSeasons(seasons),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [seasonBusy, setSeasonBusy] = useState<number | null>(null);
  const clickSeq = useRef(new Map<string, number>());

  function episodeWatched(ep: Episode) {
    const key = `${ep.season_number}-${ep.episode_number}`;
    return key in overrides ? overrides[key] : ep.watched;
  }

  function watchedCountOf(season: Season) {
    return season.episodes.filter((ep) => episodeWatched(ep)).length;
  }

  function clearOverrides(keys: string[]) {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of keys) {
        if (!(key in next)) continue;
        delete next[key];
        changed = true;
      }
      return changed ? next : prev;
    });
  }

  function clearOverride(key: string) {
    clearOverrides([key]);
  }

  async function toggleEpisode(
    seasonNumber: number,
    episodeNumber: number,
    episodeName: string,
    currentlyWatched: boolean,
  ) {
    const key = `${seasonNumber}-${episodeNumber}`;
    const nextWatched = !currentlyWatched;
    const seq = (clickSeq.current.get(key) ?? 0) + 1;
    clickSeq.current.set(key, seq);
    setOverrides((prev) => ({ ...prev, [key]: nextWatched }));
    try {
      const res = await fetch(`/api/shows/${id}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonNumber,
          episodeNumber,
          episodeName,
          watched: nextWatched,
        }),
      });
      if (clickSeq.current.get(key) !== seq) return;
      if (saveWasRejected(res) || !res.ok) {
        clearOverride(key);
        return;
      }
      onToggle(await readWatchPatch(res));
    } catch {
      if (clickSeq.current.get(key) === seq) clearOverride(key);
    }
  }

  async function markSeason(seasonNumber: number, watched: boolean) {
    const season = seasons.find((s) => s.season_number === seasonNumber);
    if (!season) return;
    const pending = season.episodes.filter((ep) => episodeWatched(ep) !== watched);
    if (pending.length === 0) return;

    setOverrides((prev) => {
      const next = { ...prev };
      for (const ep of pending) {
        next[`${ep.season_number}-${ep.episode_number}`] = watched;
      }
      return next;
    });
    const keys = pending.map((ep) => `${ep.season_number}-${ep.episode_number}`);
    setSeasonBusy(seasonNumber);
    try {
      const res = await fetch(`/api/shows/${id}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonNumber,
          watched,
          episodes: pending.map((ep) => ({
            episodeNumber: ep.episode_number,
            episodeName: ep.name,
          })),
        }),
      });
      if (saveWasRejected(res) || !res.ok) {
        clearOverrides(keys);
        return;
      }
      onToggle(await readWatchPatch(res));
    } catch {
      clearOverrides(keys);
    } finally {
      setSeasonBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {seasons.map((season) => {
        const isOpen = openSeasons.has(season.season_number);
        const total = season.episodes.length;
        const watchedCount = watchedCountOf(season);
        const progress = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
        const allWatched = total > 0 && watchedCount === total;
        const busy = seasonBusy === season.season_number;

        return (
          <div
            key={season.season_number}
            className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <button
                type="button"
                onClick={() => {
                  setOpenSeasons((prev) => {
                    const next = new Set(prev);
                    if (next.has(season.season_number)) next.delete(season.season_number);
                    else next.add(season.season_number);
                    return next;
                  });
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
                <span className="truncate font-medium text-white">
                  {season.name || t("seasonName", { n: season.season_number })}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    progress >= 100 ? "text-emerald-400" : "text-zinc-500",
                  )}
                >
                  {watchedCount}/{total}
                </span>
              </button>
              <button
                type="button"
                disabled={busy || total === 0}
                onClick={() => void markSeason(season.season_number, !allWatched)}
                className={cn(
                  "ml-2 shrink-0 rounded-md px-2 py-1 text-xs disabled:opacity-50",
                  allWatched
                    ? "text-zinc-400 hover:bg-white/5"
                    : "text-violet-400 hover:bg-violet-500/10",
                )}
              >
                {busy ? t("saving") : allWatched ? t("unmarkAll") : t("markAll")}
              </button>
            </div>

            {total > 0 && (
              <div className="px-4 pb-3">
                <ProgressBar value={progress} complete={progress >= 100} className="h-1" />
              </div>
            )}

            {isOpen && (
              <div className="border-t border-white/5">
                {season.episodes.map((ep) => {
                  const key = `${ep.season_number}-${ep.episode_number}`;
                  const watched = episodeWatched(ep);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        void toggleEpisode(
                          ep.season_number,
                          ep.episode_number,
                          ep.name,
                          watched,
                        )
                      }
                      className="flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.03]"
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          watched
                            ? progress >= 100
                              ? "border-emerald-500 bg-emerald-600"
                              : "border-violet-500 bg-violet-600"
                            : "border-zinc-600 bg-transparent",
                        )}
                      >
                        {watched && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">
                          {ep.episode_number}. {ep.name}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
