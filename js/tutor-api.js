// Talks to the local server (server.py), which calls the Claude API.

export async function getTutorConfig() {
  try {
    const response = await fetch('/api/tutor/config');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Sends the conversation; calls onText for each piece of the reply as it
// arrives and resolves with the complete reply text.
export async function askTutor(body, { onText, signal }) {
  const response = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    let message = `Erro ${response.status}`;
    try {
      message = (await response.json()).error ?? message;
    } catch {
      // not JSON; keep the status message
    }
    throw new Error(message);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === 'text') onText(event.text);
      else if (event.type === 'done') return event.text;
      else if (event.type === 'error') throw new Error(event.message);
    }
  }
  throw new Error('A resposta foi interrompida. Tente de novo.');
}
