import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
  type MessageKey,
  translate,
} from "@/lib/i18n/messages";

export async function getServerLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const v = jar.get(LOCALE_COOKIE)?.value;
    if (isLocale(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export async function getServerT() {
  const locale = await getServerLocale();
  return {
    locale,
    t: (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
  };
}
