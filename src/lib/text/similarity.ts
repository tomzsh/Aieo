import { stripHtml } from "@/lib/diff/text-diff";

/**
 * Text similarity for paraphrase quality checks.
 * Higher score = more similar to source (weaker paraphrase).
 */

function normalize(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 1);
}

function shingles(words: string[], size: number): Set<string> {
  const s = new Set<string>();
  if (words.length < size) {
    if (words.length) s.add(words.join(" "));
    return s;
  }
  for (let i = 0; i <= words.length - size; i++) {
    s.add(words.slice(i, i + size).join(" "));
  }
  return s;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export type SimilarityReport = {
  /** 0–100: similarity to source (100 = identical) */
  similarity: number;
  /** 0–100: how different / original (100 - similarity) */
  originality: number;
  /** word-level Jaccard 0–1 */
  token_jaccard: number;
  /** 3-gram Jaccard 0–1 */
  trigram_jaccard: number;
  /** Rough verdict for UI */
  verdict: "strong" | "moderate" | "weak" | "near_duplicate";
  method: string;
};

export function computeSimilarity(
  source: string,
  rewritten: string
): SimilarityReport {
  const srcTok = tokens(source);
  const outTok = tokens(rewritten);

  const tokenJ = jaccard(new Set(srcTok), new Set(outTok));
  const triJ = jaccard(shingles(srcTok, 3), shingles(outTok, 3));

  // Weight trigrams higher — better signal for paraphrase quality
  const combined = tokenJ * 0.35 + triJ * 0.65;
  const similarity = Math.round(Math.min(100, Math.max(0, combined * 100)));
  const originality = 100 - similarity;

  let verdict: SimilarityReport["verdict"] = "moderate";
  if (similarity >= 85) verdict = "near_duplicate";
  else if (similarity >= 70) verdict = "weak";
  else if (similarity >= 45) verdict = "moderate";
  else verdict = "strong";

  return {
    similarity,
    originality,
    token_jaccard: Math.round(tokenJ * 1000) / 1000,
    trigram_jaccard: Math.round(triJ * 1000) / 1000,
    verdict,
    method: "jaccard-token+trigram",
  };
}

export function verdictLabel(v: SimilarityReport["verdict"]): string {
  switch (v) {
    case "strong":
      return "Parafrase kuat";
    case "moderate":
      return "Parafrase sedang";
    case "weak":
      return "Masih mirip sumber";
    case "near_duplicate":
      return "Hampir duplikat";
  }
}
