// hit-rate@k: fraction of questions whose expected source appears
// anywhere in the top-k retrieved chunks.
export function hitRate(results) {
  const hits = results.filter((r) =>
    r.retrieved.some((c) => c.source_name === r.expected_source)
  ).length;
  return hits / (results.length || 1);
}

// MRR: mean of 1/rank of the first correct source (0 if not found).
export function mrr(results) {
  const total = results.reduce((sum, r) => {
    const rank = r.retrieved.findIndex(
      (c) => c.source_name === r.expected_source
    );
    return sum + (rank === -1 ? 0 : 1 / (rank + 1));
  }, 0);
  return total / (results.length || 1);
}

// keyword recall on the generated answer (cheap sanity check)
export function keywordRecall(results) {
  const ok = results.filter((r) => {
    if (!r.answer) return false;
    const lower = r.answer.toLowerCase();
    return (r.expected_answer_contains ?? []).every((k) =>
      lower.includes(k.toLowerCase())
    );
  }).length;
  return ok / (results.length || 1);
}
