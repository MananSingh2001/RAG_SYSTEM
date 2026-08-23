import { config } from './config.js';

// approximate: ~4 chars per token for English.
const charsPerChunk = config.chunkSize * 4;
const charsOverlap = config.chunkOverlap * 4;

// split on paragraph boundaries first, then pack into windows so we
// avoid cutting mid-paragraph where possible.
export function chunkDocument(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks = [];
  let buf = '';

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    // start next buffer with a tail of the last one (overlap)
    buf = buf.length > charsOverlap ? buf.slice(-charsOverlap) : '';
  };

  for (const para of paragraphs) {
    if ((buf + '\n\n' + para).length > charsPerChunk) flush();
    buf += (buf ? '\n\n' : '') + para;
    // a single very long paragraph: hard-split it
    while (buf.length > charsPerChunk) {
      chunks.push(buf.slice(0, charsPerChunk).trim());
      buf = buf.slice(charsPerChunk - charsOverlap);
    }
  }
  flush();

  return chunks.filter((c) => c.length > 0);
}
