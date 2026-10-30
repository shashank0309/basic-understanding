export function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function topK<T>(query: number[], items: { item: T; embedding: number[] }[], k: number): { item: T; score: number }[] {
  return items
    .map((i) => ({ item: i.item, score: cosine(query, i.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
