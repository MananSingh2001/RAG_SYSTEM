import express from 'express';
import { answerQuestion } from './reliability.js';

const app = express();
app.use(express.json());

// minimal CORS so the Vite dev client can call the API (no extra dependency).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/ask', async (req, res) => {
  const { question } = req.body ?? {};
  const result = await answerQuestion(question);

  const codeByStatus = {
    ok: 200,
    chit_chat: 200, // greeting / meta small talk
    no_coverage: 200, // a valid, honest answer
    bad_request: 400,
    retrieval_error: 503,
    generation_error: 503,
    empty_answer: 502,
  };

  res.status(codeByStatus[result.status] ?? 500).json(result);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`sourcebound on :${port}`));
