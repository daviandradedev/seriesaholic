"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { usePreferences } from "@/components/Preferences";
import { posterUrl, cn } from "@/lib/utils";
import type { WatchQueueShow } from "@/lib/watch-queue";
import type { ShowStatus } from "@prisma/client";

export const HOME_QUEUE_PREVIEW = 12;
export const HOME_FINISHED_PREVIEW = HOME_QUEUE_PREVIEW;

const statusOverlay: Partial<Record<ShowStatus, string>> = {
  COMPLETED: "bg-emerald-400/30",
  DROPPED: "bg-red-500/30",
};

function WatchQueueCard({
  show,
  priority = false,
}: {
  show: WatchQueueShow;
  priority?: boolean;
}) {
  const { t } = usePreferences();
  const poster = posterUrl(show.posterPath, "w342");
  const overlay =
    show.status === "DROPPED"
      ? statusOverlay.DROPPED
      : show.status === "COMPLETED"
        ? statusOverlay.COMPLETED
        : undefined;
  const isComplete = show.progress >= 100 || show.status === "COMPLETED";
  const showProgress = show.totalEpisodes > 0;

  return (
    <Link href={show.href} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
        {poster ? (
          <Image
            src={poster}
            alt={show.title}
            fill
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            unoptimized
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-105",
              show.status === "COMPLETED" && "opacity-90",
              show.status === "DROPPED" && "opacity-85",
            )}
            sizes="(max-width: 768px) 33vw, 160px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            {t("noPoster")}
          </div>
        )}
        {overlay && (
          <div className={cn("absolute inset-0 pointer-events-none", overlay)} />
        )}
        {show.status !== "DROPPED" && showProgress && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
            <div
              className={cn(
                "h-full transition-all",
                isComplete ? "bg-emerald-400" : "bg-amber-400",
              )}
              style={{ width: `${Math.min(100, Math.max(0, show.progress))}%` }}
            />
          </div>
        )}
        {show.recentUnwatchedCount > 0 && (
          <div className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            {show.recentUnwatchedCount}
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-xs text-zinc-400 group-hover:text-white">
        {show.title}
      </p>
    </Link>
  );
}

type WatchQueueSectionProps = {
  title: string;
  shows: WatchQueueShow[];
  priority?: boolean;
  limit?: number;
  seeAllHref?: string;
};

export function WatchQueueSection({
  title,
  shows,
  priority = false,
  limit,
  seeAllHref,
}: WatchQueueSectionProps) {
  const { t } = usePreferences();
  if (shows.length === 0) return null;

  const visible = limit != null ? shows.slice(0, limit) : shows;
  const hasMore = seeAllHref && shows.length > visible.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-full bg-zinc-800/80 px-4 py-1 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
          {title}
        </span>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-violet-300 hover:bg-zinc-700/80 hover:text-violet-200"
            aria-label={t("seeAllNamed", { title })}
          >
            {hasMore ? `+${shows.length - visible.length}` : t("seeAll")}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visible.map((show, index) => (
          <WatchQueueCard
            key={show.id}
            show={show}
            priority={priority && index < 6}
          />
        ))}
      </div>
    </section>
  );
}
