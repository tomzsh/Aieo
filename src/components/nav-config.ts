import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Cpu,
  Database,
  FileText,
  Globe,
  LayoutDashboard,
  ListTodo,
  MessageSquareCode,
  Settings,
  Sparkles,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export type NavItem = {
  href: string;
  labelKey: MessageKey;
  shortLabelKey?: MessageKey;
  icon: LucideIcon;
  /** Show in mobile bottom bar */
  mobilePrimary?: boolean;
};

export const MAIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    shortLabelKey: "nav.dashboard.short",
    icon: LayoutDashboard,
    mobilePrimary: true,
  },
  {
    href: "/articles",
    labelKey: "nav.articles",
    shortLabelKey: "nav.articles.short",
    icon: FileText,
    mobilePrimary: true,
  },
  {
    href: "/articles/new",
    labelKey: "nav.new",
    shortLabelKey: "nav.new.short",
    icon: Sparkles,
    mobilePrimary: true,
  },
  {
    href: "/jobs",
    labelKey: "nav.jobs",
    shortLabelKey: "nav.jobs.short",
    icon: ListTodo,
    mobilePrimary: true,
  },
  {
    href: "/docs",
    labelKey: "nav.docs",
    shortLabelKey: "nav.docs.short",
    icon: BookOpen,
  },
  { href: "/settings/llm", labelKey: "nav.llm", icon: Cpu },
  {
    href: "/settings/prompts",
    labelKey: "nav.prompts",
    icon: MessageSquareCode,
  },
  { href: "/settings/wordpress", labelKey: "nav.wordpress", icon: Globe },
  { href: "/settings/data", labelKey: "nav.data", icon: Database },
  {
    href: "/settings",
    labelKey: "nav.settings",
    shortLabelKey: "nav.settings.short",
    icon: Settings,
    mobilePrimary: true,
  },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  // Settings hub only — subpages have their own items
  if (href === "/settings") return pathname === "/settings";
  if (href === "/articles") {
    return (
      pathname === "/articles" ||
      (pathname.startsWith("/articles/") && !pathname.startsWith("/articles/new"))
    );
  }
  if (href === "/docs") {
    return pathname === "/docs" || pathname.startsWith("/docs/");
  }
  // Nested settings routes e.g. /settings/llm
  return pathname.startsWith(`${href}/`) || pathname.startsWith(href);
}
