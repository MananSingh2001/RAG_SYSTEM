import OpenAI from 'openai';
import { config } from '../src/config.js';
import { withBackoff } from '../src/retry.js';

// same OpenAI SDK, pointed at Groq
const groq = new OpenAI({
  apiKey: config.groqKey,
  baseURL: config.groqBase,
});

const JUDGE_SYSTEM = `You are a strict evaluator of RAG answers.
Score two dimensions from 1 to 5:
- faithfulness: is every claim supported by the provided context?
  (5 = fully grounded, 1 = fabricated / contradicts context)
- relevance: does the answer address the question?
Return ONLY compact JSON: {"faithfulness":N,"relevance":N,"reason":"..."}`;

export async function judge({ question, answer, context }) {
  const messages = [
    { role: 'system', content: JUDGE_SYSTEM },
    {
      role: 'user',
      content: `Question: ${question}
Context given to the answerer:
${context}
Answer to evaluate:
${answer}`,
    },
  ];

  let text = '{}';
  try {
    const res = await withBackoff(
      () =>
        groq.chat.completions.create({
          model: config.judgeModel,
          // gpt-oss models spend tokens "reasoning" before the JSON, so keep
          // reasoning low and give enough budget to finish a valid document —
          // a too-small cap triggers Groq's json_validate_failed error.
          reasoning_effort: 'low',
          max_tokens: 600,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages,
        }),
      { label: 'judge' }
    );
    text = res.choices?.[0]?.message?.content ?? '{}';
  } catch (err) {
    // never let one bad judge call crash the whole eval run
    return {
      faithfulness: 0,
      relevance: 0,
      reason: `judge unavailable: ${err?.message ?? 'error'}`,
    };
  }

  try {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json);
  } catch {
    return { faithfulness: 0, relevance: 0, reason: 'unparseable judge output' };
  }
}
