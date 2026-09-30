"use client";

import Image from "next/image";
import Link from "next/link";
import { usePreferences } from "@/components/Preferences";
import { posterUrl } from "@/lib/utils";

type ImportShowItem = {
  tmdbId: number | null;
  title: string;
  posterPath: string | null;
  episodesAdded: number;
  isNew: boolean;
};

export function ImportShowGrid({ shows }: { shows: ImportShowItem[] }) {
  const { t } = usePreferences();
  if (shows.length === 0) {
    return (
      <p className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-zinc-500">
        {t("noNewShows")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {shows.map((show) => {
        const poster = posterUrl(show.posterPath, "w342");
        const inner = (
          <>
            <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
              {poster ? (
                <Image
                  src={poster}
                  alt={show.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 200px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                  {t("noPoster")}
                </div>
              )}
              {show.isNew && (
                <span className="absolute left-2 top-2 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
                  Nova
                </span>
              )}
            </div>
            <div className="p-3">
              <h3 className="truncate text-sm font-medium text-white">{show.title}</h3>
              {show.episodesAdded > 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  {t("episodesAddedCount", { n: show.episodesAdded })}
                </p>
              )}
            </div>
          </>
        );

        if (show.tmdbId) {
          return (
            <Link
              key={`${show.tmdbId}-${show.title}`}
              href={`/shows/${show.tmdbId}`}
              className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] transition-all hover:border-violet-500/30"
            >
              {inner}
            </Link>
          );
        }

        return (
          <div
            key={show.title}
            className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03]"
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
