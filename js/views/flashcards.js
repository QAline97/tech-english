import { buildQueue, review } from '../srs.js';
import { recordAnswer } from '../storage.js';
import { escapeHtml as e, speakButton } from '../dom.js';

const CATEGORY_LABELS = {
  work: 'Trabalho',
  communication: 'Comunicação',
  data: 'Dados',
  problems: 'Problemas',
};

export function renderFlashcards(ctx) {
  const queue = buildQueue(ctx.data.vocabulary, ctx.state.cards);
  let reviewed = 0;
  let knew = 0;

  if (!queue.length) {
    renderAllDone(ctx);
    return;
  }

  function showCard() {
    const card = queue[0];
    if (!card) {
      renderSessionEnd();
      return;
    }

    ctx.root.innerHTML = `
      <div class="session-header">
        <a href="#/" class="back">← Início</a>
        <span class="muted">${queue.length} ${queue.length === 1 ? 'restante' : 'restantes'}</span>
      </div>
      <article class="card">
        <span class="tag">${e(CATEGORY_LABELS[card.category] ?? card.category)}</span>
        <div class="row">
          <h2 class="term">${e(card.term)}</h2>
          ${speakButton(card.term)}
        </div>
        <p class="muted" data-hint>Você sabe o que significa? Pense antes de ver a resposta.</p>
        <div class="answer" hidden>
          <p class="translation">${e(card.translation)}</p>
          <div class="row">
            <p class="example">"${e(card.example)}"</p>
            ${speakButton(card.example)}
          </div>
          <p class="muted example-pt">${e(card.exampleTranslation)}</p>
        </div>
        <div class="actions">
          <button class="btn primary" data-action="reveal">Mostrar resposta</button>
          <button class="btn danger" data-action="wrong" hidden>Não sabia</button>
          <button class="btn success" data-action="right" hidden>Eu sabia</button>
        </div>
      </article>`;
  }

  function reveal() {
    ctx.root.querySelector('.answer').hidden = false;
    ctx.root.querySelector('[data-hint]').hidden = true;
    ctx.root.querySelector('[data-action="reveal"]').hidden = true;
    ctx.root.querySelector('[data-action="wrong"]').hidden = false;
    ctx.root.querySelector('[data-action="right"]').hidden = false;
  }

  function answer(knewIt) {
    const card = queue.shift();
    ctx.state.cards[card.id] = review(ctx.state.cards[card.id], knewIt);
    recordAnswer(ctx.state, knewIt);
    ctx.save();
    reviewed += 1;
    if (knewIt) knew += 1;
    else queue.push(card); // missed cards come back at the end of this session
    showCard();
  }

  function renderSessionEnd() {
    ctx.root.innerHTML = `
      <article class="card result">
        <h2>Great job! 🎉</h2>
        <p class="score">${knew}/${reviewed}</p>
        <p class="muted">respostas em que você já sabia a palavra.</p>
        <p>As palavras voltam para revisão nos próximos dias. Assim elas vão para a memória de longo prazo.</p>
        <div class="actions"><a class="btn primary" href="#/">Voltar ao início</a></div>
      </article>`;
  }

  ctx.root.onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'reveal') reveal();
    else if (action === 'right') answer(true);
    else if (action === 'wrong') answer(false);
  };

  showCard();
}

function renderAllDone(ctx) {
  ctx.root.innerHTML = `
    <article class="card result">
      <h2>All done for today! ✅</h2>
      <p>Você revisou todas as palavras de hoje. Volte amanhã para continuar.</p>
      <div class="actions">
        <a class="btn ghost" href="#/">Voltar ao início</a>
        <a class="btn primary" href="#/phrases">Praticar frases</a>
      </div>
    </article>`;
}
