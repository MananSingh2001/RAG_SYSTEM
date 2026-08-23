import OpenAI from 'openai';
import { config } from '../src/config.js';

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
  const res = await groq.chat.completions.create({
    model: config.judgeModel,
    max_tokens: 300,
    temperature: 0,
    // Groq supports JSON mode on most instruct models:
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      {
        role: 'user',
        content: `Question: ${question}
Context given to the answerer:
${context}
Answer to evaluate:
${answer}`,
      },
    ],
  });

  const text = res.choices?.[0]?.message?.content ?? '{}';
  try {
    // json_object mode should return clean JSON; belt-and-braces parse
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json);
  } catch {
    return { faithfulness: 0, relevance: 0, reason: 'unparseable judge output' };
  }
}
