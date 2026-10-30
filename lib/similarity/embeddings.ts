// Local, deterministic text embeddings (hashed bag of words + bigrams).
// Prototype choice: no external embedding API is needed, so the demo works offline.
// Production: replace with provider embeddings + pgvector / Databricks Vector Search.

const STOP = new Set(
  "a an the and or but of to in on for with at by from as is are was were be been it its this that these those we our us you your they their them i my me so not no do does did can could should would will shall may might have has had into over than then there here what which who whom when where why how all any each more most other some such only own same too very just also per via about after before during up down out off again further once take takes taking too long spend spends hour hours make get gets many much often lot lots".split(" "),
);

const SYNONYMS: Record<string, string> = {
  procedure: "sop", procedur: "sop", sops: "sop", spreadsheet: "excel", xlsx: "excel", sheet: "excel",
  rep: "representative", reps: "representative", mr: "representative", field: "representative",
  dashboard: "report", reports: "report", reporting: "report",
  question: "query", questions: "query", queries: "query", faq: "query",
  literatur: "literature", article: "document", articles: "document", doc: "document", docs: "document",
  forecast: "predict", forecasting: "predict", prediction: "predict",
  review: "review", reviewer: "review", reviewing: "review",
  harmonis: "harmoniz", harmonize: "harmoniz", harmonise: "harmoniz",
};

export function stem(w: string): string {
  let s = w;
  for (const suf of ["ations", "ation", "ings", "ing", "ies", "ed", "es", "s"]) {
    if (s.length > suf.length + 3 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length) + (suf === "ies" ? "y" : "");
      break;
    }
  }
  return SYNONYMS[s] ?? SYNONYMS[w] ?? s;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const DIM = 512;

export function embed(text: string): number[] {
  const v = new Array(DIM).fill(0);
  const toks = tokenize(text);
  const tf = new Map<string, number>();
  toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
  for (let i = 0; i < toks.length - 1; i++) tf.set(`${toks[i]}_${toks[i + 1]}`, (tf.get(`${toks[i]}_${toks[i + 1]}`) ?? 0) + 0.5);
  for (const [t, n] of tf) {
    const h = hash(t);
    v[h % DIM] += (h & 1 ? 1 : -1) * Math.sqrt(n);
  }
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => Math.round((x / norm) * 1e5) / 1e5);
}
