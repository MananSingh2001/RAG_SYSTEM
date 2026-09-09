// General assistant path (assistant mode). Used when the corpus has no coverage
// but we still want to help — normal conversation and minor tasks (summarise,
// rewrite, quick math, brainstorm). Answers come from the model's own knowledge,
// NOT the document corpus, so the caller labels them clearly as ungrounded.
import OpenAI from 'openai';
import { config } from './config.js';
import { withBackoff } from './retry.js';

const groq = new OpenAI({ apiKey: config.groqKey, baseURL: config.groqBase });

const SYSTEM = `You are sourcebound, a helpful, friendly assistant.
You are answering from your own general knowledge because the user's document
corpus did not cover this. Be concise and accurate. You can hold normal
conversation and do small tasks (summarise, rewrite, explain, simple math,
brainstorming). If you are unsure or a question needs current/real-time facts you
cannot verify, say so plainly rather than guessing.`;

export async function generalAnswer(question) {
  const res = await withBackoff(
    () =>
      groq.chat.completions.create({
        model: config.genModel,
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: question },
        ],
      }),
    { label: 'assistant' }
  );
  return {
    answer: (res.choices?.[0]?.message?.content ?? '').trim(),
    usage: {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    },
  };
}
