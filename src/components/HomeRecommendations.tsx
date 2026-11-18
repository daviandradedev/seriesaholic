"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CatalogCard } from "@/components/CatalogCard";
import { usePreferences } from "@/components/Preferences";

type Recommendation = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number | null;
  firstAirDate: string | null;
  compatibilityScore: number;
  matchingGenres: string[];
};

export function HomeRecommendations() {
  const [shows, setShows] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = usePreferences();

  async function load() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations?limit=10");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || t("recommendError"));
      setShows(data.shows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("recommendError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="home-recommendations-title" className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div>
            <h2 id="home-recommendations-title" className="text-lg font-semibold text-white">{t("forYou")}</h2>
            <p className="mt-1 text-sm text-zinc-400">{t("forYouBody")}</p>
          </div>
        </div>
        {shows == null ? (
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? t("calculating") : t("seeRecommendations")}
          </button>
        ) : (
          <Link href="/discover" className="inline-flex min-h-6 items-center text-sm text-emerald-400 hover:underline">
            {t("seeAll")}
          </Link>
        )}
      </div>

      <p role="status" className="sr-only">
        {loading ? t("calculating") : ""}
      </p>

      {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}

      {shows?.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">{t("noRecommendations")}</p>
      ) : null}

      {shows && shows.length > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shows.map((show) => (
            <li key={show.tmdbId}>
              <CatalogCard {...show} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
