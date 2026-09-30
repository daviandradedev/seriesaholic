import { cookies } from "next/headers";
import { translate, type CopyKey, type Language } from "@/lib/copy";
import { readLanguageCookie } from "@/lib/preferences";

export async function getTranslator() {
  const store = await cookies();
  const language: Language = readLanguageCookie(store.get("language")?.value) ?? "pt";
  const t = (key: CopyKey, vars?: Record<string, string | number>) =>
    translate(language, key, vars);
  return { t, language };
}
