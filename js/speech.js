// Pronunciation uses the browser's built-in Web Speech API (no external service).

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel();
}
