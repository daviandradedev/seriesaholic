import { StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogCard } from "@/components/CatalogCard";
import { DashboardStatsBar } from "@/components/DashboardStatsBar";
import { DiscoverCatalog } from "@/components/DiscoverCatalog";
import { EpisodeList } from "@/components/EpisodeList";
import { ErrorState } from "@/components/ErrorState";
import { ExplorePromptModal } from "@/components/ExplorePromptModal";
import { HomeRecommendations } from "@/components/HomeRecommendations";
import { ImportFailureResolver } from "@/components/ImportFailureResolver";
import { ImportScreen } from "@/components/ImportScreen";
import { ImportShowGrid } from "@/components/ImportShowGrid";
import { NavBar } from "@/components/NavBar";
import { PageLoading } from "@/components/PageLoading";
import { LanguageToggle, PreferencesProvider, ThemeToggle } from "@/components/Preferences";
import { ProgressBar } from "@/components/ProgressBar";
import { SearchScreen } from "@/components/SearchScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ShowForm } from "@/components/ShowForm";
import { ShowGridPage } from "@/components/ShowGridPage";
import { SignInRequired } from "@/components/SignInRequired";
import { SiteFooter } from "@/components/SiteFooter";
import { SkipLink } from "@/components/SkipLink";
import { WatchQueueSection } from "@/components/WatchQueueSection";
import { BarChart, GenreTable, MarathonTable, StatBlock } from "@/components/stats/StatsCards";
import type { WatchQueueShow } from "@/lib/watch-queue";
import { axeViolations } from "@/test/axe";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "language" ? { value: "en" } : undefined) }),
}));

function renderUi(ui: ReactNode) {
  return render(
    <PreferencesProvider initialTheme="dark" initialLanguage="en">
      {ui}
    </PreferencesProvider>,
  );
}

function queueShow(overrides: Partial<WatchQueueShow>): WatchQueueShow {
  return {
    id: "1",
    tmdbId: 1,
    title: "Show A",
    titleEn: null,
    posterPath: "/a.jpg",
    status: "WATCHING",
    watchedCount: 3,
    totalEpisodes: 10,
    progress: 30,
    unwatchedCount: 7,
    recentUnwatchedCount: 0,
    oldestUnwatchedAirDate: null,
    newestUnwatchedAirDate: null,
    tmdbStatus: "Returning Series",
    href: "/shows/1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as WatchQueueShow;
}

function twoSeasons() {
  return [
    {
      season_number: 1,
      name: "Season 1",
      watchedCount: 0,
      episodes: [
        { season_number: 1, episode_number: 1, name: "Pilot", air_date: null, watched: false },
        { season_number: 1, episode_number: 2, name: "Cat", air_date: null, watched: false },
      ],
    },
    {
      season_number: 2,
      name: "Season 2",
      watchedCount: 0,
      episodes: [
        { season_number: 2, episode_number: 1, name: "Return", air_date: null, watched: false },
      ],
    },
  ];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe("axe: shell", () => {
  it("finds no violations in the header when signed out", async () => {
    const { container } = renderUi(<NavBar user={null} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the header when signed in", async () => {
    const { container } = renderUi(
      <NavBar user={{ email: "davi@example.com", name: "Davi Andrade", image: null }} />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the footer", async () => {
    const { container } = renderUi(<SiteFooter />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the skip link", async () => {
    const { container } = renderUi(<SkipLink />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("axe: dialogs", () => {
  it("finds no violations in the explore prompt dialog", async () => {
    const { container } = renderUi(<ExplorePromptModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the mark-earlier dialog", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const { container } = renderUi(
      <EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Season 2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Return/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("axe: screens", () => {
  it("finds no violations in the sign-in prompt", async () => {
    const { container } = renderUi(<SignInRequired />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in Discover after the catalog loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        jsonResponse({
          shows: [
            {
              tmdbId: 7,
              title: "Show A",
              posterPath: "/a.jpg",
              voteAverage: 8.4,
              firstAirDate: "2020-01-01",
              category: "popular",
              compatibilityScore: 90,
              matchingGenres: ["Drama"],
            },
          ],
          profile: { topGenres: ["Drama"], totalWeightedEpisodes: 4 },
        }),
      ),
    );
    const { container } = renderUi(<DiscoverCatalog signedIn />);
    await screen.findByRole("heading", { name: "Show A" });
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in an open season of the episode list", async () => {
    const { container } = renderUi(
      <EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Season 1/ }));
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the watch queue with finished and dropped shows", async () => {
    const { container } = renderUi(
      <WatchQueueSection
        title="Finished"
        seeAllHref="/shows/finished"
        limit={1}
        shows={[
          queueShow({ id: "1", status: "COMPLETED", watchedCount: 10, progress: 100, recentUnwatchedCount: 2 }),
          queueShow({ id: "2", title: "Show B", status: "DROPPED", href: "/shows/2" }),
        ]}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the show grid page", async () => {
    const ui = await ShowGridPage({
      titleKey: "finishedTitle",
      subtitle: "2 shows",
      emptyKey: "finishedEmpty",
      page: 1,
      totalPages: 2,
      basePath: "/shows/finished",
      shows: [
        {
          id: "1",
          href: "/shows/1",
          title: "Show A",
          posterPath: "/a.jpg",
          status: "COMPLETED",
          watchedCount: 10,
          date: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });
    const { container } = renderUi(ui);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the settings screen", async () => {
    const { container } = renderUi(<SettingsScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the import screen", async () => {
    const { container } = renderUi(<ImportScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the import failure resolver", async () => {
    const { container } = renderUi(
      <ImportFailureResolver
        importLogId="log-1"
        initialFailures={[
          {
            id: "f1",
            groupKey: "unknown-show",
            title: "Unknown Show",
            message: "Not found on TMDB",
            reason: "show_not_found",
            ids: {},
            episodes: [{ season: 1, episode: 1, line: "S01E01" }],
            resolved: false,
          },
        ]}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the import show grid", async () => {
    const { container } = renderUi(
      <ImportShowGrid
        shows={[
          { tmdbId: 1, title: "Show A", posterPath: "/a.jpg", episodesAdded: 3, isNew: true },
          { tmdbId: null, title: "Custom", posterPath: null, episodesAdded: 0, isNew: false },
        ]}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the show form", async () => {
    const { container } = renderUi(<ShowForm mode="create" />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the search screen", async () => {
    const { container } = renderUi(<SearchScreen />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the stats cards", async () => {
    const { container } = renderUi(
      <main>
        <h1>Stats</h1>
        <StatBlock title="Time watched" value="10 h" subtitle="Last 7 days" />
        <BarChart
          title="Episodes"
          unit="Episodes"
          data={[
            { label: "W1", value: 3 },
            { label: "W2", value: 0, isCurrent: true },
          ]}
        />
        <GenreTable genres={[{ genre: "Drama", shows: 4 }]} />
        <MarathonTable marathons={[{ showTitle: "Show A", showTmdbId: 1, episodes: 6, hours: 5 }]} />
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });

  it("finds no violations in the dashboard, recommendations, error and loading states", async () => {
    const { container } = renderUi(
      <main>
        <ErrorState code="404" title="Page not found" description="Gone." />
        <DashboardStatsBar totalShows={3} totalEpisodes={30} totalWatchMinutes={600} />
        <HomeRecommendations />
        <PageLoading />
        <ul>
          <li>
            <CatalogCard tmdbId={1} title="Show A" posterPath={null} voteAverage={7.5} firstAirDate="2021-01-01" />
          </li>
        </ul>
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("skip link", () => {
  it("targets the main content", () => {
    renderUi(<SkipLink />);
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main-content");
  });
});

describe("preference switches", () => {
  it("keeps a stable theme name and reports the state through aria-checked", () => {
    renderUi(<ThemeToggle />);
    const toggle = screen.getByRole("switch", { name: "Dark theme" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(screen.getByRole("switch", { name: "Dark theme" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps a stable language name and reports Portuguese through aria-checked", () => {
    renderUi(<LanguageToggle />);
    expect(screen.getByRole("switch", { name: "Language: Portuguese" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

describe("mobile navigation", () => {
  it("is labelled and marks the current page", () => {
    renderUi(<NavBar user={null} />);
    const quick = screen.getByRole("navigation", { name: "Quick navigation" });
    expect(within(quick).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(quick).getByRole("link", { name: "Discover" })).not.toHaveAttribute("aria-current");
  });
});

describe("explore prompt dialog", () => {
  it("opens as a labelled native modal", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    renderUi(<ExplorePromptModal />);
    const dialog = screen.getByRole("dialog", { name: "Explore freely, save with an account" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself when the dialog closes with Escape", async () => {
    renderUi(<ExplorePromptModal />);
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    act(() => dialog.close());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sessionStorage.getItem("sah-explore-notice")).toBe("1");
  });

  it("stays open when Strict Mode replays the dialog ref", async () => {
    render(
      <StrictMode>
        <PreferencesProvider initialTheme="dark" initialLanguage="en">
          <ExplorePromptModal />
        </PreferencesProvider>
      </StrictMode>,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(sessionStorage.getItem("sah-explore-notice")).toBeNull();
  });
});

describe("mark-earlier dialog", () => {
  function openDialog() {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderUi(<EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />);
    fireEvent.click(screen.getByRole("button", { name: /Season 2/ }));
    fireEvent.click(screen.getByRole("button", { name: /Return/ }));
    return screen.getByRole("dialog", { name: "Mark the earlier ones too?" });
  }

  it("describes how many earlier episodes are unwatched", () => {
    const dialog = openDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("2 earlier episode(s) are still unwatched.");
  });

  it("closes without saving when the dialog closes with Escape", async () => {
    const dialog = openDialog() as HTMLDialogElement;
    act(() => dialog.close());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores a stale close event while the modal is still open", () => {
    const dialog = openDialog();
    fireEvent(dialog, new Event("close"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the native modal when an action unmounts it", () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, "close");
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalled();
  });
});

describe("episode list semantics", () => {
  it("exposes the season expansion state", () => {
    renderUi(<EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />);
    const season = screen.getByRole("button", { name: /Season 1/ });
    expect(season).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(season);
    expect(season).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes the watched state of each episode as pressed", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderUi(<EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />);
    fireEvent.click(screen.getByRole("button", { name: /Season 1/ }));
    const pilot = screen.getByRole("button", { name: /Pilot/ });
    expect(pilot).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pilot);
    expect(screen.getByRole("button", { name: /Pilot/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("names each season progress bar", () => {
    renderUi(<EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />);
    expect(screen.getByRole("progressbar", { name: "Season 1 progress" })).toHaveAttribute("aria-valuenow", "0");
  });
});

describe("discover tabs", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({ shows: [] })));
  });

  it("moves focus with the arrow keys without changing the selection", () => {
    renderUi(<DiscoverCatalog signedIn={false} />);
    const all = screen.getByRole("tab", { name: "All" });
    all.focus();
    fireEvent.keyDown(all, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Trending" })).toHaveFocus();
    expect(all).toHaveAttribute("aria-selected", "true");
  });

  it("wraps from the first tab to the last", () => {
    renderUi(<DiscoverCatalog signedIn={false} />);
    const all = screen.getByRole("tab", { name: "All" });
    all.focus();
    fireEvent.keyDown(all, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Top rated" })).toHaveFocus();
  });

  it("keeps only the selected tab in the tab order", () => {
    renderUi(<DiscoverCatalog signedIn={false} />);
    expect(screen.getByRole("tab", { name: "All" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Popular" })).toHaveAttribute("tabindex", "-1");
  });

  it("selects a tab on click and labels the panel with it", () => {
    renderUi(<DiscoverCatalog signedIn={false} />);
    fireEvent.click(screen.getByRole("tab", { name: "Popular" }));
    expect(screen.getByRole("tab", { name: "Popular" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Popular" })).toBeInTheDocument();
  });
});

describe("status that is not only color", () => {
  it("announces finished, dropped, progress and new episodes on queue cards", () => {
    renderUi(
      <WatchQueueSection
        title="Queue"
        shows={[
          queueShow({ id: "1", status: "COMPLETED", watchedCount: 10, progress: 100, recentUnwatchedCount: 2 }),
          queueShow({ id: "2", title: "Show B", status: "DROPPED", href: "/shows/2" }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Show A.*Finished.*10\/10 episodes.*2 new unwatched/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Show B.*Dropped/ })).toBeInTheDocument();
  });

  it("names the progress bar with its value", () => {
    renderUi(<ProgressBar value={42} label="Import progress" />);
    const bar = screen.getByRole("progressbar", { name: "Import progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("marks the current period of a bar chart in text", () => {
    renderUi(<BarChart title="Episodes" data={[{ label: "W2", value: 1, isCurrent: true }]} />);
    expect(screen.getByText("(current)", { exact: false })).toHaveClass("sr-only");
  });
});

describe("status messages", () => {
  it("announces loading through a status region", () => {
    renderUi(<PageLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  });

  it("announces the search result count", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({ results: [] })));
    renderUi(<SearchScreen />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search show" }), { target: { value: "Lost" } });
    expect(screen.getByRole("status")).toHaveTextContent("Searching...");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0 result(s)"));
  });

  it("names the file input and its accepted formats on the import screen", () => {
    renderUi(<ImportScreen />);
    const input = screen.getByLabelText(/Click to select files/);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAccessibleDescription(".zip, .csv, or .json");
  });
});

describe("form errors", () => {
  it("links the settings error to the field and marks it invalid", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({ error: "Reset failed" }, 500)));
    renderUi(<SettingsScreen />);
    const input = screen.getByLabelText("Type DELETE ALL to enable:");
    fireEvent.change(input, { target: { value: "DELETE ALL" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear all data" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reset failed");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Reset failed/);
  });

  it("moves focus to the show form error after a failed save", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => jsonResponse({ error: "Save broke" }, 500)));
    renderUi(<ShowForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title *"), { target: { value: "My show" } });
    fireEvent.click(screen.getByRole("button", { name: "Create show" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Save broke");
    expect(alert).toHaveFocus();
  });

  it("labels every episode field and icon-only button in the show form", () => {
    renderUi(<ShowForm mode="create" />);
    expect(screen.getByLabelText("Season 1, episode 1: air date")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Season 1, episode 1: runtime in minutes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove season 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove episode 1" })).toBeInTheDocument();
  });
});
