import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { translate } from "@/lib/copy";
import { GuestClaim, GuestSessionModal } from "@/components/GuestSessionModal";
import { NavBar } from "@/components/NavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { PreferencesProvider } from "@/components/Preferences";
import { TopLoader } from "@/components/TopLoader";
import { getCurrentUser } from "@/lib/api/auth";
import { readLanguageCookie, readThemeCookie } from "@/lib/preferences";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = readLanguageCookie(cookieStore.get("language")?.value) ?? "pt";
  return {
    title: "SERIESAHOLIC",
    description: translate(language, "metaDescription"),
    manifest: "/manifest.json",
  };
}

export const viewport = {
  themeColor: "#7c3aed",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const initialTheme = readThemeCookie(cookieStore.get("theme")?.value);
  const initialLanguage = readLanguageCookie(cookieStore.get("language")?.value);

  return (
    <html
      lang={initialLanguage === "en" ? "en" : "pt-BR"}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${initialTheme === "light" ? "" : " dark"}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[#0a0a0f] text-zinc-100">
        <PreferencesProvider initialTheme={initialTheme} initialLanguage={initialLanguage}>
          <TopLoader />
          {user ? <GuestClaim /> : <GuestSessionModal />}
          <NavBar
            user={
              user
                ? {
                    email: user.email,
                    name: user.name,
                    image: user.image,
                  }
                : null
            }
          />
          <main className="site-main">{children}</main>
          <SiteFooter />
        </PreferencesProvider>
      </body>
    </html>
  );
}
