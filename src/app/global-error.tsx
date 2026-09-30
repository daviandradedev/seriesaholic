"use client";

import { useEffect } from "react";
import { translate } from "@/lib/copy";
import { readLanguageCookie } from "@/lib/preferences";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const language = readLanguageCookie(
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split("; ")
          .find((part) => part.startsWith("language="))
          ?.split("=")[1],
  ) ?? "pt";
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <html
      lang={language === "pt" ? "pt-BR" : "en"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0f] text-zinc-100">
        <div className="mx-auto flex min-h-full max-w-6xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="mb-3 font-mono text-sm tracking-[0.2em] text-violet-400/80">
            ERRO
          </p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            {t("appUnavailable")}
          </h1>
          <p className="mt-3 max-w-md text-sm text-zinc-400 sm:text-base">
            {t("globalErrorBody")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              {t("tryAgain")}
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.assign("/");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              {t("home")}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
