"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Home, RefreshCw, Sparkles } from "lucide-react";
import { CatalogCard } from "@/components/CatalogCard";
import { PageLoading } from "@/components/PageLoading";
import { usePreferences } from "@/components/Preferences";
import { numberLocale } from "@/lib/copy";
import { trackShow } from "@/lib/track-show";
import { cn } from "@/lib/utils";

type CatalogShow = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number | null;
  firstAirDate: string | null;
  category: string;
  compatibilityScore?: number;
  matchingGenres?: string[];
};

type CatalogStats = {
  total: number;
  categories: Array<{ category: string; count: number }>;
};

type TasteProfile = {
  topGenres: string[];
  totalWeightedEpisodes: number;
};

const TABS = [
  { key: "for_you", label: "forYou" },
  { key: "", label: "tabAll" },
  { key: "trending", label: "tabTrending" },
  { key: "popular", label: "tabPopular" },
  { key: "top_rated", label: "tabTop" },
] as const;

export function DiscoverCatalog({ signedIn }: { signedIn: boolean }) {
  const [shows, setShows] = useState<CatalogShow[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [profile, setProfile] = useState<TasteProfile | null>(null);
  const [category, setCategory] = useState(signedIn ? "for_you" : "");
  const [loadedCategory, setLoadedCategory] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language, t } = usePreferences();
  const tabs = TABS.filter((tab) => signedIn || tab.key !== "for_you");
  const activeTab = tabs.find((tab) => tab.key === category) ?? TABS[1];
  const canSync = signedIn && category !== "for_you";

  const load = useCallback(async (cat: string) => {
    setError(null);
    try {
      if (cat === "for_you") {
        const res = await fetch("/api/recommendations?limit=48");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setShows(data.shows ?? []);
        setProfile(data.profile ?? null);
        setStats(null);
        return;
      }

      const params = new URLSearchParams({ limit: "48" });
      if (cat) params.set("category", cat);
      const res = await fetch(`/api/catalog?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShows(data.shows ?? []);
      setStats(data.stats ?? null);
      setProfile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoadedCategory(cat);
    }
  }, [t]);

  const loading = loadedCategory !== category;

  useEffect(() => {
    const cat = category;
    const timer = window.setTimeout(() => {
      void load(cat);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [category, load]);

  async function syncCatalog() {
    setSyncing(true);
    try {
      await fetch("/api/catalog", { method: "POST" });
      await load(category);
    } finally {
      setSyncing(false);
    }
  }

  async function addShow(tmdbId: number) {
    setAdding(tmdbId);
    try {
      const saved = await trackShow(tmdbId, true);
      if (!saved) return;
      setShows((prev) => prev.filter((s) => s.tmdbId !== tmdbId));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("addError");
      setError(message === "ADD_FAILED" ? t("addError") : message);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-violet-400" />
            <h1 className="text-2xl font-bold text-white">{t("discoverTitle")}</h1>
          </div>
          <p className="mt-1 text-zinc-400">
            {category === "for_you" && profile?.topGenres.length
              ? t("discoverBased", { genres: profile.topGenres.slice(0, 3).join(", ") })
              : stats
                ? t("discoverCatalogCount", { total: stats.total.toLocaleString(numberLocale(language)) })
                : t("discoverFallback")}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
          >
            <Home className="h-4 w-4" />
            {t("home")}
          </Link>
          {canSync && (
            <button
              type="button"
              onClick={syncCatalog}
              disabled={syncing}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? t("syncing") : t("refreshCatalog")}
            </button>
          )}
        </div>
      </div>

      <div role="tablist" aria-label={t("discoverCategories")} className="flex flex-wrap gap-2 pb-1">
        {tabs.map((tab) => {
          const selected = category === tab.key;
          return (
            <button
              key={tab.key || "all"}
              id={tabId(tab.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="discover-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setCategory(tab.key)}
              onKeyDown={moveTabFocus}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors",
                selected
                  ? tab.key === "for_you"
                    ? "bg-emerald-700 text-white"
                    : "bg-violet-600 text-white"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white",
              )}
            >
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div role="tabpanel" id="discover-panel" aria-labelledby={tabId(activeTab.key)}>
        <h2 className="sr-only">{t(activeTab.label)}</h2>
        {loading ? (
          <PageLoading />
        ) : shows.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center">
            <p className="text-zinc-400">
              {category === "for_you" ? t("discoverEmptyPersonal") : t("discoverEmpty")}
            </p>
            {canSync && (
              <button
                type="button"
                onClick={syncCatalog}
                className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700"
              >
                {t("fillCatalog")}
              </button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {shows.map((show) => (
              <li key={show.tmdbId}>
                <CatalogCard
                  {...show}
                  onAdd={addShow}
                  adding={adding === show.tmdbId}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function tabId(key: string) {
  return `discover-tab-${key || "all"}`;
}

function moveTabFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
  const tabs = Array.from(
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
  );
  const index = tabs.indexOf(event.currentTarget);
  const targets: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowLeft: index - 1,
    Home: 0,
    End: tabs.length - 1,
  };
  const target = targets[event.key];
  if (target === undefined) return;
  event.preventDefault();
  tabs[(target + tabs.length) % tabs.length]?.focus();
}
