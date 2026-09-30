"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { translate, type CopyKey } from "@/lib/copy";
import {
  browserLanguage,
  browserTheme,
  persistLanguage,
  persistTheme,
  type Language,
  type Theme,
} from "@/lib/preferences";

type PreferencesValue = {
  theme: Theme;
  language: Language;
  ready: boolean;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  t: (key: CopyKey, vars?: Record<string, string | number>) => string;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({
  initialTheme,
  initialLanguage,
  children,
}: {
  initialTheme: Theme | null;
  initialLanguage: Language | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const languageSynced = useRef(false);
  const [theme, setTheme] = useState<Theme>(initialTheme ?? "dark");
  const [language, setLanguage] = useState<Language>(initialLanguage ?? "pt");
  const [themeLocked, setThemeLocked] = useState(initialTheme != null);
  const [languageLocked, setLanguageLocked] = useState(initialLanguage != null);
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      if (themeLocked) return;
      setTheme(browserTheme());
    };
    const applyLanguage = () => {
      if (languageLocked) return;
      setLanguage(browserLanguage());
    };
    themeQuery.addEventListener("change", applyTheme);
    window.addEventListener("languagechange", applyLanguage);
    const timer = window.setTimeout(() => {
      applyTheme();
      applyLanguage();
      if (languageLocked || languageSynced.current) return;
      const next = browserLanguage();
      if (next === (initialLanguage ?? "pt")) return;
      languageSynced.current = true;
      persistLanguage(next);
      setLanguage(next);
      setLanguageLocked(true);
      router.refresh();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      themeQuery.removeEventListener("change", applyTheme);
      window.removeEventListener("languagechange", applyLanguage);
    };
  }, [initialLanguage, languageLocked, router, themeLocked]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    document.documentElement.style.colorScheme = theme;
  }, [theme, language]);

  const toggleTheme = () => {
    setThemeLocked(true);
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      persistTheme(next);
      return next;
    });
  };

  const toggleLanguage = () => {
    const next = language === "pt" ? "en" : "pt";
    setLanguageLocked(true);
    setLanguage(next);
    persistLanguage(next);
    router.refresh();
  };

  const t = (key: CopyKey, vars?: Record<string, string | number>) =>
    translate(language, key, vars);

  return (
    <PreferencesContext.Provider value={{ theme, language, ready, toggleTheme, toggleLanguage, t }}>
      {children}
    </PreferencesContext.Provider>
  );
}

const preferenceFallback: PreferencesValue = {
  theme: "dark",
  language: "pt",
  ready: true,
  toggleTheme: () => undefined,
  toggleLanguage: () => undefined,
  t: (key, vars) => translate("pt", key, vars),
};

export function usePreferences() {
  return useContext(PreferencesContext) ?? preferenceFallback;
}

export function LanguageToggle() {
  const { language, toggleLanguage, t } = usePreferences();
  const isPt = language === "pt";

  return (
    <button
      type="button"
      className="preference-toggle"
      role="switch"
      aria-checked={isPt}
      title={isPt ? t("langPt") : t("langEn")}
      aria-label={isPt ? t("langPt") : t("langEn")}
      onClick={toggleLanguage}
    >
      <span className="preference-thumb" data-state={isPt ? "right" : "left"} aria-hidden="true" />
      <span className="preference-labels" aria-hidden="true">
        <span className="preference-mark preference-mark-emoji">🇺🇸</span>
        <span className="preference-mark preference-mark-emoji">🇧🇷</span>
      </span>
    </button>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme, t } = usePreferences();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="preference-toggle"
      role="switch"
      aria-checked={isDark}
      title={isDark ? t("toLight") : t("toDark")}
      aria-label={isDark ? t("toLight") : t("toDark")}
      onClick={toggleTheme}
    >
      <span className="preference-thumb" data-state={isDark ? "right" : "left"} aria-hidden="true" />
      <span className="preference-labels" aria-hidden="true">
        <span className="preference-mark">
          <Sun size={16} className="preference-icon-sun" aria-hidden="true" />
        </span>
        <span className="preference-mark">
          <Moon size={16} className={isDark ? "preference-icon-moon" : "preference-icon-muted"} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}
