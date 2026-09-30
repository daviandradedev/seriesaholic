import { notFound } from "next/navigation";
import { ShowForm } from "@/components/ShowForm";
import { getTranslator } from "@/lib/i18n";
import { getShowWithSeasons } from "@/lib/shows";

export const dynamic = "force-dynamic";

export default async function EditShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = await getTranslator();
  const { id } = await params;
  const data = await getShowWithSeasons(id);
  if (!data) notFound();

  const genres = Array.isArray(data.details.genres)
    ? data.details.genres.map((g: { name: string }) => g.name).join(", ")
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("editShow")}</h1>
        <p className="mt-1 text-sm text-zinc-400">{data.show.title}</p>
      </div>
      <ShowForm
        mode="edit"
        showId={data.show.id}
        initial={{
          title: data.show.title,
          overview: data.show.overview ?? "",
          posterPath: data.show.posterPath ?? "",
          backdropPath: data.show.backdropPath ?? "",
          firstAirDate: data.show.firstAirDate ?? "",
          genres,
          tmdbStatus: data.show.tmdbStatus ?? data.details.status ?? "Returning Series",
          seasons: data.seasons.map((s) => ({
            seasonNumber: s.season_number,
            name: s.name,
            episodes: s.episodes.map((ep) => ({
              episodeNumber: ep.episode_number,
              name: ep.name,
              airDate: ep.air_date ?? "",
              runtimeMinutes:
                "runtime" in ep && ep.runtime != null ? String(ep.runtime) : "",
            })),
          })),
        }}
      />
    </div>
  );
}
