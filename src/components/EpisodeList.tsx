"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { ModalDialog } from "@/components/ModalDialog";
import { usePreferences } from "@/components/Preferences";
import { ProgressBar } from "@/components/ProgressBar";
import { isEpisodeAired, localIsoDay } from "@/lib/domain-logic";
import { cn, formatDate } from "@/lib/utils";
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

function seasonInProgress(season: Season, today: string) {
  const aired = season.episodes.filter((ep) => isEpisodeAired(ep.air_date, today));
  if (aired.length === 0) return false;
  const watched = aired.filter((ep) => ep.watched).length;
  return watched > 0 && watched < aired.length;
}

function initialOpenSeasons(seasons: Season[], today: string) {
  return new Set(
    seasons.filter((season) => seasonInProgress(season, today)).map((s) => s.season_number),
  );
}

function episodeKey(ep: Episode) {
  return `${ep.season_number}-${ep.episode_number}`;
}

function comesBefore(ep: Episode, target: Episode) {
  return (
    ep.season_number < target.season_number ||
    (ep.season_number === target.season_number && ep.episode_number < target.episode_number)
  );
}

type PendingMark = { episode: Episode; previous: Episode[] };

export function EpisodeList({
  showId,
  tmdbId,
  seasons,
  onToggle,
  readOnly = false,
}: {
  showId?: string;
  tmdbId?: number;
  seasons: Season[];
  onToggle: (patch?: { watchedCount: number; status?: string }) => void;
  readOnly?: boolean;
}) {
  const id = showId ?? String(tmdbId ?? "");
  const { theme, language, t } = usePreferences();
  const light = theme === "light";
  const today = localIsoDay();
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(() =>
    initialOpenSeasons(seasons, today),
  );
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [seasonBusy, setSeasonBusy] = useState<number | null>(null);
  const [pendingMark, setPendingMark] = useState<PendingMark | null>(null);
  const clickSeq = useRef(new Map<string, number>());

  function episodeWatched(ep: Episode) {
    const key = episodeKey(ep);
    return key in overrides ? overrides[key] : ep.watched;
  }

  function unwatchedBefore(target: Episode) {
    if (target.season_number < 1) return [];
    return seasons
      .flatMap((season) => season.episodes)
      .filter(
        (ep) =>
          ep.season_number >= 1 &&
          isEpisodeAired(ep.air_date, today) &&
          !episodeWatched(ep) &&
          comesBefore(ep, target),
      );
  }

  function requestToggle(ep: Episode, watched: boolean) {
    if (!isEpisodeAired(ep.air_date, today)) return;
    const previous = watched ? [] : unwatchedBefore(ep);
    if (previous.length > 0) {
      setPendingMark({ episode: ep, previous });
      return;
    }
    void toggleEpisode(ep.season_number, ep.episode_number, ep.name, watched);
  }

  function markOnlyPending() {
    if (!pendingMark) return;
    const { episode } = pendingMark;
    setPendingMark(null);
    void toggleEpisode(episode.season_number, episode.episode_number, episode.name, false);
  }

  function markPendingWithPrevious() {
    if (!pendingMark) return;
    const { episode, previous } = pendingMark;
    setPendingMark(null);
    void saveEpisodes([...previous, episode], true);
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

  async function postSeason(seasonNumber: number, list: Episode[], watched: boolean) {
    try {
      const res = await fetch(`/api/shows/${id}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonNumber,
          watched,
          episodes: list.map((ep) => ({
            episodeNumber: ep.episode_number,
            episodeName: ep.name,
          })),
        }),
      });
      if (saveWasRejected(res) || !res.ok) return null;
      return { patch: await readWatchPatch(res) };
    } catch {
      return null;
    }
  }

  async function saveEpisodes(episodes: Episode[], watched: boolean) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const ep of episodes) next[episodeKey(ep)] = watched;
      return next;
    });
    const bySeason = new Map<number, Episode[]>();
    for (const ep of episodes) {
      bySeason.set(ep.season_number, [...(bySeason.get(ep.season_number) ?? []), ep]);
    }
    const batches = [...bySeason.entries()];
    let saved = 0;
    let patch: Awaited<ReturnType<typeof readWatchPatch>>;
    for (const [seasonNumber, list] of batches) {
      const result = await postSeason(seasonNumber, list, watched);
      if (!result) break;
      patch = result.patch;
      saved += 1;
    }
    clearOverrides(batches.slice(saved).flatMap(([, list]) => list.map(episodeKey)));
    if (saved > 0) onToggle(patch);
  }

  async function markSeason(seasonNumber: number, watched: boolean) {
    const season = seasons.find((s) => s.season_number === seasonNumber);
    if (!season) return;
    const pending = season.episodes.filter(
      (ep) => isEpisodeAired(ep.air_date, today) && episodeWatched(ep) !== watched,
    );
    if (pending.length === 0) return;
    setSeasonBusy(seasonNumber);
    try {
      await saveEpisodes(pending, watched);
    } finally {
      setSeasonBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p role="status" className="sr-only">
        {seasonBusy !== null ? t("saving") : ""}
      </p>
      {seasons.map((season) => {
        const isOpen = openSeasons.has(season.season_number);
        const airedEpisodes = season.episodes.filter((ep) => isEpisodeAired(ep.air_date, today));
        const total = airedEpisodes.length;
        const watchedCount = airedEpisodes.filter((ep) => episodeWatched(ep)).length;
        const progress = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
        const allWatched = total > 0 && watchedCount === total;
        const busy = seasonBusy === season.season_number;
        const hasUpcoming = season.episodes.some((ep) => !isEpisodeAired(ep.air_date, today));
        const seasonLabel = season.name || t("seasonName", { n: season.season_number });
        const seasonNameId = `season-${id}-${season.season_number}-name`;
        const episodesId = `season-${id}-${season.season_number}-episodes`;

        return (
          <div
            key={season.season_number}
            className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex w-full items-center justify-between px-4 py-3 hover:bg-white/[0.03]">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? episodesId : undefined}
                onClick={() => {
                  setOpenSeasons((prev) => {
                    const next = new Set(prev);
                    if (next.has(season.season_number)) next.delete(season.season_number);
                    else next.add(season.season_number);
                    return next;
                  });
                }}
                className="flex min-h-6 min-w-0 flex-1 items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                )}
                <span id={seasonNameId} className="truncate font-medium text-white">
                  {seasonLabel}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    total > 0 && progress >= 100 ? "text-emerald-400" : "text-zinc-500",
                  )}
                >
                  {total > 0
                    ? `${watchedCount}/${total}`
                    : hasUpcoming
                      ? t("episodeNotAiredYet")
                      : "0/0"}
                </span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  aria-describedby={seasonNameId}
                  disabled={busy || total === 0}
                  onClick={() => void markSeason(season.season_number, !allWatched)}
                  className={cn(
                    "ml-2 min-h-6 shrink-0 rounded-md px-2 py-1 text-xs disabled:opacity-50",
                    allWatched
                      ? "text-zinc-400 hover:bg-white/5"
                      : "text-violet-400 hover:bg-violet-500/10",
                  )}
                >
                  {busy ? t("saving") : allWatched ? t("unmarkAll") : t("markAll")}
                </button>
              )}
            </div>

            {total > 0 && (
              <div className="px-4 pb-3">
                <ProgressBar
                  value={progress}
                  complete={progress >= 100}
                  label={t("seasonProgressLabel", { season: seasonLabel })}
                  className="h-1"
                />
              </div>
            )}

            {isOpen && (
              <div id={episodesId} className="border-t border-white/5">
                {season.episodes.map((ep) => {
                  const key = episodeKey(ep);
                  const aired = isEpisodeAired(ep.air_date, today);
                  const label = `${ep.episode_number}. ${ep.name}`;
                  if (readOnly) {
                    return (
                      <p
                        key={key}
                        className="truncate border-b border-white/[0.03] px-4 py-2.5 text-sm text-white last:border-0"
                      >
                        {label}
                      </p>
                    );
                  }
                  if (!aired) {
                    const when = ep.air_date
                      ? formatDate(ep.air_date, language)
                      : t("episodeNotAiredYet");
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={`${label}. ${t("episodeNotAiredYet")}`}
                        className="flex w-full cursor-not-allowed items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 text-left opacity-55 last:border-0"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-600 bg-transparent"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
                          {label}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">{when}</span>
                      </button>
                    );
                  }
                  const watched = episodeWatched(ep);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={watched}
                      onClick={() => requestToggle(ep, watched)}
                      className="flex w-full items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.03] focus-visible:-outline-offset-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          watched
                            ? progress >= 100
                              ? "border-emerald-500 bg-emerald-600"
                              : "border-violet-500 bg-violet-600"
                            : "border-zinc-500 bg-transparent",
                        )}
                      >
                        {watched && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="block min-w-0 flex-1 truncate text-sm text-white">
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {pendingMark && (
        <ModalDialog
          labelledBy="mark-previous-title"
          describedBy="mark-previous-body"
          lightDismiss
          onClose={() => setPendingMark(null)}
          className="max-w-md"
        >
          <h2 id="mark-previous-title" className="text-lg font-semibold">
            {t("markPreviousTitle")}
          </h2>
          <p
            id="mark-previous-body"
            className={light ? "mt-2 text-sm text-zinc-600" : "mt-2 text-sm text-zinc-400"}
          >
            {t("markPreviousBody", { n: pendingMark.previous.length })}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingMark(null)}
              className={
                light
                  ? "rounded-lg px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
                  : "rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-white/5"
              }
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={markOnlyPending}
              className={
                light
                  ? "rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
                  : "rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
              }
            >
              {t("markOnlyThis")}
            </button>
            <button
              type="button"
              onClick={markPendingWithPrevious}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              {t("markPreviousConfirm")}
            </button>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
