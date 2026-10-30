import { ShowForm } from "@/components/ShowForm";
import { SignInRequired } from "@/components/SignInRequired";
import { getTranslator } from "@/lib/i18n";
import { getOptionalUserId } from "@/lib/session-user";

export default async function NewShowPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string }>;
}) {
  if (!(await getOptionalUserId())) return <SignInRequired />;
  const { t } = await getTranslator();
  const { title } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("newShow")}</h1>
        <p className="mt-1 text-sm text-zinc-400">{t("newShowSubtitle")}</p>
      </div>
      <ShowForm
        mode="create"
        initial={
          title
            ? {
                title,
                overview: "",
                posterPath: "",
                backdropPath: "",
                firstAirDate: "",
                genres: "",
                tmdbStatus: "Returning Series",
                seasons: [],
              }
            : undefined
        }
      />
    </div>
  );
}
