import { ShowGridPage } from "@/components/ShowGridPage";
import { SignInRequired } from "@/components/SignInRequired";
import { numberLocale } from "@/lib/copy";
import { getTranslator } from "@/lib/i18n";
import { getOptionalUserId } from "@/lib/session-user";
import { getFinishedShowsPage } from "@/lib/shows";

export const dynamic = "force-dynamic";

export default async function FinishedShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  const { t, language } = await getTranslator();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { shows, total, totalPages, page: current } = await getFinishedShowsPage(page, language);

  return (
    <ShowGridPage
      titleKey="finishedTitle"
      subtitle={t("finishedCount", { total: total.toLocaleString(numberLocale(language)) })}
      emptyKey="finishedEmpty"
      shows={shows.map((show) => ({ ...show, date: show.updatedAt }))}
      page={current}
      totalPages={totalPages}
      basePath="/shows/finished"
    />
  );
}
