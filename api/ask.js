// Vercel serverless function — POST /ask
// Reuses the same logic as the local Express server (answerQuestion), so
// behaviour is identical in dev (npm run serve) and in production.
//
// NOTE: reliability.js -> retrieve/generate/judge build the Supabase and Groq
// clients at import time, which THROW if their env vars are missing. So we
// check env first and only then dynamically import — turning an opaque
// FUNCTION_INVOCATION_FAILED crash into a clear, actionable JSON error.

const codeByStatus = {
  ok: 200,
  chit_chat: 200, // greeting / meta small talk
  no_coverage: 200, // a valid, honest answer
  bad_request: 400,
  retrieval_error: 503,
  generation_error: 503,
  empty_answer: 502,
  config_error: 500,
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

  // fail loudly and clearly if the deployment is missing its secrets
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({
      status: 'config_error',
      message: `Server is missing environment variables: ${missing.join(', ')}. Set them in the Vercel project settings and redeploy.`,
    });
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

  // dynamic import so the env check above runs before client construction
  const { answerQuestion } = await import('../src/reliability.js');
  const result = await answerQuestion(question);
  return res.status(codeByStatus[result.status] ?? 500).json(result);
}
