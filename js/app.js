import { loadState, saveState } from './storage.js';
import { speak, stopSpeaking } from './speech.js';
import { renderHome } from './views/home.js';
import { renderFlashcards } from './views/flashcards.js';
import { renderQuiz } from './views/quiz.js';
import { renderTutor } from './views/tutor.js';

const DATA_FILES = {
  vocabulary: 'data/vocabulary.json',
  messages: 'data/messages.json',
  phrases: 'data/phrases.json',
};

const routes = {
  '/': renderHome,
  '/flashcards': renderFlashcards,
  '/messages': (ctx) => renderQuiz(ctx, 'messages'),
  '/phrases': (ctx) => renderQuiz(ctx, 'phrases'),
  '/tutor': renderTutor,
};

// Shared context passed to every view.
const ctx = {
  root: document.getElementById('app'),
  data: null,
  state: loadState(),
  cleanup: null, // optional function a view sets to stop its work when the user leaves
  save() {
    saveState(this.state);
  },
};

async function loadData() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
      return [key, await response.json()];
    }),
  );
  return Object.fromEntries(entries);
}

function router() {
  const path = location.hash.slice(1) || '/';
  const view = routes[path] ?? renderHome;
  stopSpeaking();
  ctx.cleanup?.();
  ctx.cleanup = null;
  ctx.root.onclick = null; // each view installs its own click handler
  window.scrollTo(0, 0);
  view(ctx);
}

async function start() {
  try {
    ctx.data = await loadData();
  } catch (err) {
    console.error(err);
    ctx.root.innerHTML = `
      <div class="card error-card">
        <h2>Não foi possível carregar o conteúdo</h2>
        <p>Abra o app por um servidor local. Na pasta do projeto, rode:</p>
        <p><code>python server.py</code></p>
        <p>e acesse <code>http://localhost:8000</code>.</p>
      </div>`;
    return;
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-speak]');
    if (button) speak(button.dataset.speak);
  });
  window.addEventListener('hashchange', router);
  router();
}

start();
