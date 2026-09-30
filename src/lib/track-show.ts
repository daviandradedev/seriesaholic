import { saveWasRejected } from "@/lib/login-redirect";

export async function trackShow(tmdbId: number, inWatchlist = false) {
  const res = await fetch(`/api/shows/${tmdbId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inWatchlist }),
  });
  if (saveWasRejected(res)) return false;
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "ADD_FAILED");
  }
  return true;
}
