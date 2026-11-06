import { ShowGridPage } from "@/components/ShowGridPage";
import { SignInRequired } from "@/components/SignInRequired";
import { numberLocale } from "@/lib/copy";
import { getTranslator } from "@/lib/i18n";
import { getOptionalUserId } from "@/lib/session-user";
import { getRecentShowsPage } from "@/lib/shows";

export const dynamic = "force-dynamic";

export default async function RecentShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  const { t, language } = await getTranslator();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { shows, total, totalPages, page: current } = await getRecentShowsPage(page, language);

  return (
    <ShowGridPage
      titleKey="recentlyAdded"
      subtitle={t("recentCount", { total: total.toLocaleString(numberLocale(language)) })}
      emptyKey="recentEmpty"
      shows={shows.map((show) => ({ ...show, date: show.createdAt }))}
      page={current}
      totalPages={totalPages}
      basePath="/shows/recent"
    />
  );
}
