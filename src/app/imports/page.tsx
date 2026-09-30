import Link from "next/link";
import { History } from "lucide-react";
import { getImportLogs } from "@/lib/shows";
import { getTranslator } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const { t, language } = await getTranslator();
  const logs = await getImportLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("importsTitle")}</h1>
        <p className="mt-1 text-zinc-400">{t("importsSubtitle")}</p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center">
          <History className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-zinc-400">{t("noImports")}</p>
          <Link
            href="/import"
            className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500"
          >
            {t("firstImport")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Link
              key={log.id}
              href={`/imports/${log.id}`}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-4 hover:bg-white/[0.05]"
            >
              <div>
                <p className="font-medium text-white">{log.source}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{formatDate(log.createdAt, language)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-violet-300">{t("showsAddedShort", { n: log.showsAdded })}</p>
                <p className="text-zinc-500">
                  {log.episodesAdded} eps
                  {log.episodesSkipped > 0 ? ` ${t("alreadyExistedShort", { n: log.episodesSkipped })}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
