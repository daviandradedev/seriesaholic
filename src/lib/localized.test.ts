import { describe, expect, it } from "vitest";
import { genreLabel, localizedOverview, localizedTitle } from "@/lib/localized";

describe("localized show text", () => {
  it("uses the English title when the language is English", () => {
    expect(localizedTitle("en", { title: "A Casa do Dragão", titleEn: "House of the Dragon" })).toBe(
      "House of the Dragon",
    );
  });

  it("keeps the Portuguese title in Portuguese", () => {
    expect(localizedTitle("pt", { title: "A Casa do Dragão", titleEn: "House of the Dragon" })).toBe(
      "A Casa do Dragão",
    );
  });

  it("falls back to the stored title when there is no English one", () => {
    expect(localizedTitle("en", { title: "Silo", titleEn: null })).toBe("Silo");
  });

  it("falls back to the stored overview and never returns null", () => {
    expect(localizedOverview("en", { overview: "Resumo", overviewEn: "" })).toBe("Resumo");
    expect(localizedOverview("pt", { overview: null, overviewEn: "Summary" })).toBe("");
  });

  it("translates TMDB genre names that differ between languages", () => {
    expect(genreLabel("en", "Comédia")).toBe("Comedy");
    expect(genreLabel("en", "Drama")).toBe("Drama");
    expect(genreLabel("pt", "Comédia")).toBe("Comédia");
  });
});
