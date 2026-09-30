"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Link2, Plus, Search, CheckCircle2, Loader2 } from "lucide-react";
import type { ImportFailureGroup } from "@/lib/importers/types";
import { posterUrl } from "@/lib/utils";
import { usePreferences } from "@/components/Preferences";
import { saveWasRejected } from "@/lib/login-redirect";

type LibraryHit = {
  id: string;
  title: string;
  posterPath: string | null;
  href: string;
};

type TmdbHit = {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date?: string;
  tracked?: boolean;
};

type Props = {
  importLogId: string;
  initialFailures: ImportFailureGroup[];
};

export function ImportFailureResolver({ importLogId, initialFailures }: Props) {
  const { t } = usePreferences();
  const router = useRouter();
  const [failures, setFailures] = useState(initialFailures);
  const [failuresSource, setFailuresSource] = useState(initialFailures);
  if (initialFailures !== failuresSource) {
    setFailuresSource(initialFailures);
    setFailures(initialFailures);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [libraryHits, setLibraryHits] = useState<LibraryHit[]>([]);
  const [tmdbHits, setTmdbHits] = useState<TmdbHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const unresolved = failures.filter((f) => !f.resolved);
  const queryReady = query.trim().length > 0;
  const visibleLibraryHits = queryReady ? libraryHits : [];
  const visibleTmdbHits = queryReady ? tmdbHits : [];

  useEffect(() => {
    if (!openId) return;
    const q = query.trim();
    if (q.length < 1) return;

    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const [libRes, tmdbRes] = await Promise.all([
          fetch(`/api/shows?q=${encodeURIComponent(q)}`),
          fetch(`/api/search?q=${encodeURIComponent(q)}`),
        ]);
        const libData = await libRes.json();
        const tmdbData = await tmdbRes.json();
        setLibraryHits(
          (libData.shows as LibraryHit[] | undefined)?.slice(0, 8) ?? [],
        );
        setTmdbHits((tmdbData.results as TmdbHit[] | undefined)?.slice(0, 6) ?? []);
      } catch {
        setError(t("searchFailed"));
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, openId, t]);

  function openResolver(failure: ImportFailureGroup) {
    setOpenId(failure.id);
    setQuery(failure.title);
    setError(null);
  }

  async function resolve(
    failure: ImportFailureGroup,
    body: Record<string, unknown>,
  ) {
    setBusyId(failure.id);
    setError(null);
    try {
      const res = await fetch("/api/import/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importLogId,
          failureId: failure.id,
          ...body,
        }),
      });
      if (saveWasRejected(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("resolveError"));

      setFailures((prev) =>
        prev.map((f) => (f.id === failure.id ? { ...f, resolved: true } : f)),
      );
      setOpenId(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("resolveError"));
    } finally {
      setBusyId(null);
    }
  }

  if (failures.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {t("failuresTitle", { n: unresolved.length })}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {t("failuresBody")}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {failures.map((failure) => {
          const isOpen = openId === failure.id;
          const isBusy = busyId === failure.id || (pending && busyId === failure.id);

          return (
            <li
              key={failure.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{failure.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">{failure.message}</p>
                  {failure.resolved && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Resolvida
                    </p>
                  )}
                </div>
                {!failure.resolved && (
                  <button
                    type="button"
                    onClick={() =>
                      isOpen ? setOpenId(null) : openResolver(failure)
                    }
                    disabled={isBusy}
                    className="shrink-0 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 hover:bg-violet-500/20 disabled:opacity-50"
                  >
                    {t("assimilatePrompt")}
                  </button>
                )}
              </div>

              {failure.episodes.length > 0 && (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-white/5 pt-3 text-xs text-zinc-500">
                  {failure.episodes.map((ep) => (
                    <li key={`${ep.season}-${ep.episode}`}>{ep.line}</li>
                  ))}
                </ul>
              )}

              {isOpen && !failure.resolved && (
                <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
                  <label className="block text-sm text-zinc-300">
                    {t("searchShow")}
                    <div className="relative mt-1.5">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t("searchPlaceholderShow")}
                        className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-violet-500/50"
                      />
                    </div>
                  </label>

                  {queryReady && searching && (
                    <p className="flex items-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("searching")}
                    </p>
                  )}

                  {visibleLibraryHits.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {t("linkEpisodes")}
                      </p>
                      <ul className="space-y-2">
                        {visibleLibraryHits.map((hit) => (
                          <li
                            key={hit.id}
                            className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2"
                          >
                            {posterUrl(hit.posterPath, "w92") ? (
                              <Image
                                src={posterUrl(hit.posterPath, "w92")!}
                                alt=""
                                width={32}
                                height={48}
                                className="h-12 w-8 rounded object-cover bg-zinc-800"
                              />
                            ) : (
                              <div className="h-12 w-8 rounded bg-zinc-800" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">{hit.title}</p>
                              <Link
                                href={hit.href}
                                className="text-xs text-zinc-500 hover:text-violet-300"
                              >
                                {t("openShow")}
                              </Link>
                            </div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void resolve(failure, {
                                  mode: "link",
                                  showId: hit.id,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {t("link")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {visibleTmdbHits.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {t("onTmdb")}
                      </p>
                      <ul className="space-y-2">
                        {visibleTmdbHits.map((hit) => (
                          <li
                            key={hit.id}
                            className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2"
                          >
                            {posterUrl(hit.poster_path, "w92") ? (
                              <Image
                                src={posterUrl(hit.poster_path, "w92")!}
                                alt=""
                                width={32}
                                height={48}
                                className="h-12 w-8 rounded object-cover bg-zinc-800"
                              />
                            ) : (
                              <div className="h-12 w-8 rounded bg-zinc-800" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white">{hit.name}</p>
                              <p className="text-xs text-zinc-500">
                                {hit.first_air_date?.slice(0, 4) ?? "—"}
                                {hit.tracked ? ` · ${t("alreadyInLibrary")}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void resolve(failure, {
                                  mode: "tmdb",
                                  tmdbId: hit.id,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {t("useThis")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                    <button
                      type="button"
                      disabled={isBusy || !query.trim()}
                      onClick={() =>
                        void resolve(failure, {
                          mode: "create",
                          title: query.trim() || failure.title,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.08] disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      {t("createAndSave")}
                    </button>
                  </div>

                  {isBusy && (
                    <p className="flex items-center gap-2 text-xs text-violet-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("savingEpisodes")}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
