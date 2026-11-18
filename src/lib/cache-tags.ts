import { revalidateTag } from "next/cache";

export const LIBRARY_CACHE_TAG = "library";

export const HOME_TMDB_CACHE_TAG = "home-tmdb";

export function invalidateLibraryCache() {
  try {
    revalidateTag(LIBRARY_CACHE_TAG, { expire: 0 });
    revalidateTag(HOME_TMDB_CACHE_TAG, { expire: 0 });
  } catch {
  }
}
