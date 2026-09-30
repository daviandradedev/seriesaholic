import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DiscoverPage from "@/app/discover/page";
import { DashboardStatsBar } from "@/components/DashboardStatsBar";
import { NavBar } from "@/components/NavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { EpisodeList } from "@/components/EpisodeList";
import { ErrorState } from "@/components/ErrorState";
import { PreferencesProvider } from "@/components/Preferences";
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

describe("DiscoverPage", () => {
  it("shows Home pointing at the added shows", () => {
    const { container } = renderUi(<DiscoverPage />);
    expect(within(container).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
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
          },
          {
            id: "2",
            tmdbId: 2,
            title: "Show B",
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
          },
        ]}
      />,
    );

    expect(container.querySelector('[class*="bg-emerald-400/30"]')).toBeTruthy();
    expect(container.querySelector('[class*="bg-red-500/30"]')).toBeTruthy();
  });
});

describe("EpisodeList", () => {
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
    const fetchMock = vi.fn(
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
});
