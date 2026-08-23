import OpenAI from 'openai';
import { config } from './config.js';
import { withBackoff } from './retry.js';

// same OpenAI SDK, pointed at Groq
const groq = new OpenAI({
  apiKey: config.groqKey,
  baseURL: config.groqBase,
});

const SYSTEM = `You are a precise assistant that answers strictly from the
provided sources. Rules:
- Use ONLY the numbered sources below. Do not use outside knowledge.
- Cite the source number(s) you used inline like [1] or [2][3].
- If the sources do not contain the answer, say so plainly and do not guess.
- Be concise and factual.`;

function buildContext(chunks) {
  // number sources so the model can cite them; keep provenance visible
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] (from ${c.source_name}, part ${c.chunk_index})\n${c.content}`
    )
    .join('\n\n');
}

export async function generate(question, chunks) {
  const context = buildContext(chunks);

  const res = await withBackoff(
    () =>
      groq.chat.completions.create({
        model: config.genModel,
        max_tokens: 1024,
        temperature: 0.2, // low = stick to the sources
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Sources:\n\n${context}\n\nQuestion: ${question}`,
          },
        ],
      }),
    { label: 'generate' }
  );

  const answer = (res.choices?.[0]?.message?.content ?? '').trim();
  const sources = chunks.map((c, i) => ({
    n: i + 1,
    source_name: c.source_name,
    chunk_index: c.chunk_index,
    similarity: Number(c.similarity?.toFixed(3)),
  }));

  return { answer, sources };
}
