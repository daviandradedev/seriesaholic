"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, Star } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { posterUrl } from "@/lib/utils";

type CatalogCardProps = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  voteAverage: number | null;
  firstAirDate: string | null;
  category?: string;
  compatibilityScore?: number;
  matchingGenres?: string[];
  onAdd?: (tmdbId: number) => void;
  adding?: boolean;
};

export function CatalogCard({
  tmdbId,
  title,
  posterPath,
  voteAverage,
  firstAirDate,
  compatibilityScore,
  matchingGenres,
  onAdd,
  adding,
}: CatalogCardProps) {
  const { t } = usePreferences();
  const poster = posterUrl(posterPath, "w342");
  const year = firstAirDate?.slice(0, 4);

  return (
    <div className="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] transition-all hover:border-violet-500/30">
      <Link href={`/shows/${tmdbId}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 200px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600 text-xs">
              {t("noPoster")}
            </div>
          )}
          {compatibilityScore != null && compatibilityScore > 0 && (
            <div className="absolute left-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white">
              {t("match", { n: compatibilityScore })}
            </div>
          )}
          {voteAverage != null && voteAverage > 0 && (
            <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" />
              {voteAverage.toFixed(1)}
            </div>
          )}
        </div>
      </Link>
      <div className="p-3">
        <Link href={`/shows/${tmdbId}`}>
          <h3 className="truncate text-sm font-medium text-white hover:text-violet-300">
            {title}
          </h3>
        </Link>
        {year && <p className="text-xs text-zinc-500">{year}</p>}
        {matchingGenres && matchingGenres.length > 0 && (
          <p className="mt-0.5 truncate text-[10px] text-emerald-400/80">
            {matchingGenres.slice(0, 2).join(" · ")}
          </p>
        )}
        {onAdd && (
          <button
            type="button"
            disabled={adding}
            onClick={() => onAdd(tmdbId)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-violet-600/80 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {adding ? t("adding") : t("wantToWatch")}
          </button>
        )}
      </div>
    </div>
  );
}
