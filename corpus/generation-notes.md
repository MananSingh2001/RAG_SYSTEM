# Generation & Citation Notes

Generation runs through Groq using the OpenAI-compatible SDK. Retrieved chunks
are assembled into a numbered context block, and the system prompt instructs the
model to answer strictly from those numbered sources, to cite the source numbers
it used inline (like [1] or [2][3]), and to say plainly when the sources do not
contain the answer.

Generation temperature is kept low (0.2) so the model stays close to the
supplied sources rather than improvising. The response returns both the answer
and the list of sources it drew on, each with its source name, chunk index, and
similarity score.

Embeddings run through OpenRouter and generation runs through Groq. Because both
speak the OpenAI protocol, the entire codebase uses one SDK and only the base
URL and key change per provider — swapping in another provider is a one-line
base-URL change.
