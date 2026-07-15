/**
 * Word-level diff (LCS) for side-by-side compare UI.
 * Hard caps keep UI responsive on long articles.
 */

export type DiffOp = "equal" | "insert" | "delete";

export type DiffPart = {
  type: DiffOp;
  text: string;
};

/** Max tokens per side for full LCS (~O(n*m) memory) */
const MAX_TOKENS = 2500;
/** Max n*m product before falling back */
const MAX_PRODUCT = 800_000;

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function truncateTokens(tokens: string[], max: number): string[] {
  if (tokens.length <= max) return tokens;
  return tokens.slice(0, max);
}

/**
 * LCS-based word diff with guards for large articles.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  let A = tokenize(a);
  let B = tokenize(b);

  // Hard truncate very long texts for UI responsiveness
  if (A.length > MAX_TOKENS || B.length > MAX_TOKENS) {
    A = truncateTokens(A, MAX_TOKENS);
    B = truncateTokens(B, MAX_TOKENS);
  }

  const n = A.length;
  const m = B.length;

  if (n === 0 && m === 0) return [];
  if (n * m > MAX_PRODUCT || n === 0 || m === 0) {
    return simpleLineDiff(a.slice(0, 20000), b.slice(0, 20000));
  }

  // Compact DP: only keep previous row (less memory thrash)
  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);
  // Reconstruct via full matrix is expensive — use pair of rows + backtrack
  // via full matrix but Uint16 for speed
  const dp: Uint16Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Uint16Array(m + 1);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = (dp[i + 1][j + 1] + 1) as number;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]) as number;
    }
  }

  // silence unused
  void prev;
  void curr;

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;

  const push = (type: DiffOp, text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push("equal", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("delete", A[i]);
      i++;
    } else {
      push("insert", B[j]);
      j++;
    }
  }
  while (i < n) push("delete", A[i++]);
  while (j < m) push("insert", B[j++]);

  return parts;
}

function simpleLineDiff(a: string, b: string): DiffPart[] {
  if (a === b) return [{ type: "equal", text: a }];
  // Line-oriented cheap fallback
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const aSet = new Set(aLines);
  const bSet = new Set(bLines);
  const parts: DiffPart[] = [];
  for (const line of aLines) {
    if (bSet.has(line)) parts.push({ type: "equal", text: line + "\n" });
    else parts.push({ type: "delete", text: line + "\n" });
  }
  for (const line of bLines) {
    if (!aSet.has(line)) parts.push({ type: "insert", text: line + "\n" });
  }
  return parts;
}

/** Strip simple HTML tags for plain-text compare */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function summarizeDiff(parts: DiffPart[]): {
  equal: number;
  insert: number;
  delete: number;
  change_ratio: number;
} {
  let equal = 0;
  let insert = 0;
  let del = 0;
  for (const p of parts) {
    const w = p.text.split(/\s+/).filter(Boolean).length;
    if (p.type === "equal") equal += w;
    else if (p.type === "insert") insert += w;
    else del += w;
  }
  const total = equal + insert + del || 1;
  return {
    equal,
    insert,
    delete: del,
    change_ratio: Math.round(((insert + del) / total) * 100),
  };
}
