import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/messages";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aieo — AI News SEO Optimizer",
  description:
    "Ubah draf berita mentah menjadi artikel siap terbit di WordPress dengan optimasi SEO.",
  applicationName: "Aieo",
  authors: [{ name: "tomzsh", url: "https://github.com/tomzsh" }],
  openGraph: {
    title: "Aieo — AI News SEO Optimizer",
    description:
      "Raw news drafts → SEO-ready WordPress articles. Early development — expect bugs.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * FOUC + locale cookie sync before paint (via next/script beforeInteractive).
 * Also writes aieo-locale cookie from localStorage so SSR matches next navigation.
 */
const themeInitScript = `
(function () {
  try {
    var root = document.documentElement;
    var key = "aieo-theme";
    var t = localStorage.getItem(key) || "system";
    var dark =
      t === "dark" ||
      (t === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
    root.style.colorScheme = dark ? "dark" : "light";
    root.dataset.theme = dark ? "dark" : "light";

    var loc = localStorage.getItem("aieo-locale");
    if (loc !== "en" && loc !== "id") {
      var m = document.cookie.match(/(?:^|; )aieo-locale=([^;]*)/);
      loc = m ? decodeURIComponent(m[1]) : "id";
    }
    if (loc !== "en" && loc !== "id") loc = "id";
    root.lang = loc === "en" ? "en" : "id";
    // Ensure cookie exists for SSR (avoids Artikel/Articles hydration mismatch)
    document.cookie = "aieo-locale=" + loc + ";path=/;max-age=31536000;samesite=lax";
  } catch (e) {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie is the SSR source of truth (same value for server HTML + first client render)
  const jar = await cookies();
  const raw = jar.get("aieo-locale")?.value;
  const initialLocale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const htmlLang = initialLocale === "en" ? "en" : "id";

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}
        suppressHydrationWarning
      >
        <Script
          id="aieo-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <ThemeProvider>
          <LocaleProvider initialLocale={initialLocale}>
            <noscript>
              JavaScript is required for Aieo. Enable JS, or hard-refresh
              (Ctrl+Shift+R) if the page stayed blank.
            </noscript>
            {children}
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
