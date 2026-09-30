import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { translate, type Language } from "@/lib/copy";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function posterUrl(path: string | null | undefined, size = "w342") {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function backdropUrl(path: string | null | undefined, size = "w780") {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function formatDate(date: string | Date | null | undefined, language: Language = "pt") {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function progressPercent(watched: number, total: number) {
  if (total === 0) return 0;
  return Math.round((watched / total) * 100);
}

export function showPath(show: { id: string; tmdbId: number | null }) {
  return show.tmdbId != null ? `/shows/${show.tmdbId}` : `/shows/${show.id}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function counted(language: Language, value: number, one: "monthOne" | "dayOne" | "hourOne" | "yearOne") {
  const many = one.replace("One", "Many") as "monthMany" | "dayMany" | "hourMany" | "yearMany";
  const rounded = Math.round(value * 10) / 10;
  const shown = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return `${shown} ${translate(language, rounded === 1 ? one : many)}`;
}

export function formatWatchTimeDetailed(totalMinutes: number, language: Language = "pt"): string {
  const totalHours = Math.floor(totalMinutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const days = Math.floor((totalHours % (24 * 30)) / 24);
  const hours = totalHours % 24;

  const parts: string[] = [];
  if (months > 0) parts.push(counted(language, months, "monthOne"));
  if (days > 0 || months > 0) parts.push(counted(language, days, "dayOne"));
  parts.push(counted(language, hours, "hourOne"));
  return parts.join(" ");
}

export function formatWatchTime(totalMinutes: number, language: Language = "pt"): string {
  if (totalMinutes <= 0) return "0h";

  const hours = totalMinutes / 60;
  if (hours < 24) {
    const h = Math.round(hours * 10) / 10;
    return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
  }

  const days = hours / 24;
  if (days < 30) return counted(language, days, "dayOne");

  const months = days / 30;
  if (months < 12) return counted(language, months, "monthOne");

  return counted(language, months / 12, "yearOne");
}
