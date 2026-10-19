import { createState, currentStreak } from '../storage.js';
import { buildQueue, MASTERED_BOX } from '../srs.js';

export function renderHome(ctx) {
  const { state, data } = ctx;
  const dueCount = buildQueue(data.vocabulary, state.cards).length;
  const mastered = Object.values(state.cards).filter((p) => p.box >= MASTERED_BOX).length;
  const { answered, correct } = state.stats;
  const accuracy = answered ? `${Math.round((correct / answered) * 100)}%` : '—';

  ctx.root.innerHTML = `
    <section class="hero">
      <h1>Hi there! Vamos praticar? 👋</h1>
      <p class="muted">Inglês do dia a dia de TI, um pouco por vez.</p>
    </section>

    <section class="stats">
      <div class="card stat"><strong>🔥 ${currentStreak(state)}</strong><span>dias seguidos</span></div>
      <div class="card stat"><strong>${mastered}/${data.vocabulary.length}</strong><span>palavras dominadas</span></div>
      <div class="card stat"><strong>${accuracy}</strong><span>de acertos</span></div>
    </section>

    <section class="modes">
      <a class="card mode" href="#/flashcards">
        <span class="mode-icon">🗂️</span>
        <h2>Vocabulário</h2>
        <p>Flashcards com palavras que aparecem no trabalho.</p>
        <span class="badge">${dueCount ? `${dueCount} para hoje` : 'em dia ✓'}</span>
      </a>
      <a class="card mode" href="#/messages">
        <span class="mode-icon">⚠️</span>
        <h2>Mensagens do sistema</h2>
        <p>Entenda erros, avisos e alertas em inglês.</p>
        <span class="badge">${data.messages.length} mensagens</span>
      </a>
      <a class="card mode" href="#/phrases">
        <span class="mode-icon">💬</span>
        <h2>Frases do trabalho</h2>
        <p>O que dizer na daily, no chat, em reuniões e e-mails.</p>
        <span class="badge">${data.phrases.length} frases</span>
      </a>
    </section>

    <section class="reset">
      <button class="link-btn" data-action="reset">Zerar meu progresso</button>
    </section>`;

  let confirmTimer = null;
  ctx.root.onclick = (event) => {
    const button = event.target.closest('[data-action="reset"]');
    if (!button) return;
    if (!confirmTimer) {
      button.textContent = 'Tem certeza? Clique de novo para zerar';
      confirmTimer = setTimeout(() => {
        button.textContent = 'Zerar meu progresso';
        confirmTimer = null;
      }, 4000);
      return;
    }
    clearTimeout(confirmTimer);
    ctx.state = createState();
    ctx.save();
    renderHome(ctx);
  };
}
