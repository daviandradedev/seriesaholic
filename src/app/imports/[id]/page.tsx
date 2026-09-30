import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ImportShowGrid } from "@/components/ImportShowGrid";
import { ImportFailureResolver } from "@/components/ImportFailureResolver";
import { parseImportLogDetails } from "@/lib/import-resolve";
import { getImportLog } from "@/lib/shows";
import { getTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, language } = await getTranslator();
  const { id } = await params;
  const log = await getImportLog(id);
  if (!log) notFound();

  const details = parseImportLogDetails(log.details);
  const failures = details.failures ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/imports"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("importBack")}
        </Link>
        <h1 className="text-2xl font-bold text-white">{t("importOf", { date: formatDate(log.createdAt, language) })}</h1>
        <p className="mt-1 text-zinc-400">{log.source}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("newShows"), value: log.showsAdded },
          { label: t("episodesAdded"), value: log.episodesAdded },
          { label: t("alreadyExisted"), value: log.episodesSkipped },
          { label: t("uniqueErrors"), value: log.errors },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
          >
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
          </div>
        ))}
      </section>

      {failures.length > 0 && (
        <ImportFailureResolver importLogId={log.id} initialFailures={failures} />
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {t("showsInImport", { n: log.addedShows.length })}
        </h2>
        <ImportShowGrid shows={log.addedShows} />
      </section>
    </div>
  );
}
