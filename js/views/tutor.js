// AI tutor: free conversation, practice of the learner's mistakes, and role-plays.
import { getTutorConfig, askTutor } from '../tutor-api.js';
import { renderMarkdown, spokenPart } from '../markdown.js';
import { weakItemIds, currentStreak } from '../storage.js';
import { canListen, listen } from '../speech.js';
import { escapeHtml as e, shuffle, speakButton } from '../dom.js';

const MAX_HISTORY = 59; // the server accepts up to 60 messages per request
const PRACTICE_FALLBACK_SIZE = 8;
const FINISH_MESSAGE = "I'd like to finish now. Can you give me feedback?";

export async function renderTutor(ctx) {
  ctx.root.innerHTML = '<p class="muted">Carregando o tutor...</p>';
  const config = await getTutorConfig();
  if (location.hash !== '#/tutor') return; // the learner navigated away meanwhile

  if (!config) {
    renderSetup(ctx, `
      <p>O tutor de IA precisa do servidor do projeto. Na pasta do projeto, rode:</p>
      <p><code>python server.py</code></p>
      <p>e acesse <code>http://localhost:8000</code>.</p>`);
  } else if (!config.configured) {
    renderSetup(ctx, `
      <p>Falta configurar a chave da API do Claude:</p>
      <ol>
        <li>Crie uma chave em <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">platform.claude.com</a>.</li>
        <li>Copie o arquivo <code>.env.example</code> para <code>.env</code> e cole a chave em <code>ANTHROPIC_API_KEY=</code>.</li>
        <li>Reinicie o servidor (<code>python server.py</code>) e recarregue esta página.</li>
      </ol>`);
  } else {
    renderMenu(ctx, config);
  }
}

function renderSetup(ctx, body) {
  ctx.root.innerHTML = `
    <div class="session-header"><a href="#/" class="back">← Início</a></div>
    <article class="card">
      <h2>🤖 Tutor de IA</h2>
      ${body}
    </article>`;
}

function renderMenu(ctx, config) {
  const weakCount = weakItemIds(ctx.state).length;
  ctx.root.innerHTML = `
    <div class="session-header"><a href="#/" class="back">← Início</a></div>
    <section class="hero">
      <h1>🤖 Tutor de IA</h1>
      <p class="muted">Pratique escrevendo (ou falando) em inglês. O tutor corrige e explica em português.</p>
    </section>

    <section class="modes">
      <button class="card mode" data-mode="chat">
        <span class="mode-icon">💬</span>
        <h2>Conversa livre</h2>
        <p>Converse sobre o seu trabalho em TI, no seu ritmo.</p>
      </button>
      <button class="card mode" data-mode="practice">
        <span class="mode-icon">🎯</span>
        <h2>Praticar meus erros</h2>
        <p>${weakCount
          ? 'Exercícios com as palavras, mensagens e frases que você errou no app.'
          : 'Você ainda não tem erros registrados: vamos praticar palavras essenciais.'}</p>
        <span class="badge">${weakCount ? `${weakCount} ${weakCount === 1 ? 'item' : 'itens'}` : 'palavras-chave'}</span>
      </button>
    </section>

    <h2 class="section-title">Simulações</h2>
    <section class="modes">
      ${config.scenarios.map((s) => `
        <button class="card mode" data-mode="roleplay" data-scenario="${e(s.id)}">
          <span class="mode-icon">${e(s.icon)}</span>
          <h2>${e(s.title)}</h2>
          <p>${e(s.description)}</p>
        </button>`).join('')}
    </section>`;

  ctx.root.onclick = (event) => {
    const button = event.target.closest('[data-mode]');
    if (!button) return;
    const { mode, scenario } = button.dataset;
    const title = mode === 'chat' ? 'Conversa livre'
      : mode === 'practice' ? 'Praticar meus erros'
      : config.scenarios.find((s) => s.id === scenario).title;
    renderSession(ctx, config, { mode, scenario, title });
  };
}

// Snapshot of the learner's progress, taken once per session so every request
// in the conversation builds the same system prompt on the server.
function progressSnapshot(ctx, mode) {
  let weakIds = weakItemIds(ctx.state);
  if (mode === 'practice' && !weakIds.length) {
    weakIds = shuffle(ctx.data.vocabulary).slice(0, PRACTICE_FALLBACK_SIZE).map((v) => v.id);
  }
  const { answered, correct } = ctx.state.stats;
  return { weakIds, stats: { answered, correct, streak: currentStreak(ctx.state) } };
}

function renderSession(ctx, config, { mode, scenario, title }) {
  const progress = progressSnapshot(ctx, mode);
  const history = []; // [{ role: 'assistant' | 'user', content }]
  let busy = false;
  let closed = false; // the conversation reached its length limit
  let controller = null;
  let stopListening = null;

  ctx.root.innerHTML = `
    <div class="session-header">
      <button class="link-btn back" data-action="menu">← Tutor</button>
      <span class="muted">${e(title)}</span>
    </div>
    <div class="chat" aria-live="polite"></div>
    <div class="chat-notice card error-card" hidden></div>
    <form class="composer card">
      <textarea rows="2" maxlength="2000" placeholder="Write in English... (Enter envia, Shift+Enter pula linha)" aria-label="Sua mensagem"></textarea>
      <div class="composer-actions">
        ${canListen ? '<button type="button" class="icon-btn" data-action="mic" title="Falar em inglês" aria-label="Falar em inglês">🎤</button>' : ''}
        ${mode === 'roleplay' ? '<button type="button" class="btn ghost" data-action="finish">Terminar e ver feedback</button>' : ''}
        <button type="submit" class="btn primary">Enviar</button>
      </div>
    </form>`;

  const chat = ctx.root.querySelector('.chat');
  const notice = ctx.root.querySelector('.chat-notice');
  const form = ctx.root.querySelector('.composer');
  const input = form.querySelector('textarea');

  ctx.cleanup = () => {
    controller?.abort();
    stopListening?.();
  };

  function addBubble(role, html) {
    const bubble = document.createElement('div');
    bubble.className = `msg ${role}`;
    bubble.innerHTML = `<div class="msg-body">${html}</div>`;
    chat.append(bubble);
    bubble.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return bubble;
  }

  function setBusy(value) {
    busy = value;
    form.querySelectorAll('button, textarea').forEach((el) => { el.disabled = value || closed; });
    if (!value && !closed) input.focus();
  }

  function showNotice(message, retry = false) {
    notice.innerHTML = `<p>${e(message)}</p>${retry ? '<button class="btn primary" data-action="retry">Tentar de novo</button>' : ''}`;
    notice.hidden = false;
  }

  async function requestReply() {
    notice.hidden = true;
    setBusy(true);
    const bubble = addBubble('tutor', '<span class="typing">digitando…</span>');
    const body = bubble.querySelector('.msg-body');
    controller = new AbortController();
    let partial = '';
    try {
      const reply = await askTutor(
        { mode, scenario, progress, messages: history },
        {
          signal: controller.signal,
          onText(text) {
            partial += text;
            body.innerHTML = renderMarkdown(partial);
            bubble.scrollIntoView({ block: 'end' });
          },
        },
      );
      history.push({ role: 'assistant', content: reply });
      body.innerHTML = renderMarkdown(reply);
      bubble.insertAdjacentHTML('beforeend', speakButton(spokenPart(reply)));
      if (history.length >= MAX_HISTORY) {
        closed = true;
        showNotice('Esta conversa chegou ao limite. Volte ao menu para começar uma nova sessão.');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      bubble.remove();
      if (history.at(-1)?.role === 'user') {
        // Undo the learner's message so they can edit and send it again.
        input.value = history.pop().content;
        chat.lastElementChild?.remove();
      }
      showNotice(err.message, history.length === 0);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function send(text) {
    text = text.trim();
    if (!text || busy) return;
    history.push({ role: 'user', content: text });
    addBubble('user', e(text).replace(/\n/g, '<br>'));
    input.value = '';
    requestReply();
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    send(input.value);
  };
  input.onkeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      send(input.value);
    }
  };

  ctx.root.onclick = (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'menu') {
      ctx.cleanup();
      ctx.cleanup = null;
      renderMenu(ctx, config);
    } else if (action === 'retry') {
      requestReply();
    } else if (action === 'finish') {
      send(FINISH_MESSAGE);
    } else if (action === 'mic') {
      const mic = event.target.closest('[data-action="mic"]');
      if (stopListening) {
        stopListening();
        return;
      }
      mic.classList.add('listening');
      stopListening = listen({
        onText: (text) => {
          input.value = `${input.value} ${text}`.trim();
          input.focus();
        },
        onEnd: () => {
          mic.classList.remove('listening');
          stopListening = null;
        },
      });
    }
  };

  requestReply(); // the tutor opens the conversation
}
