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

// Speech-to-text (Chrome and Edge): lets the learner speak instead of typing.
const Recognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : undefined;
export const canListen = Boolean(Recognition);

// Starts listening in English; returns a function that stops it.
export function listen({ onText, onEnd }) {
  const recognition = new Recognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const text = Array.from(event.results, (result) => result[0].transcript).join(' ');
    onText(text);
  };
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();
  return () => recognition.stop();
}
