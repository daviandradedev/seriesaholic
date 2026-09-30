"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Ban, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { EpisodeList } from "@/components/EpisodeList";
import { PageLoading } from "@/components/PageLoading";
import { usePreferences } from "@/components/Preferences";
import { ProgressBar } from "@/components/ProgressBar";
import { backdropUrl, cn, posterUrl } from "@/lib/utils";
import { saveWasRejected } from "@/lib/login-redirect";

type ShowData = {
  show: {
    id: string;
    tmdbId: number | null;
    title: string;
    overview: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    status: string;
    isCustom?: boolean;
    tmdbStatus?: string | null;
  };
  details: {
    number_of_seasons: number;
    number_of_episodes: number;
    vote_average: number;
    genres: { name: string }[];
    status?: string;
  };
  seasons: Array<{
    season_number: number;
    name: string;
    episodes: Array<{
      season_number: number;
      episode_number: number;
      name: string;
      air_date: string | null;
      watched: boolean;
    }>;
    watchedCount: number;
  }>;
  watchedCount: number;
  totalEpisodes: number;
};

export default function ShowPage() {
  const { t } = usePreferences();
  const params = useParams();
  const router = useRouter();
  const showKey = String(params.id);
  const [data, setData] = useState<ShowData | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/shows/${showKey}`);
      if (res.status === 404) {
        setError("not_found");
        setData(null);
        return;
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoadedKey(showKey);
    }
  }, [showKey, t]);

  const loading = loadedKey !== showKey;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addToLibrary() {
    setAdding(true);
    try {
      const res = await fetch(`/api/shows/${showKey}`, { method: "POST" });
      if (saveWasRejected(res)) return;
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function setStatus(status: "DROPPED" | "WATCHING" | "PLAN_TO_WATCH") {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/shows/${showKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (saveWasRejected(res)) return;
      await load();
      router.refresh();
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function removeShow() {
    if (!confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/shows/${showKey}`, { method: "DELETE" });
      if (saveWasRejected(res)) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t("deleteFailed"));
      router.push("/");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <PageLoading />;
  }

  if (error === "not_found") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <p className="text-zinc-400">{t("notInLibrary")}</p>
        {/^\d+$/.test(showKey) && (
          <button
            type="button"
            onClick={addToLibrary}
            disabled={adding}
            className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {adding ? t("adding") : t("addToLibrary")}
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-400">{error ?? t("unknownError")}</p>;
  }

  const poster = posterUrl(data.show.posterPath, "w342");
  const backdrop = backdropUrl(data.show.backdropPath, "w1280");
  const progress =
    data.totalEpisodes > 0
      ? Math.round((data.watchedCount / data.totalEpisodes) * 100)
      : 0;
  const isCompleted = data.show.status === "COMPLETED";
  const isDropped = data.show.status === "DROPPED";
  const canDrop = !isDropped;
  const editId = data.show.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/shows/${editId}/edit`}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5"
        >
          <Pencil className="h-4 w-4" />
          {t("edit")}
        </Link>
        <button
          type="button"
          onClick={removeShow}
          disabled={deleting}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? t("deleting") : t("delete")}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/5">
        {backdrop && (
          <div className="absolute inset-0">
            <Image
              src={backdrop}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
          </div>
        )}
        <div className="relative flex flex-col gap-4 p-6 md:flex-row">
          <div className="relative mx-auto h-48 w-32 shrink-0 overflow-hidden rounded-xl bg-zinc-900 md:mx-0">
            {poster && (
              <Image
                src={poster}
                alt={data.show.title}
                fill
                sizes="128px"
                className={cn(
                  "object-cover",
                  isCompleted && "opacity-90",
                  isDropped && "opacity-85",
                )}
              />
            )}
            {isCompleted && (
              <div className="absolute inset-0 bg-emerald-400/30 pointer-events-none" />
            )}
            {isDropped && (
              <div className="absolute inset-0 bg-red-500/30 pointer-events-none" />
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h1 className="text-2xl font-bold text-white md:text-3xl">
                {data.show.title}
              </h1>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("finishedLabel")}
                </span>
              )}
              {isDropped && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-300">
                  <Ban className="h-3.5 w-3.5" />
                  {t("droppedLabel")}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              {data.details.genres.map((g) => g.name).join(" · ")} ·{" "}
              {t("seasonsCount", { n: data.details.number_of_seasons })} ·{" "}
              {t("episodesCount", { n: data.details.number_of_episodes })}
            </p>
            <p className="mt-3 line-clamp-3 text-sm text-zinc-300">
              {data.show.overview}
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  {t("watchedOf", { watched: data.watchedCount, total: data.totalEpisodes })}
                </span>
                <span className={cn(progress >= 100 ? "text-emerald-400" : "text-violet-400")}>
                  {progress}%
                </span>
              </div>
              <ProgressBar value={progress} complete={progress >= 100} className="mt-2" />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
              {canDrop && (
                <button
                  type="button"
                  onClick={() => setStatus("DROPPED")}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Ban className="h-4 w-4" />
                  {updatingStatus ? t("saving") : t("dropShow")}
                </button>
              )}
              {isDropped && (
                <button
                  type="button"
                  onClick={() => setStatus("WATCHING")}
                  disabled={updatingStatus}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                >
                  {updatingStatus ? t("saving") : t("resumeWatching")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">{t("episodesHeading")}</h2>
        <EpisodeList
          showId={showKey}
          seasons={data.seasons}
          onToggle={(patch) => {
            if (!patch) return;
            setData((current) =>
              current
                ? {
                    ...current,
                    watchedCount: patch.watchedCount,
                    show: patch.status
                      ? { ...current.show, status: patch.status }
                      : current.show,
                  }
                : current,
            );
          }}
        />
      </section>
    </div>
  );
}
