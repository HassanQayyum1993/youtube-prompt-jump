const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .trim();

const tokens = (value: string) => normalize(value).split(" ").filter(Boolean);

const tokenOverlapScore = (query: string, text: string) => {
  const q = tokens(query);
  const t = new Set(tokens(text));
  if (q.length === 0) return 0;
  const hits = q.filter((item) => t.has(item)).length;
  return hits / q.length;
};

const subsequenceScore = (query: string, text: string) => {
  const q = normalize(query);
  const t = normalize(text);
  if (!q || !t) return 0;
  let qi = 0;
  for (const ch of t) {
    if (ch === q[qi]) qi += 1;
    if (qi >= q.length) break;
  }
  return qi / q.length;
};

export const scoreMatch = (query: string, text: string) => {
  const exact = normalize(text).includes(normalize(query)) ? 1 : 0;
  const overlap = tokenOverlapScore(query, text);
  const subseq = subsequenceScore(query, text);
  return Math.max(exact, overlap * 0.9, subseq * 0.7);
};
