import { canSpeak } from './speech.js';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Speaker button; clicks are handled globally in app.js via [data-speak].
export function speakButton(text) {
  if (!canSpeak) return '';
  return `<button class="icon-btn" data-speak="${escapeHtml(text)}" aria-label="Ouvir pronúncia" title="Ouvir pronúncia">🔊</button>`;
}
