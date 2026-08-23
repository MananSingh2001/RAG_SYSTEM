// Lightweight, free (no API) intent classifier so the assistant can handle
// small talk gracefully instead of forcing every input through retrieval.
// Substantive questions still go through the strict grounded RAG path.

const GREETING =
  /^\s*(hi+|hey+|hello+|hiya|yo|sup|hola|namaste|good\s+(morning|afternoon|evening)|greetings)\b[\s!.,]*$/i;

const META =
  /\b(what can you do|who are you|what are you|how do you work|what is this|what do you do|help|your capabilities|what can i ask)\b/i;

const THANKS = /^\s*(thanks|thank you|thx|ty|cheers|great|nice|cool)\b[\s!.]*$/i;

export function classifyIntent(raw) {
  const q = (raw || '').trim();
  if (!q) return 'empty';
  if (GREETING.test(q)) return 'greeting';
  if (THANKS.test(q)) return 'thanks';
  // treat short meta questions as chit-chat; longer ones may be real questions
  if (META.test(q) && q.split(/\s+/).length <= 9) return 'meta';
  return 'question';
}

// canned, honest conversational replies (no citations — these aren't corpus claims)
export const CHIT_CHAT = {
  greeting:
    "Hi! I'm sourcebound — I answer questions grounded strictly in a document corpus and cite my sources. Try asking something like “What similarity metric does the retriever use?” or “When is reranking worth it?”",
  meta:
    "I'm a grounded RAG assistant: I search a document corpus, answer only from what I retrieve, cite the sources inline, and say so honestly when the corpus doesn't cover your question. Ask me anything about the documents — from a quick definition to a deeper design question.",
  thanks: "You're welcome! Ask me anything else about the corpus.",
};
