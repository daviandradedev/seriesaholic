import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscoverCatalog } from "@/components/DiscoverCatalog";
import { DashboardStatsBar } from "@/components/DashboardStatsBar";
import { NavBar } from "@/components/NavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { EpisodeList } from "@/components/EpisodeList";
import { ErrorState } from "@/components/ErrorState";
import { PreferencesProvider } from "@/components/Preferences";
import { SignInRequired } from "@/components/SignInRequired";
import { WatchQueueSection } from "@/components/WatchQueueSection";

function renderUi(ui: ReactNode) {
  return render(
    <PreferencesProvider initialTheme="dark" initialLanguage="en">
      {ui}
    </PreferencesProvider>,
  );
}

describe("ErrorState", () => {
  it("renders the code, title, and recovery links", () => {
    renderUi(
      <ErrorState
        code="404"
        title="Page not found"
        description="This address does not exist."
      />,
    );

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Search/i })).toHaveAttribute("href", "/search");
  });
});

describe("DiscoverCatalog", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows Home pointing at the added shows", () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ shows: [] }))));
    const { container } = renderUi(<DiscoverCatalog signedIn={false} />);
    expect(within(container).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("starts on All and hides For you when signed out", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ shows: [], stats: { total: 0, categories: [] } })));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DiscoverCatalog signedIn={false} />);

    expect(screen.queryByRole("button", { name: "For you" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveClass("bg-violet-600");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/catalog?limit=48");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("recommendations");
  });

  it("hides the catalog refresh from visitors", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ shows: [] })));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DiscoverCatalog signedIn={false} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Refresh catalog" })).not.toBeInTheDocument();
  });

  it("starts on For you when signed in", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ shows: [], profile: { topGenres: [], totalWeightedEpisodes: 0 } })));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DiscoverCatalog signedIn />);

    expect(screen.getByRole("button", { name: "For you" })).toHaveClass("bg-emerald-600");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/recommendations?limit=48");
  });
});

describe("DashboardStatsBar", () => {
  it("renders metrics and the stats link", () => {
    renderUi(
      <DashboardStatsBar totalShows={690} totalEpisodes={6348} totalWatchMinutes={285120} />,
    );

    expect(screen.getByText("690")).toBeInTheDocument();
    expect(screen.getByText("6,348")).toBeInTheDocument();
    expect(screen.getByText("Full stats")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Library" })).not.toBeInTheDocument();
  });
});

describe("NavBar", () => {
  it("keeps Home first in the header shortcuts and links the wordmark to the portfolio", () => {
    renderUi(<NavBar user={null} />);

    const library = screen.getByRole("navigation", { name: "Library" });
    const links = within(library).getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Home");
    expect(links[0]).toHaveAttribute("href", "/");
    expect(links.map((link) => link.textContent)).toEqual([
      "Home",
      "Discover",
      "Search",
      "Calendar",
      "Import",
      "Settings",
    ]);
    expect(screen.getByRole("link", { name: "daviandrade.dev. Opens in a new tab" })).toHaveAttribute(
      "href",
      "https://daviandrade-portfolio.vercel.app/",
    );
    expect(screen.getByRole("link", { name: "daviandrade.dev. Opens in a new tab" })).toHaveTextContent("dandrade.dev");
  });
});

describe("SiteFooter", () => {
  it("credits the author and links LinkedIn, GitHub, and email", () => {
    const { container } = renderUi(<SiteFooter />);
    const footer = within(container).getByRole("contentinfo");

    expect(within(footer).getByText(/Davi Andrade\. Show tracker\./)).toBeInTheDocument();
    expect(within(footer).getByRole("link", { name: "LinkedIn. Opens in a new tab" })).toHaveAttribute(
      "href",
      "https://linkedin.com/in/daviandradedev",
    );
    expect(within(footer).getByRole("link", { name: "GitHub. Opens in a new tab" })).toHaveAttribute(
      "href",
      "https://github.com/daviandradedev",
    );
    expect(within(footer).getByRole("link", { name: "E-mail" })).toHaveAttribute(
      "href",
      "mailto:daviandrade.dev@gmail.com",
    );
    expect(within(footer).queryByRole("img", { name: "daviandrade.dev" })).not.toBeInTheDocument();
  });
});

describe("WatchQueueSection", () => {
  it("applies a green overlay to finished shows and a red overlay to dropped shows", () => {
    const { container } = renderUi(
      <WatchQueueSection
        title="Finished"
        shows={[
          {
            id: "1",
            tmdbId: 1,
            title: "Show A",
            titleEn: null,
            posterPath: null,
            status: "COMPLETED",
            watchedCount: 10,
            totalEpisodes: 10,
            progress: 100,
            unwatchedCount: 0,
            recentUnwatchedCount: 0,
            oldestUnwatchedAirDate: null,
            newestUnwatchedAirDate: null,
            tmdbStatus: "Ended",
            href: "/shows/1",
            updatedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "2",
            tmdbId: 2,
            title: "Show B",
            titleEn: null,
            posterPath: null,
            status: "DROPPED",
            watchedCount: 3,
            totalEpisodes: 10,
            progress: 30,
            unwatchedCount: 7,
            recentUnwatchedCount: 0,
            oldestUnwatchedAirDate: null,
            newestUnwatchedAirDate: null,
            tmdbStatus: "Returning Series",
            href: "/shows/2",
            updatedAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(container.querySelector('[class*="bg-emerald-400/30"]')).toBeTruthy();
    expect(container.querySelector('[class*="bg-red-500/30"]')).toBeTruthy();
  });
});

describe("SignInRequired", () => {
  it("offers sign-in and a way back to Discover", () => {
    const { container } = renderUi(<SignInRequired />);
    const view = within(container);

    expect(view.getByRole("heading", { name: "Sign in to see your library" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Sign in or create an account" })).toBeInTheDocument();
    expect(view.getByRole("link", { name: "Discover shows" })).toHaveAttribute("href", "/discover");
  });
});

describe("EpisodeList", () => {
  it("lists episodes without any way to mark them in read-only mode", () => {
    const { container } = renderUi(
      <EpisodeList
        showId="1"
        readOnly
        onToggle={() => {}}
        seasons={[
          {
            season_number: 1,
            name: "Season 1",
            watchedCount: 0,
            episodes: [
              { season_number: 1, episode_number: 1, name: "Pilot", air_date: null, watched: false },
            ],
          },
        ]}
      />,
    );
    const view = within(container);

    fireEvent.click(view.getByRole("button", { name: /Season 1/ }));
    expect(view.getByText("1. Pilot")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: /Pilot/ })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Mark all" })).not.toBeInTheDocument();
  });

  it("does not nest buttons in the season header", () => {
    renderUi(
      <EpisodeList
        tmdbId={94997}
        onToggle={() => {}}
        seasons={[
          {
            season_number: 1,
            name: "Season 1",
            watchedCount: 0,
            episodes: [
              {
                season_number: 1,
                episode_number: 1,
                name: "Pilot",
                air_date: "2024-01-01",
                watched: false,
              },
            ],
          },
        ]}
      />,
    );

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button.querySelector("button")).toBeNull();
    }
  });

  it("marks the episode before the server responds", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const { container } = renderUi(
      <EpisodeList
        showId="show-1"
        onToggle={() => {}}
        seasons={[
          {
            season_number: 1,
            name: "Season 1",
            watchedCount: 0,
            episodes: [
              {
                season_number: 1,
                episode_number: 1,
                name: "Pilot",
                air_date: null,
                watched: false,
              },
            ],
          },
        ]}
      />,
    );

    const view = within(container);
    fireEvent.click(view.getByRole("button", { name: /Season 1/ }));
    fireEvent.click(view.getByRole("button", { name: /Pilot/ }));
    expect(container.querySelector(".bg-emerald-600")).toBeTruthy();
    expect(view.getByText("1/1")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("marks the season with a single request", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ watchedCount: 2, status: "WATCHING" }), {
            status: 200,
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderUi(
      <EpisodeList
        showId="show-1"
        onToggle={() => {}}
        seasons={[
          {
            season_number: 1,
            name: "Season 1",
            watchedCount: 0,
            episodes: [
              {
                season_number: 1,
                episode_number: 1,
                name: "Pilot",
                air_date: null,
                watched: false,
              },
              {
                season_number: 1,
                episode_number: 2,
                name: "Cat",
                air_date: null,
                watched: false,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(within(container).getByRole("button", { name: "Mark all" }));
    expect(within(container).getByText("2/2")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      seasonNumber: 1,
      watched: true,
      episodes: [
        { episodeNumber: 1, episodeName: "Pilot" },
        { episodeNumber: 2, episodeName: "Cat" },
      ],
    });
    vi.unstubAllGlobals();
  });

  function twoSeasons() {
    return [
      {
        season_number: 1,
        name: "Season 1",
        watchedCount: 1,
        episodes: [
          { season_number: 1, episode_number: 1, name: "Pilot", air_date: null, watched: false },
          { season_number: 1, episode_number: 2, name: "Cat", air_date: null, watched: true },
        ],
      },
      {
        season_number: 2,
        name: "Season 2",
        watchedCount: 0,
        episodes: [
          { season_number: 2, episode_number: 1, name: "Return", air_date: null, watched: false },
          { season_number: 2, episode_number: 2, name: "Finale", air_date: null, watched: false },
        ],
      },
    ];
  }

  it("asks before marking an episode with unwatched earlier ones and marks them across seasons", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ watchedCount: 4, status: "WATCHING" }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderUi(
      <EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />,
    );
    const view = within(container);

    fireEvent.click(view.getByRole("button", { name: /Season 2/ }));
    fireEvent.click(view.getByRole("button", { name: /Finale/ }));

    const dialog = view.getByRole("dialog", { name: "Mark the earlier ones too?" });
    expect(within(dialog).getByText("2 earlier episode(s) are still unwatched.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Mark earlier ones too" }));
    expect(view.queryByRole("dialog")).not.toBeInTheDocument();
    expect(view.getAllByText("2/2")).toHaveLength(2);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies).toEqual([
      { seasonNumber: 1, watched: true, episodes: [{ episodeNumber: 1, episodeName: "Pilot" }] },
      {
        seasonNumber: 2,
        watched: true,
        episodes: [
          { episodeNumber: 1, episodeName: "Return" },
          { episodeNumber: 2, episodeName: "Finale" },
        ],
      },
    ]);
    vi.unstubAllGlobals();
  });

  it("marks only the clicked episode when the earlier ones are skipped", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(JSON.stringify({ watchedCount: 2, status: "WATCHING" }), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderUi(
      <EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />,
    );
    const view = within(container);

    fireEvent.click(view.getByRole("button", { name: /Season 2/ }));
    fireEvent.click(view.getByRole("button", { name: /Finale/ }));
    fireEvent.click(view.getByRole("button", { name: "Only this one" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({
      seasonNumber: 2,
      episodeNumber: 2,
      episodeName: "Finale",
      watched: true,
    });
    expect(view.getByRole("button", { name: /Season 1/ })).toHaveTextContent("1/2");
    expect(view.getByRole("button", { name: /Season 2/ })).toHaveTextContent("1/2");
    vi.unstubAllGlobals();
  });

  it("does not ask when unmarking an episode", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const { container } = renderUi(
      <EpisodeList showId="show-1" onToggle={() => {}} seasons={twoSeasons()} />,
    );
    const view = within(container);

    fireEvent.click(view.getByRole("button", { name: /Cat/ }));
    expect(view.queryByRole("dialog")).not.toBeInTheDocument();
    expect(view.getByRole("button", { name: /Season 1/ })).toHaveTextContent("0/2");
    vi.unstubAllGlobals();
  });
});
