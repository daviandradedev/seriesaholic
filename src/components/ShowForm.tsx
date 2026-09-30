"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { saveWasRejected } from "@/lib/login-redirect";

type EpisodeDraft = {
  episodeNumber: number;
  name: string;
  airDate: string;
  runtimeMinutes: string;
};

type SeasonDraft = {
  seasonNumber: number;
  name: string;
  episodes: EpisodeDraft[];
};

type ShowFormProps = {
  mode: "create" | "edit";
  showId?: string;
  initial?: {
    title: string;
    overview: string;
    posterPath: string;
    backdropPath: string;
    firstAirDate: string;
    genres: string;
    tmdbStatus: string;
    seasons: SeasonDraft[];
  };
};

function emptySeason(n: number, seasonName: string, episodeName: string): SeasonDraft {
  return {
    seasonNumber: n,
    name: seasonName,
    episodes: [{ episodeNumber: 1, name: episodeName, airDate: "", runtimeMinutes: "" }],
  };
}

export function ShowForm({ mode, showId, initial }: ShowFormProps) {
  const router = useRouter();
  const { t } = usePreferences();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [overview, setOverview] = useState(initial?.overview ?? "");
  const [posterPath, setPosterPath] = useState(initial?.posterPath ?? "");
  const [backdropPath, setBackdropPath] = useState(initial?.backdropPath ?? "");
  const [firstAirDate, setFirstAirDate] = useState(initial?.firstAirDate ?? "");
  const [genres, setGenres] = useState(initial?.genres ?? "");
  const [tmdbStatus, setTmdbStatus] = useState(
    initial?.tmdbStatus ?? "Returning Series",
  );
  const [seasons, setSeasons] = useState<SeasonDraft[]>(
    initial?.seasons?.length
      ? initial.seasons
      : [emptySeason(1, t("seasonName", { n: 1 }), t("episodeName", { n: 1 }))],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSeason(index: number, patch: Partial<SeasonDraft>) {
    setSeasons((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function updateEpisode(
    seasonIndex: number,
    episodeIndex: number,
    patch: Partial<EpisodeDraft>,
  ) {
    setSeasons((prev) =>
      prev.map((s, i) => {
        if (i !== seasonIndex) return s;
        return {
          ...s,
          episodes: s.episodes.map((ep, j) =>
            j === episodeIndex ? { ...ep, ...patch } : ep,
          ),
        };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title,
      overview: overview || null,
      posterPath: posterPath || null,
      backdropPath: backdropPath || null,
      firstAirDate: firstAirDate || null,
      genres: genres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      tmdbStatus: tmdbStatus || null,
      seasons: seasons.map((s) => ({
        seasonNumber: s.seasonNumber,
        name: s.name || null,
        episodes: s.episodes.map((ep) => ({
          episodeNumber: ep.episodeNumber,
          name: ep.name || null,
          airDate: ep.airDate || null,
          runtimeMinutes: ep.runtimeMinutes
            ? Number(ep.runtimeMinutes)
            : null,
        })),
      })),
    };

    try {
      const res = await fetch(
        mode === "create" ? "/api/shows" : `/api/shows/${showId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (saveWasRejected(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("saveFailed"));
      router.push(data.href ?? `/shows/${data.tmdbId ?? data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formTitleRequired")}</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formStatusShow")}</span>
          <select
            value={tmdbStatus}
            onChange={(e) => setTmdbStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          >
            <option value="Returning Series">{t("formReturningOption")}</option>
            <option value="Ended">{t("formEndedOption")}</option>
            <option value="Canceled">{t("formCanceledOption")}</option>
            <option value="In Production">{t("formInProductionOption")}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="text-zinc-400">{t("formOverview")}</span>
          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formPosterHint")}</span>
          <input
            value={posterPath}
            onChange={(e) => setPosterPath(e.target.value)}
            placeholder="/abc.jpg ou https://..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formBackdropHint")}</span>
          <input
            value={backdropPath}
            onChange={(e) => setBackdropPath(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formPremiere")}</span>
          <input
            type="date"
            value={firstAirDate}
            onChange={(e) => setFirstAirDate(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-zinc-400">{t("formGenres")}</span>
          <input
            value={genres}
            onChange={(e) => setGenres(e.target.value)}
            placeholder="Drama, Comedy"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("formSeasons")}</h2>
          <button
            type="button"
            onClick={() =>
              setSeasons((prev) => [
                ...prev,
                emptySeason(
                  prev.length + 1,
                  t("seasonName", { n: prev.length + 1 }),
                  t("episodeName", { n: 1 }),
                ),
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("formSeason")}
          </button>
        </div>

        {seasons.map((season, si) => (
          <div
            key={si}
            className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-zinc-500">{t("formNumber")}</span>
                <input
                  type="number"
                  min={1}
                  value={season.seasonNumber}
                  onChange={(e) =>
                    updateSeason(si, { seasonNumber: Number(e.target.value) })
                  }
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white"
                />
              </label>
              <label className="min-w-[200px] flex-1 space-y-1 text-sm">
                <span className="text-zinc-500">{t("formName")}</span>
                <input
                  value={season.name}
                  onChange={(e) => updateSeason(si, { name: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setSeasons((prev) => prev.filter((_, i) => i !== si))
                }
                className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {season.episodes.map((ep, ei) => (
                <div
                  key={ei}
                  className="grid grid-cols-2 gap-2 md:grid-cols-[70px_1fr_140px_100px_40px]"
                >
                  <input
                    type="number"
                    min={1}
                    value={ep.episodeNumber}
                    onChange={(e) =>
                      updateEpisode(si, ei, {
                        episodeNumber: Number(e.target.value),
                      })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                    placeholder="#"
                  />
                  <input
                    value={ep.name}
                    onChange={(e) =>
                      updateEpisode(si, ei, { name: e.target.value })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                    placeholder={t("formEpisodePlaceholder")}
                  />
                  <input
                    type="date"
                    value={ep.airDate}
                    onChange={(e) =>
                      updateEpisode(si, ei, { airDate: e.target.value })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                  />
                  <input
                    type="number"
                    min={0}
                    value={ep.runtimeMinutes}
                    onChange={(e) =>
                      updateEpisode(si, ei, { runtimeMinutes: e.target.value })
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                    placeholder="min"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateSeason(si, {
                        episodes: season.episodes.filter((_, j) => j !== ei),
                      })
                    }
                    className="rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateSeason(si, {
                    episodes: [
                      ...season.episodes,
                      {
                        episodeNumber: season.episodes.length + 1,
                        name: t("episodeName", { n: season.episodes.length + 1 }),
                        airDate: "",
                        runtimeMinutes: "",
                      },
                    ],
                  })
                }
                className="text-xs text-violet-400 hover:underline"
              >
                {t("formAddEpisodePlus")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={saving || !title.trim()}
        className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {saving ? t("formSaving") : mode === "create" ? t("createShow") : t("formSave")}
      </button>
    </form>
  );
}
