"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "aieo-theme";

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

/** Apply exclusive light|dark class on <html> — never both */
export function applyThemeClass(resolved: "light" | "dark") {
  const root = document.documentElement;
  // Remove both then add one — exclusive
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  // Help form controls / scrollbars
  try {
    document.body && (document.body.style.colorScheme = resolved);
  } catch {
    /* ignore */
  }
}

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function resolveTheme(theme: Theme, systemDark: boolean): "light" | "dark" {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false
  );

  // Always start with "system" so SSR HTML matches the first client render.
  // (Reading localStorage in useState caused hydration mismatch → white blank.)
  const [theme, setThemeState] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  const resolved = useMemo(
    () => resolveTheme(theme, systemDark),
    [theme, systemDark]
  );

  // After mount: restore saved preference, then keep class in sync
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored !== "system") {
      setThemeState(stored);
    }
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    applyThemeClass(resolved);
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, resolved, ready]);

  const setTheme = useCallback((t: Theme) => {
    const r = resolveTheme(
      t,
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    // Apply immediately (before React re-render) so toggle feels instant
    applyThemeClass(r);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const current = prev === "system" ? getSystem() : prev;
      const next: Theme = current === "dark" ? "light" : "dark";
      applyThemeClass(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
