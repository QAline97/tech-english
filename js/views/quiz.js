// Multiple-choice quiz shared by "System messages" and "Work phrases".
import { recordAnswer } from '../storage.js';
import { escapeHtml as e, shuffle, speakButton } from '../dom.js';

const SESSION_SIZE = 10;

const SITUATION_LABELS = {
  daily: 'Daily',
  chat: 'Chat',
  meeting: 'Reunião',
  email: 'E-mail',
};

function tipHtml(item) {
  return item.tip ? `<p class="tip">💡 ${e(item.tip)}</p>` : '';
}

const MODES = {
  messages: {
    title: 'Mensagens do sistema',
    prompt: (item) => `
      <span class="tag">Você vê esta mensagem na tela:</span>
      <div class="system-msg">
        <span class="level ${e(item.level)}">${e(item.level)}</span>
        <code>${e(item.message)}</code>
        ${speakButton(item.message)}
      </div>
      <p class="question">O que essa mensagem quer dizer?</p>`,
    feedback: (item) => `
      <p><strong>${e(item.answer)}</strong></p>
      <ul class="keywords">
        ${item.keywords.map((k) => `<li><strong>${e(k.en)}</strong> = ${e(k.pt)}</li>`).join('')}
      </ul>
      ${tipHtml(item)}`,
  },
  phrases: {
    title: 'Frases do trabalho',
    prompt: (item) => `
      <span class="tag">${e(SITUATION_LABELS[item.situation] ?? item.situation)}</span>
      <p class="context">${e(item.context)}</p>
      <p class="question">O que você diria?</p>`,
    feedback: (item) => `
      <div class="row">
        <p class="example">"${e(item.answer)}"</p>
        ${speakButton(item.answer)}
      </div>
      <p class="muted example-pt">${e(item.translation)}</p>
      ${tipHtml(item)}`,
  },
};

export function renderQuiz(ctx, mode) {
  const config = MODES[mode];
  const items = shuffle(ctx.data[mode]).slice(0, SESSION_SIZE);
  let index = 0;
  let score = 0;
  let options = [];
  let answered = false;

  function showQuestion() {
    const item = items[index];
    if (!item) {
      showResult();
      return;
    }
    options = shuffle([item.answer, ...item.distractors]);
    answered = false;

    ctx.root.innerHTML = `
      <div class="session-header">
        <a href="#/" class="back">← Início</a>
        <span class="muted">${config.title} · ${index + 1}/${items.length}</span>
      </div>
      <div class="progress"><div style="width: ${(index / items.length) * 100}%"></div></div>
      <article class="card">
        ${config.prompt(item)}
        <div class="options">
          ${options.map((text, i) => `<button class="option" data-option="${i}">${e(text)}</button>`).join('')}
        </div>
        <div class="feedback" hidden></div>
        <div class="actions">
          <button class="btn primary" data-action="next" hidden>${index + 1 < items.length ? 'Próxima →' : 'Ver resultado'}</button>
        </div>
      </article>`;
  }

  function choose(optionIndex) {
    if (answered) return;
    answered = true;
    const item = items[index];
    const isRight = options[optionIndex] === item.answer;
    if (isRight) score += 1;

    ctx.root.querySelectorAll('.option').forEach((button, i) => {
      button.disabled = true;
      if (options[i] === item.answer) button.classList.add('correct');
      else if (i === optionIndex) button.classList.add('wrong');
    });

    const feedback = ctx.root.querySelector('.feedback');
    feedback.innerHTML = `
      <p class="verdict">${isRight ? '✅ Correct! Isso mesmo!' : '❌ Not quite. A resposta certa é:'}</p>
      ${config.feedback(item)}`;
    feedback.hidden = false;
    ctx.root.querySelector('[data-action="next"]').hidden = false;

    recordAnswer(ctx.state, isRight);
    ctx.save();
  }

  function showResult() {
    const ratio = score / items.length;
    const message =
      ratio === 1 ? 'Perfect! Você acertou tudo! 🏆'
      : ratio >= 0.7 ? 'Well done! Muito bom! 💪'
      : 'Keep practicing! Cada erro é aprendizado. 📚';

    ctx.root.innerHTML = `
      <article class="card result">
        <h2>${message}</h2>
        <p class="score">${score}/${items.length}</p>
        <div class="actions">
          <a class="btn ghost" href="#/">Voltar ao início</a>
          <button class="btn primary" data-action="again">Jogar de novo</button>
        </div>
      </article>`;
  }

  ctx.root.onclick = (event) => {
    const option = event.target.closest('[data-option]');
    if (option) {
      choose(Number(option.dataset.option));
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'next') {
      index += 1;
      showQuestion();
      window.scrollTo(0, 0);
    } else if (action === 'again') {
      renderQuiz(ctx, mode);
    }
  };

  showQuestion();
}
