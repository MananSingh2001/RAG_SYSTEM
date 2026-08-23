// Vercel serverless function — GET /health
export default function handler(_req, res) {
  res.status(200).json({ ok: true });
}
