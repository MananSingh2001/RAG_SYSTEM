import OpenAI from 'openai';
import { config } from './config.js';

// same OpenAI SDK, pointed at OpenRouter
const client = new OpenAI({
  apiKey: config.openrouterKey,
  baseURL: config.openrouterBase,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// embed a batch of strings with exponential backoff on transient errors
export async function embedTexts(texts, { retries = 4 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      const res = await client.embeddings.create({
        model: config.embedModel,
        input: texts,
        // OpenRouter: auto-failover to a backup provider on 529
        // (passed through as an extra body field)
        ...{ allow_fallbacks: true },
      });
      // preserve input order
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (err) {
      const status = err?.status ?? 0;
      const transient =
        status === 429 || status === 529 || status >= 500 || status === 0;
      if (!transient || attempt >= retries) {
        throw new Error(`Embedding failed (status ${status}): ${err.message}`);
      }
      const wait = Math.min(1000 * 2 ** attempt, 8000); // 1s,2s,4s,8s
      console.warn(`embed retry ${attempt + 1} in ${wait}ms (status ${status})`);
      await sleep(wait);
      attempt++;
    }
  }
}

export async function embedOne(text) {
  const [v] = await embedTexts([text]);
  return v;
}
