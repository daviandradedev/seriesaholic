import type { Metadata } from "next";
import { ShowDetail } from "@/components/ShowDetail";
import { getTranslator } from "@/lib/i18n";
import { getShowTitle } from "@/lib/shows";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, { t, language }] = await Promise.all([params, getTranslator()]);
  const title = await getShowTitle(id, language).catch(() => null);
  return { title: title ?? t("showTitleFallback") };
}

export default function ShowPage() {
  return <ShowDetail />;
}
