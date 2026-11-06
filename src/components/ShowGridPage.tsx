import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { CopyKey } from "@/lib/copy";
import { getTranslator } from "@/lib/i18n";
import { cn, formatDate, posterUrl } from "@/lib/utils";

export type ShowGridItem = {
  id: string;
  href: string;
  title: string;
  posterPath: string | null;
  status: string;
  watchedCount: number;
  date: Date;
};

const statusOverlay: Record<string, string> = {
  COMPLETED: "bg-emerald-400/20",
  DROPPED: "bg-red-500/25",
};

export async function ShowGridPage({
  titleKey,
  subtitle,
  emptyKey,
  shows,
  page,
  totalPages,
  basePath,
}: {
  titleKey: CopyKey;
  subtitle: string;
  emptyKey: CopyKey;
  shows: ShowGridItem[];
  page: number;
  totalPages: number;
  basePath: string;
}) {
  const { t, language } = await getTranslator();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backHome")}
        </Link>
        <h1 className="text-2xl font-bold text-white">{t(titleKey)}</h1>
        <p className="mt-1 text-zinc-400">{subtitle}</p>
      </div>

      {shows.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-zinc-500">
          {t(emptyKey)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {shows.map((show) => {
            const poster = posterUrl(show.posterPath, "w342");
            const overlay = statusOverlay[show.status];
            return (
              <Link key={show.id} href={show.href} className="group block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                  {poster ? (
                    <Image
                      src={poster}
                      alt={show.title}
                      fill
                      className={cn(
                        "object-cover transition-transform duration-300 group-hover:scale-105",
                        overlay && "opacity-90",
                      )}
                      sizes="(max-width: 768px) 33vw, 160px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                      {t("noPoster")}
                    </div>
                  )}
                  {overlay && <div className={cn("pointer-events-none absolute inset-0", overlay)} />}
                </div>
                <p className="mt-1.5 truncate text-xs text-zinc-400 group-hover:text-white">
                  {show.title}
                </p>
                <p className="truncate text-[10px] text-zinc-600">
                  {show.watchedCount} ep · {formatDate(show.date, language)}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 pt-2">
          {page > 1 ? (
            <Link
              href={`${basePath}?page=${page - 1}`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("prevPage")}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-3 py-2 text-sm text-zinc-600">
              <ChevronLeft className="h-4 w-4" />
              {t("prevPage")}
            </span>
          )}
          <span className="text-sm text-zinc-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`${basePath}?page=${page + 1}`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              {t("nextPage")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-3 py-2 text-sm text-zinc-600">
              {t("nextPage")}
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
