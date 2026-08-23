import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// map API status -> badge label + tone class
const TONE = {
  ok: { label: 'Answer', cls: 'badge--ok' },
  chit_chat: { label: 'sourcebound', cls: 'badge--info' },
  general: { label: 'General', cls: 'badge--warn' },
  no_coverage: { label: 'No coverage', cls: 'badge--warn' },
  bad_request: { label: 'Invalid request', cls: 'badge--err' },
  retrieval_error: { label: 'Service error', cls: 'badge--err' },
  generation_error: { label: 'Service error', cls: 'badge--err' },
  empty_answer: { label: 'No answer', cls: 'badge--err' },
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
    <>
      <div className="aurora">
        <div className="aurora__cyan" />
      </div>

      <div className="page">
        <div className="container">
          <header className="header">
            <div className="brand">
              <span className="brand__dot" />
              <h1 className="title">sourcebound</h1>
            </div>
            <p className="subtitle">
              Answers grounded in your documents — every claim cited, and honest
              when the corpus doesn&rsquo;t cover the question.
            </p>
          </header>

          <form onSubmit={ask} className="form">
            <input
              className="input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about the corpus…"
              autoFocus
            />
            <button className="button" disabled={loading}>
              {loading ? (
                <span className="dots" aria-label="Thinking">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                'Ask'
              )}
            </button>
          </form>

          {error && (
            <div className="card">
              <span className="badge badge--err">
                <span className="badge__dot" />
                Error
              </span>
              <p className="answer">{error}</p>
            </div>
          )}

          {result && (
            <div className="card">
              <span className={`badge ${tone.cls}`}>
                <span className="badge__dot" />
                {tone.label}
              </span>

              <p className="answer">{result.answer || result.message}</p>

              {result.note && <p className="note">{result.note}</p>}

              {result.status === 'ok' && result.sources?.length > 0 && (
                <div className="sources">
                  <div className="sources__title">Sources</div>
                  <div className="chips">
                    {result.sources.map((s) => (
                      <span className="chip" key={s.n}>
                        <span className="chip__n">[{s.n}]</span>
                        {s.source_name}
                        <span className="chip__meta">
                          · part {s.chunk_index} · sim {s.similarity}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result && !error && !loading && (
            <p className="hint">
              Try: “What similarity metric does the retriever use?”
            </p>
          )}
        </div>
      </div>
    </>
  );
}
