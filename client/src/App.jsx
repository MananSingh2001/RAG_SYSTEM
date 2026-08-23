import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// map API status -> how the UI should present it
const TONE = {
  ok: { label: 'Answer', color: '#166534', bg: '#f0fdf4' },
  no_coverage: { label: 'No coverage', color: '#92400e', bg: '#fffbeb' },
  bad_request: { label: 'Invalid request', color: '#991b1b', bg: '#fef2f2' },
  retrieval_error: { label: 'Service error', color: '#991b1b', bg: '#fef2f2' },
  generation_error: { label: 'Service error', color: '#991b1b', bg: '#fef2f2' },
  empty_answer: { label: 'No answer', color: '#991b1b', bg: '#fef2f2' },
};

export default function App() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function ask(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const tone = result ? TONE[result.status] ?? TONE.retrieval_error : null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>docmind</h1>
          <p style={styles.subtitle}>
            Answers strictly from the document corpus — with citations, a
            coverage guard, and a reliability layer.
          </p>
        </header>

        <form onSubmit={ask} style={styles.form}>
          <input
            style={styles.input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the corpus…"
            autoFocus
          />
          <button style={styles.button} disabled={loading}>
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {error && <div style={{ ...styles.card, ...styles.errorCard }}>{error}</div>}

        {result && (
          <div style={{ ...styles.card, background: tone.bg }}>
            <div style={{ ...styles.badge, color: tone.color, borderColor: tone.color }}>
              {tone.label}
            </div>

            <p style={styles.answer}>
              {result.answer || result.message}
            </p>

            {result.status === 'ok' && result.sources?.length > 0 && (
              <div style={styles.sources}>
                <div style={styles.sourcesTitle}>Sources</div>
                {result.sources.map((s) => (
                  <div key={s.n} style={styles.source}>
                    <span style={styles.sourceNum}>[{s.n}]</span>{' '}
                    {s.source_name}
                    <span style={styles.sourceMeta}>
                      {' '}· part {s.chunk_index} · sim {s.similarity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: '#0f172a',
    padding: '40px 16px',
  },
  container: { maxWidth: 720, margin: '0 auto' },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: 700, margin: 0 },
  subtitle: { color: '#475569', marginTop: 8, lineHeight: 1.5 },
  form: { display: 'flex', gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    padding: '12px 14px',
    fontSize: 16,
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    outline: 'none',
  },
  button: {
    padding: '12px 20px',
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    background: '#2563eb',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 20,
    lineHeight: 1.6,
  },
  errorCard: { background: '#fef2f2', color: '#991b1b' },
  badge: {
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    border: '1px solid',
    borderRadius: 999,
    padding: '2px 10px',
    marginBottom: 12,
  },
  answer: { margin: 0, whiteSpace: 'pre-wrap' },
  sources: { marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 12 },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#64748b',
    marginBottom: 6,
  },
  source: { fontSize: 14, color: '#334155' },
  sourceNum: { fontWeight: 700, color: '#2563eb' },
  sourceMeta: { color: '#94a3b8' },
};
