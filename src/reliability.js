import { config } from './config.js';
import { retrieve } from './retrieve.js';
import { generate } from './generate.js';

// the single entry point the server calls.
// returns a discriminated result so the caller can branch cleanly.
export async function answerQuestion(question) {
  if (!question || !question.trim()) {
    return { status: 'bad_request', message: 'Question is empty.' };
  }

  // 1. retrieve (embeddings.js already retries transient failures)
  let chunks;
  try {
    chunks = await retrieve(question);
  } catch (err) {
    return {
      status: 'retrieval_error',
      message: 'Could not search the knowledge base right now.',
      detail: err.message,
    };
  }

  // 2. coverage guard: if nothing cleared the threshold, refuse honestly
  if (chunks.length === 0) {
    return {
      status: 'no_coverage',
      message: "I don't have information on that in the current documents.",
    };
  }

  // 3. context-budget cap
  const capped = chunks.slice(0, config.maxContextChunks);

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
