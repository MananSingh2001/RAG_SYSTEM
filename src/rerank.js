// Cross-encoder reranking via Cohere Rerank (v2). Vector search is fast but
// ranks by embedding similarity, which is only an approximation of relevance;
// a reranker re-scores the candidate pool with a model that reads the query and
// each passage together, so the truly-relevant chunk lands at the top.
//
// Optional and safe: if COHERE_API_KEY is unset or the call fails, we return the
// vector-ordered chunks unchanged — reranking never breaks the pipeline.
import { config } from './config.js';
import { withBackoff } from './retry.js';

export async function rerankChunks(question, chunks, topN) {
  if (!config.rerankEnabled || chunks.length <= 1) {
    return chunks.slice(0, topN);
  }

  try {
    const call = async () => {
      const res = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.cohereKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.rerankModel,
          query: question,
          documents: chunks.map((c) => c.content),
          top_n: Math.min(topN, chunks.length),
        }),
      });
      if (!res.ok) {
        // surface status so withBackoff can retry 429/5xx (free tier: 10/min)
        const err = new Error(`rerank HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    };

    const data = await withBackoff(call, { label: 'rerank' });
    const results = data?.results ?? [];
    if (!results.length) return chunks.slice(0, topN);

    // map Cohere's ranked indices back to our chunk objects, keep the score
    return results
      .map((r) =>
        chunks[r.index]
          ? { ...chunks[r.index], rerankScore: r.relevance_score }
          : null
      )
      .filter(Boolean);
  } catch (err) {
    console.warn(`rerank failed, using vector order: ${err.message}`);
    return chunks.slice(0, topN);
  }
}
