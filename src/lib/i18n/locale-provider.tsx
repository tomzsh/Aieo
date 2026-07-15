"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
  type MessageKey,
  translate,
} from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function persistLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale === "en" ? "en" : "id";
  }
}

/**
 * initialLocale MUST match server render (from cookie) to avoid hydration mismatch.
 * localStorage is only applied after mount if it differs (one-time migrate).
 */
export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const safeInitial = isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState<Locale>(safeInitial);

  // After hydration: migrate localStorage → state/cookie if user had EN stored
  // without cookie (first paint still matched server; brief switch is ok).
  useEffect(() => {
    try {
      const ls = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(ls) && ls !== safeInitial) {
        setLocaleState(ls);
        persistLocale(ls);
        return;
      }
      // Keep cookie/localStorage in sync with SSR locale
      persistLocale(safeInitial);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only migrate
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    persistLocale(l);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === "id" ? "en" : "id";
      persistLocale(next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
