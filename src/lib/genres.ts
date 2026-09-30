import { prisma } from "@/lib/db";
import { getShowDetails } from "@/lib/tmdb";
import type { TmdbShowDetails } from "@/lib/tmdb";
import { isSchemaFieldError, withSchemaFallback } from "@/lib/prisma-safe";
import { requireUserId } from "@/lib/session-user";

export function parseGenresJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((g): g is string => typeof g === "string");
    }
  } catch {
  }
  return [];
}

export function serializeGenres(names: string[]): string {
  return JSON.stringify(names);
}

export function genresFromTmdb(details: Pick<TmdbShowDetails, "genres" | "status">) {
  return {
    genres: serializeGenres(details.genres.map((g) => g.name)),
    tmdbStatus: details.status,
  };
}

export async function backfillShowGenres(limit = 50, userId?: string) {
  const scopeUserId = userId ?? (await requireUserId());
  return withSchemaFallback(
    async () => {
      const shows = await prisma.show.findMany({
        where: { userId: scopeUserId, OR: [{ genres: null }, { genres: "" }] },
        select: { id: true, tmdbId: true },
        take: limit,
      });

      let updated = 0;
      for (const show of shows) {
        if (show.tmdbId == null) continue;
        try {
          const details = await getShowDetails(show.tmdbId);
          const meta = genresFromTmdb(details);
          await prisma.show.update({
            where: { id: show.id },
            data: meta,
          });
          updated++;
          await new Promise((r) => setTimeout(r, 60));
        } catch {
        }
      }
      return updated;
    },
    async () => 0,
  );
}

export async function ensureShowGenres<T extends { id: string; genres: string | null }>(
  shows: T[],
): Promise<T[]> {
  const missing = shows.filter((s) => parseGenresJson(s.genres).length === 0);
  if (missing.length === 0) return shows;

  try {
    await backfillShowGenres(Math.min(missing.length, 30));
  } catch (err) {
    if (!isSchemaFieldError(err)) throw err;
    return shows;
  }

  try {
    const ids = missing.map((s) => s.id);
    const refreshed = await prisma.show.findMany({
      where: { id: { in: ids } },
      select: { id: true, genres: true },
    });
    const map = new Map(refreshed.map((s) => [s.id, s.genres]));
    return shows.map((s) => ({ ...s, genres: map.get(s.id) ?? s.genres }));
  } catch (err) {
    if (isSchemaFieldError(err)) return shows;
    throw err;
  }
}

export async function findShowsForStats() {
  const userId = await requireUserId();
  return withSchemaFallback(
    () =>
      prisma.show.findMany({
        where: { userId },
        select: {
          id: true,
          tmdbId: true,
          title: true,
          status: true,
          genres: true,
          tmdbStatus: true,
          posterPath: true,
          _count: {
            select: {
              episodes: { where: { watched: true, seasonNumber: { gte: 1 } } },
            },
          },
        },
      }),
    () =>
      prisma.show
        .findMany({
          where: { userId },
          select: {
            id: true,
            tmdbId: true,
            title: true,
            status: true,
            posterPath: true,
            _count: {
              select: {
                episodes: { where: { watched: true, seasonNumber: { gte: 1 } } },
              },
            },
          },
        })
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            genres: null as string | null,
            tmdbStatus: null as string | null,
          })),
        ),
  );
}
