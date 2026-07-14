// ============================================================
//   rebbe.js — режим «Ответ Ребе» (отдельный чат)
//
//   Задаёшь вопрос → сервер (/api/ask-rebbe) ищет по библиотеке
//   (письма Игрот Кодеш + статьи chabad.org), строит ответ на
//   найденном тексте и возвращает { answer, grounded, sources }.
//
//   Обычный скрипт (не module): страница работает и при открытии
//   через file://, и на сервере. Ответы приходят только на сервере.
// ============================================================

'use strict';

const API_URL = '/api/ask-rebbe';
const MAX_QUESTION_LENGTH = 2000;
const CONTEXT_MESSAGES = 6; // сколько реплик отдаём серверу для контекста

const STORE = {
  history: 'sasholom_rebbe_history', // [{ text, sender, sources? }] — для отрисовки
  context: 'sasholom_rebbe_context', // [{ role, content }] — для follow-up
  theme: 'sasholom_theme',           // делится с основным приложением
};

const el = {
  chatHistory: document.getElementById('chat-history'),
  intro: document.getElementById('rebbe-intro'),
  input: document.getElementById('ai-question'),
  askBtn: document.getElementById('ai-ask-btn'),
  themeToggle: document.getElementById('theme-toggle'),
};

// ---------- Хранилище ----------
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ---------- Тема ----------
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem(STORE.theme, theme); } catch {}
  el.themeToggle.textContent = theme === 'light' ? '☀️' : '🌓';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// ---------- Иконки (lucide) ----------
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ---------- Markdown ----------
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  // html:false — не пропускаем сырой HTML из ответа модели (защита от XSS)
  return marked.parse(text, { breaks: true, html: false });
}

// ---------- Источники ----------
const SRC_EMOJI = { igrot: '✉️', chabad: '📄' };

// Ссылка на источник может прийти из БД — пускаем в href только http(s).
function safeUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch {
    return null;
  }
}

// Блок карточек-источников под ответом. Всё через textContent — данные из БД.
function buildSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  const wrap = document.createElement('div');
  wrap.className = 'rebbe-sources';

  const heading = document.createElement('div');
  heading.className = 'src-title';
  heading.textContent = 'Источники:';
  wrap.appendChild(heading);

  sources.forEach((s) => {
    const url = safeUrl(s.url);
    const card = document.createElement(url ? 'a' : 'span');
    card.className = 'src-card';
    if (url) {
      card.href = url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
    }

    const emoji = document.createElement('span');
    emoji.className = 'src-emoji';
    emoji.textContent = SRC_EMOJI[s.type] || '📚';
    card.appendChild(emoji);

    const label = document.createElement('span');
    label.className = 'src-label';
    label.textContent = s.label || 'источник';
    card.appendChild(label);

    wrap.appendChild(card);
  });

  return wrap;
}

// ---------- Сообщения ----------
/**
 * Добавить сообщение в ленту.
 * @param {string} text
 * @param {'user'|'ai'} sender
 * @param {Array} [sources] — источники (только для ai)
 * @returns {HTMLElement}
 */
function addMessage(text, sender, sources) {
  if (el.intro) el.intro.style.display = 'none';

  const message = document.createElement('div');
  message.className = `message ${sender}-message`;

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? '👤' : '📜';
  message.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (sender === 'ai') bubble.innerHTML = renderMarkdown(text);
  else bubble.textContent = text; // пользовательский текст — без HTML (XSS)
  message.appendChild(bubble);

  // Держим источники на самом элементе — чтобы сохранить их в историю
  if (sender === 'ai' && Array.isArray(sources) && sources.length) {
    message._sources = sources;
  }

  el.chatHistory.appendChild(message);

  const srcBlock = sender === 'ai' ? buildSources(sources) : null;
  if (srcBlock) el.chatHistory.appendChild(srcBlock);

  el.chatHistory.scrollTop = el.chatHistory.scrollHeight;
  refreshIcons();
  return message;
}

// «Думаю…» — временный индикатор, не попадает в историю
function addThinking() {
  const message = document.createElement('div');
  message.className = 'message ai-message thinking';
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = '📜';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = 'Ищу в библиотеке…';
  message.append(avatar, bubble);
  el.chatHistory.appendChild(message);
  el.chatHistory.scrollTop = el.chatHistory.scrollHeight;
  return message;
}

// ---------- История (localStorage) ----------
function saveDisplayHistory() {
  const items = [];
  el.chatHistory.querySelectorAll('.message').forEach((m) => {
    if (m.classList.contains('thinking')) return;
    const bubble = m.querySelector('.bubble');
    items.push({
      text: bubble ? (bubble.getAttribute('data-raw') ?? bubble.textContent) : '',
      sender: m.classList.contains('user-message') ? 'user' : 'ai',
      sources: m._sources || undefined,
    });
  });
  writeJSON(STORE.history, items.slice(-40));
}

function restoreHistory() {
  const items = readJSON(STORE.history, []);
  if (!items.length) return;
  items.forEach((it) => {
    const m = addMessage(it.text, it.sender, it.sources);
    const bubble = m.querySelector('.bubble');
    if (bubble) bubble.setAttribute('data-raw', it.text);
  });
}

function getContext() {
  return readJSON(STORE.context, []);
}
function saveContext(context) {
  writeJSON(STORE.context, context.slice(-CONTEXT_MESSAGES));
}

// ---------- Главный сценарий ----------
async function ask() {
  const question = el.input.value.trim();
  if (!question) return;
  if (question.length > MAX_QUESTION_LENGTH) {
    addMessage('⚠️ Вопрос слишком длинный (макс. 2000 символов).', 'ai');
    return;
  }

  const userMsg = addMessage(question, 'user');
  userMsg.querySelector('.bubble').setAttribute('data-raw', question);
  el.input.value = '';
  el.input.style.height = '';
  el.askBtn.disabled = true;

  const context = getContext();
  const thinking = addThinking();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: context }),
    });
    const data = await res.json();
    thinking.remove();

    if (!res.ok || data.error) {
      addMessage('❌ ' + (data.error || 'Не удалось получить ответ. Попробуй ещё раз.'), 'ai');
      return;
    }

    const answer = data.answer || 'Пустой ответ.';
    const aiMsg = addMessage(answer, 'ai', data.sources);
    aiMsg.querySelector('.bubble').setAttribute('data-raw', answer);

    context.push({ role: 'user', content: question });
    context.push({ role: 'assistant', content: answer });
    saveContext(context);
    saveDisplayHistory();
  } catch {
    thinking.remove();
    addMessage('❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.', 'ai');
  } finally {
    el.askBtn.disabled = false;
    refreshIcons();
  }
}

// ---------- Автоувеличение поля ввода ----------
function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 160) + 'px';
}

// ---------- Инициализация ----------
setTheme(localStorage.getItem(STORE.theme) || 'dark');
restoreHistory();
refreshIcons();

el.themeToggle.addEventListener('click', toggleTheme);
el.askBtn.addEventListener('click', ask);
el.input.addEventListener('input', autoGrow);
el.input.addEventListener('keydown', (e) => {
  // Enter — отправить, Shift+Enter — перенос строки
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    ask();
  }
});
el.input.focus();
