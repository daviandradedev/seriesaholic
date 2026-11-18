import type { Language } from "@/lib/copy";

const ENGLISH_GENRES: Record<string, string> = {
  Animação: "Animation",
  Comédia: "Comedy",
  Documentário: "Documentary",
  Família: "Family",
  Mistério: "Mystery",
  Faroeste: "Western",
};

export type BilingualText = {
  title: string;
  titleEn?: string | null;
  overview?: string | null;
  overviewEn?: string | null;
};

export function localizedTitle(language: Language, show: Pick<BilingualText, "title" | "titleEn">) {
  return language === "en" ? show.titleEn || show.title : show.title;
}

export function localizedOverview(
  language: Language,
  show: Pick<BilingualText, "overview" | "overviewEn">,
) {
  return (language === "en" ? show.overviewEn || show.overview : show.overview) ?? "";
}

export function genreLabel(language: Language, name: string) {
  return language === "en" ? (ENGLISH_GENRES[name] ?? name) : name;
}
