import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
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

const statusLabelKey: Record<string, CopyKey> = {
  COMPLETED: "finishedLabel",
  DROPPED: "droppedLabel",
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
          className="mb-4 inline-flex min-h-6 items-center gap-1 text-sm text-zinc-400 hover:text-white"
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
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {shows.map((show) => {
            const poster = posterUrl(show.posterPath, "w342");
            const overlay = statusOverlay[show.status];
            const labelKey = statusLabelKey[show.status];
            return (
              <li key={show.id}>
                <Link href={show.href} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900">
                    {poster ? (
                      <Image
                        src={poster}
                        alt=""
                        fill
                        className={cn(
                          "object-cover transition-transform duration-300 group-hover:scale-105",
                          overlay && "opacity-90",
                        )}
                        sizes="(max-width: 768px) 33vw, 160px"
                      />
                    ) : (
                      <div aria-hidden="true" className="flex h-full items-center justify-center text-xs text-zinc-600">
                        {t("noPoster")}
                      </div>
                    )}
                    {overlay && <div className={cn("pointer-events-none absolute inset-0", overlay)} />}
                    {labelKey && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70",
                          show.status === "DROPPED" ? "text-red-300" : "text-emerald-300",
                        )}
                      >
                        {show.status === "DROPPED" ? (
                          <Ban className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-xs text-zinc-400 group-hover:text-white">
                    {show.title}
                  </p>
                  <p className="truncate text-[10px] text-zinc-600">
                    {labelKey && <span className="sr-only">{t(labelKey)}. </span>}
                    {show.watchedCount} ep · {formatDate(show.date, language)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label={t(titleKey)} className="flex items-center justify-center gap-3 pt-2">
          {page > 1 ? (
            <Link
              href={`${basePath}?page=${page - 1}`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("prevPage")}
            </Link>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-3 py-2 text-sm text-zinc-600"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("prevPage")}
            </span>
          )}
          <span aria-current="page" className="text-sm text-zinc-500">
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
            <span
              className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-3 py-2 text-sm text-zinc-600"
            >
              {t("nextPage")}
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
