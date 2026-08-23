// Vercel serverless function — POST /ask
// Reuses the exact same logic as the local Express server (answerQuestion),
// so behaviour is identical in dev (npm run serve) and in production.
import { answerQuestion } from '../src/reliability.js';

const codeByStatus = {
  ok: 200,
  no_coverage: 200, // a valid, honest answer
  bad_request: 400,
  retrieval_error: 503,
  generation_error: 503,
  empty_answer: 502,
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ status: 'bad_request', message: 'Use POST with a JSON body.' });
  }

  // Vercel parses JSON bodies, but guard for the string/edge cases.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const question = body?.question;

  const result = await answerQuestion(question);
  return res.status(codeByStatus[result.status] ?? 500).json(result);
}
