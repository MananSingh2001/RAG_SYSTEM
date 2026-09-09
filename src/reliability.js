import { config } from './config.js';
import { retrieve } from './retrieve.js';
import { generate } from './generate.js';
import { classifyIntent, CHIT_CHAT } from './intent.js';
import { generalAnswer } from './assistant.js';
import { rerankChunks } from './rerank.js';
import { startTrace, withSpan, endTrace } from './tracing.js';

// assistant-mode fallback: answer from general model knowledge, clearly labelled
// as NOT from the corpus. Keeps the app helpful without pretending it's grounded.
async function generalFallback(question, trace) {
  try {
    const { answer, usage } = await withSpan(
      trace,
      'assistant-fallback',
      () => generalAnswer(question),
      { question }
    );
    if (!answer) {
      return {
        status: 'no_coverage',
        message: "I don't have information on that in the current documents.",
      };
    }
    return {
      status: 'general',
      answer,
      usage,
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

  const trace = startTrace('answer-question', { question });

  // 0. small talk: handle greetings/meta conversationally, no retrieval needed
  const intent = classifyIntent(question);
  if (intent !== 'question') {
    const result = { status: 'chit_chat', answer: CHIT_CHAT[intent] ?? CHIT_CHAT.meta };
    endTrace(trace, result);
    return result;
  }

  // 1. retrieve (embeddings.js already retries transient failures).
  //    When reranking is on, pull a larger candidate pool to rerank from.
  let chunks;
  const pool = config.rerankEnabled ? config.candidateCount : config.topK;
  try {
    chunks = await withSpan(trace, 'retrieve', () => retrieve(question, { topK: pool }), {
      question,
      pool,
    });
  } catch (err) {
    const result = {
      status: 'retrieval_error',
      message: 'Could not search the knowledge base right now.',
      detail: err.message,
    };
    endTrace(trace, result);
    return result;
  }

  // 2. coverage guard: nothing cleared the threshold.
  //    - grounded mode: refuse honestly.
  //    - assistant mode: fall back to general knowledge (clearly labelled).
  if (chunks.length === 0) {
    if (config.assistantMode) {
      const result = await generalFallback(question, trace);
      endTrace(trace, result);
      return result;
    }
    const result = {
      status: 'no_coverage',
      message: "I don't have information on that in the current documents.",
    };
    endTrace(trace, result);
    return result;
  }

  // 2b. rerank the candidate pool down to topK (falls back to vector order)
  const ranked = await withSpan(
    trace,
    'rerank',
    () => rerankChunks(question, chunks, config.topK),
    { candidateCount: chunks.length }
  );

  // 3. context-budget cap
  const capped = ranked.slice(0, config.maxContextChunks);

  // 4. generate, then validate output
  try {
    const { answer, sources, usage } = await withSpan(
      trace,
      'generate',
      () => generate(question, capped),
      { question, chunkCount: capped.length }
    );
    if (!answer || answer.length < 2) {
      const result = {
        status: 'empty_answer',
        message: 'I could not produce a grounded answer for that.',
      };
      endTrace(trace, result);
      return result;
    }
    const result = { status: 'ok', answer, sources, usage };
    endTrace(trace, result);
    return result;
  } catch (err) {
    const result = {
      status: 'generation_error',
      message: 'The answer service is unavailable right now.',
      detail: err.message,
    };
    endTrace(trace, result);
    return result;
  }
}
