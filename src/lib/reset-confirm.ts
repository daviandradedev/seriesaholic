import type { Language } from "@/lib/preferences";

export const RESET_CONFIRM_PHRASES = ["APAGAR TUDO", "DELETE ALL"] as const;

export function resetConfirmPhrase(language: Language) {
  return language === "en" ? "DELETE ALL" : "APAGAR TUDO";
}

export function isResetConfirmPhrase(value: unknown) {
  if (typeof value !== "string") return false;
  return RESET_CONFIRM_PHRASES.includes(
    value.trim().toUpperCase() as (typeof RESET_CONFIRM_PHRASES)[number],
  );
}
