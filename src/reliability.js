import { config } from './config.js';
import { retrieve } from './retrieve.js';
import { generate } from './generate.js';
import { classifyIntent, CHIT_CHAT } from './intent.js';
import { generalAnswer } from './assistant.js';
import { rerankChunks } from './rerank.js';

// assistant-mode fallback: answer from general model knowledge, clearly labelled
// as NOT from the corpus. Keeps the app helpful without pretending it's grounded.
async function generalFallback(question) {
  try {
    const answer = await generalAnswer(question);
    if (!answer) {
      return {
        status: 'no_coverage',
        message: "I don't have information on that in the current documents.",
      };
    }
    return {
      status: 'general',
      answer,
      note: 'From general knowledge — not the document corpus, so no citations.',
    };
  } catch (err) {
    return {
      status: 'generation_error',
      message: 'The answer service is unavailable right now.',
      detail: err.message,
    };
  }
}

// the single entry point the server calls.
// returns a discriminated result so the caller can branch cleanly.
export async function answerQuestion(question) {
  if (!question || !question.trim()) {
    return { status: 'bad_request', message: 'Question is empty.' };
  }

  // 0. small talk: handle greetings/meta conversationally, no retrieval needed
  const intent = classifyIntent(question);
  if (intent !== 'question') {
    return { status: 'chit_chat', answer: CHIT_CHAT[intent] ?? CHIT_CHAT.meta };
  }

  // 1. retrieve (embeddings.js already retries transient failures).
  //    When reranking is on, pull a larger candidate pool to rerank from.
  let chunks;
  const pool = config.rerankEnabled ? config.candidateCount : config.topK;
  try {
    chunks = await retrieve(question, { topK: pool });
  } catch (err) {
    return {
      status: 'retrieval_error',
      message: 'Could not search the knowledge base right now.',
      detail: err.message,
    };
  }

  // 2. coverage guard: nothing cleared the threshold.
  //    - grounded mode: refuse honestly.
  //    - assistant mode: fall back to general knowledge (clearly labelled).
  if (chunks.length === 0) {
    if (config.assistantMode) return generalFallback(question);
    return {
      status: 'no_coverage',
      message: "I don't have information on that in the current documents.",
    };
  }

  // 2b. rerank the candidate pool down to topK (falls back to vector order)
  const ranked = await rerankChunks(question, chunks, config.topK);

  // 3. context-budget cap
  const capped = ranked.slice(0, config.maxContextChunks);

  // 4. generate, then validate output
  try {
    const { answer, sources } = await generate(question, capped);
    if (!answer || answer.length < 2) {
      return {
        status: 'empty_answer',
        message: 'I could not produce a grounded answer for that.',
      };
    }
    return { status: 'ok', answer, sources };
  } catch (err) {
    return {
      status: 'generation_error',
      message: 'The answer service is unavailable right now.',
      detail: err.message,
    };
  }
}
