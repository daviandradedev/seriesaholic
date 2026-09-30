"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search as SearchIcon, Plus, Check } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { trackShow } from "@/lib/track-show";
import { posterUrl } from "@/lib/utils";

type SearchResult = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date: string | null;
  vote_average: number;
  tracked: boolean;
  status: string | null;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [requestQuery, setRequestQuery] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const { t } = usePreferences();

  useEffect(() => {
    if (query.length < 2) return;
    const current = query;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(current)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setRequestQuery(current);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const loading = query.length >= 2 && requestQuery !== query;
  const visibleResults = query.length < 2 || requestQuery !== query ? [] : results;

  async function addShow(tmdbId: number, inWatchlist = false) {
    setAdding(tmdbId);
    try {
      const saved = await trackShow(tmdbId, inWatchlist);
      if (!saved) return;
      setResults((prev) =>
        prev.map((r) =>
          r.id === tmdbId ? { ...r, tracked: true, status: inWatchlist ? "PLAN_TO_WATCH" : "WATCHING" } : r,
        ),
      );
    } catch {
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("searchTitle")}</h1>
        <p className="mt-1 text-zinc-400">{t("searchSubtitle")}</p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          placeholder="Breaking Bad, The Office..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
        />
      </div>

      {loading && <p className="text-sm text-zinc-500">{t("searching")}</p>}

      <div className="space-y-3">
        {visibleResults.map((show) => {
          const poster = posterUrl(show.poster_path, "w92");
          return (
            <div
              key={show.id}
              className="flex gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
            >
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                {poster ? (
                  <Image
                    src={poster}
                    alt={show.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/shows/${show.id}`} className="hover:text-violet-300">
                  <h3 className="font-semibold text-white">{show.name}</h3>
                </Link>
                {show.first_air_date && (
                  <p className="text-xs text-zinc-500">{show.first_air_date.slice(0, 4)}</p>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{show.overview}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {show.tracked ? (
                  <Link
                    href={`/shows/${show.id}`}
                    className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400"
                  >
                    <Check className="h-3 w-3" />
                    {t("inLibrary")}
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={adding === show.id}
                      onClick={() => addShow(show.id, false)}
                      className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      {t("add")}
                    </button>
                    <button
                      type="button"
                      disabled={adding === show.id}
                      onClick={() => addShow(show.id, true)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 disabled:opacity-50"
                    >
                      {t("wantToWatch")}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
