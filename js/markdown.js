// Minimal, safe formatting for tutor replies: the text is HTML-escaped first,
// then only **bold**, `code`, "- " lists, paragraphs and line breaks are applied.
import { escapeHtml } from './dom.js';

function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function renderMarkdown(text) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*] /.test(line))) {
        const items = lines.map((line) => `<li>${inline(line.replace(/^\s*[-*] /, ''))}</li>`);
        return `<ul>${items.join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}

// The English part of a reply (before the Portuguese correction), for text-to-speech.
export function spokenPart(text) {
  return text.split('✏️')[0].replace(/[*`]/g, '').trim();
}
