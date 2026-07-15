/**
 * Public site metadata — safe for client components.
 * Override GitHub URL with NEXT_PUBLIC_GITHUB_URL if the repo path differs.
 */
export const SITE = {
  name: "Aieo",
  tagline: "AI News SEO Optimizer & WordPress Publisher",
  version: "0.1.0",
  /** Primary GitHub repository */
  githubUrl:
    process.env.NEXT_PUBLIC_GITHUB_URL?.trim() ||
    "https://github.com/tomzsh/aieo",
  githubOwner: "tomzsh",
  githubRepo: "aieo",
} as const;
