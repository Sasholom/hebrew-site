const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
const voiceBtn = document.getElementById('voice-btn');
const langBtn = document.getElementById('lang-btn');

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';
const UI_LANG_KEY = 'sasholom_ui_lang';

// Проверка DOM
if (!askBtn) console.error('❌ Кнопка "Спросить" не найдена!');
if (!askInput) console.error('❌ Поле ввода не найдено!');
if (!chatHistory) console.error('❌ Чат-история не найдена!');

// ===== ЛОКАЛИЗАЦИЯ =====
const translations = {
  ru: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Задай любой вопрос...',
    askBtn: 'Спросить 💬',
    clearBtn: '🗑️ Очистить чат',
    welcome: 'Привет! Задай мне любой вопрос 😎',
    thinking: 'Думаю...',
    copyBtn: 'Копировать',
    copied: 'Скопировано ✓',
    error: 'Ошибка',
    longMsg: '⚠️ Сообщение слишком длинное (макс. 2000 символов)',
    serverError: '❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.',
    clearConfirm: 'Точно удалить всю историю чата? 🗑️',
    voiceError: '❌ Ошибка распознавания речи. Попробуй ещё раз.',
    voiceUnsupported: '🎤 Голосовой ввод не поддерживается в твоём браузере. Попробуй Chrome.',
    presets: ['🌐 Переводчик', '🎭 Поэт', '💻 Кодер'],
    footer: 'Made with 💚 by S.K.'
  },
  en: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Ask any question...',
    askBtn: 'Ask 💬',
    clearBtn: '🗑️ Clear chat',
    welcome: 'Hello! Ask me anything 😎',
    thinking: 'Thinking...',
    copyBtn: 'Copy',
    copied: 'Copied ✓',
    error: 'Error',
    longMsg: '⚠️ Message too long (max 2000 chars)',
    serverError: '❌ Cannot connect to server. Check internet and try again.',
    clearConfirm: 'Really delete entire chat history? 🗑️',
    voiceError: '❌ Speech recognition error. Please try again.',
    voiceUnsupported: '🎤 Voice input not supported in your browser. Try Chrome.',
    presets: ['🌐 Translator', '🎭 Poet', '💻 Coder'],
    footer: 'Made with 💚 by S.K.'
  },
  he: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'שאל כל שאלה...',
    askBtn: 'שאל 💬',
    clearBtn: '🗑️ נקה צ\'אט',
    welcome: 'שלום! שאל אותי כל דבר 😎',
    thinking: 'חושב...',
    copyBtn: 'העתק',
    copied: 'הועתק ✓',
    error: 'שגיאה',
    longMsg: '⚠️ הודעה ארוכה מדי (מקסימום 2000 תווים)',
    serverError: '❌ לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב.',
    clearConfirm: 'בטוח למחוק את כל ההיסטוריה? 🗑️',
    voiceError: '❌ שגיאת זיהוי דיבור. נסה שוב.',
    voiceUnsupported: '🎤 קלט קולי לא נתמך בדפדפן שלך. נסה Chrome.',
    presets: ['🌐 מתרגם', '🎭 משורר', '💻 מתכנת'],
    footer: 'Made with 💚 by S.K.'
  }
};

let currentUILang = 'ru';

function applyLanguage(lang) {
  currentUILang = lang;
  const t = translations[lang];

  document.title = t.title;
  document.querySelector('h1').textContent = t.title;
  document.querySelector('.card h2').textContent = t.cardTitle;
  askInput.placeholder = t.placeholder;
  askBtn.textContent = t.askBtn;
  clearBtn.textContent = t.clearBtn;
  document.querySelector('footer').innerHTML = t.footer.replace('💚', '<span>💚</span>');

  // Обновляем пресеты
  const presetBtns = document.querySelectorAll('.preset-btn');
  if (presetBtns.length >= 3) {
    presetBtns[0].textContent = t.presets[0];
    presetBtns[1].textContent = t.presets[1];
    presetBtns[2].textContent = t.presets[2];
  }

  // Обновляем кнопку копирования у существующих AI-сообщений
  document.querySelectorAll('.ai-message .copy-btn').forEach(btn => {
    if (btn.textContent === 'Копировать' || btn.textContent === 'Copy' || btn.textContent === 'העתק') {
      btn.textContent = t.copyBtn;
    }
  });

  // Кнопка языка
  const langLabels = { ru: '🇷🇺 RU', en: '🇺🇸 EN', he: '🇮🇱 HE' };
  if (langToggle) langToggle.textContent = langLabels[lang];

  localStorage.setItem(UI_LANG_KEY, lang);
}

// ===== ПРЕСЕТЫ-РОЛИ =====
let currentRole = 'default';

const rolePrompts = {
  translator: 'Ты — профессиональный переводчик. Переведи следующее сообщение на русский язык, сохраняя смысл и стиль. Если сообщение уже на русском, переведи его на английский. Отвечай только переводом.',
  poet: 'Ты — талантливый поэт. Отвечай на любое сообщение стихами, с рифмой и ритмом. Используй красивые образы и метафоры.',
  coder: 'Ты — эксперт-программист. Отвечай как senior-разработчик: давай чистый, рабочий код с краткими пояснениями. Используй Markdown-блоки для кода.',
  default: 'Ты — дружелюбный и умный помощник по имени SaSholom AI. Отвечай кратко, по делу, с лёгким юмором. Используй эмодзи там, где уместно. 😊'
};

function setRole(role) {
  currentRole = role;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });
  localStorage.setItem('sasholom_role', role);
}

// ===== БЕЗОПАСНЫЙ РЕНДЕРИНГ MARKDOWN =====
function renderMarkdown(text) {
  if (typeof marked === 'undefined') {
    console.warn('marked.js не загружен, вывожу как текст');
    return text;
  }
  return marked.parse(text, { breaks: true, html: false });
}

// ===== ПОДСВЕТКА КОДА =====
function highlightCode(element) {
  if (typeof hljs === 'undefined') return;
  element.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });
}

// ===== ЭФФЕКТ ПЕЧАТИ (по словам) =====
function typewriterEffect(bubble, fullText, speed = 30, onComplete) {
  const words = fullText.split(/(\s+)/);
  let i = 0;
  bubble.textContent = '';

  function typeNext() {
    if (i < words.length) {
      bubble.textContent += words[i];
      i++;
      chatHistory.scrollTop = chatHistory.scrollHeight;
      setTimeout(typeNext, speed);
    } else {
      if (onComplete) onComplete();
    }
  }
  typeNext();
}

// ===== ЗАГРУЗКА ИСТОРИИ =====
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const messages = JSON.parse(saved);
    chatHistory.innerHTML = '';
    messages.forEach(msg => addMessage(msg.text, msg.sender, false));
  }
}

// ===== СОХРАНЕНИЕ ИСТОРИИ =====
function saveHistory() {
  const messages = [];
  chatHistory.querySelectorAll('.message').forEach(m => {
    const isUser = m.classList.contains('user-message');
    const rawText = m.querySelector('.bubble').getAttribute('data-raw') || '';
    if (!m.classList.contains('thinking')) {
      messages.push({ text: rawText, sender: isUser ? 'user' : 'ai' });
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// ===== ПОЛУЧЕНИЕ КОНТЕКСТА =====
function getContext() {
  const saved = localStorage.getItem(CONTEXT_KEY);
  return saved ? JSON.parse(saved) : [];
}

// ===== СОХРАНЕНИЕ КОНТЕКСТА =====
function saveContext(context) {
  const trimmed = context.slice(-10);
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(trimmed));
}

// ===== ДОБАВЛЕНИЕ СООБЩЕНИЯ =====
function addMessage(text, sender, save = true) {
  const t = translations[currentUILang];
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (sender === 'ai') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }

  bubble.setAttribute('data-raw', text);

  message.innerHTML = '';
  message.appendChild(document.createElement('span')).className = 'avatar';
  message.querySelector('.avatar').textContent = avatar;
  message.appendChild(bubble);

  if (sender === 'ai') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = t.copyBtn;
    copyBtn.title = t.copyBtn;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rawText = bubble.getAttribute('data-raw') || '';
      try {
        await navigator.clipboard.writeText(rawText);
        copyBtn.textContent = t.copied;
        setTimeout(() => { copyBtn.textContent = t.copyBtn; }, 2000);
      } catch (err) {
        copyBtn.textContent = t.error;
        setTimeout(() => { copyBtn.textContent = t.copyBtn; }, 2000);
      }
    });
    message.appendChild(copyBtn);
  }

  chatHistory.appendChild(message);
  if (sender === 'ai') {
    highlightCode(message);
  }
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  return message;
}

// ===== ОТПРАВКА ВОПРОСА =====
async function askAI() {
  const t = translations[currentUILang];
  const question = askInput.value.trim();
  if (!question) return;
  if (question.length > 2000) {
    addMessage(t.longMsg, 'ai');
    return;
  }

  addMessage(question, 'user');
  askInput.value = '';

  const thinking = addMessage(t.thinking, 'ai', false);
  thinking.classList.add('thinking');
  askBtn.disabled = true;

  const context = getContext();

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        history: context,
        systemPrompt: rolePrompts[currentRole]
      })
    });

    const data = await res.json();
    thinking.remove();

    const answer = data.answer || data.error || '🤷 Извини, что-то пошло не так. Попробуй ещё раз.';
    console.log('✅ Ответ получен, начинаю печать:', answer.slice(0, 30) + '...');

    const aiMsg = addMessage('', 'ai', false);
    const bubble = aiMsg.querySelector('.bubble');
    bubble.innerHTML = '';
    bubble.textContent = '';

    typewriterEffect(bubble, answer, 30, () => {
      bubble.innerHTML = renderMarkdown(answer);
      bubble.setAttribute('data-raw', answer);
      highlightCode(aiMsg);

      context.push({ role: 'user', content: question });
      context.push({ role: 'assistant', content: answer });
      saveContext(context);
      saveHistory();
      console.log('✨ Печать завершена');
    });

  } catch (err) {
    thinking.remove();
    addMessage(t.serverError, 'ai');
    console.error('🔥 Ошибка:', err);
  } finally {
    askBtn.disabled = false;
  }
}

// ===== ОЧИСТКА ЧАТА =====
function clearChat() {
  const t = translations[currentUILang];
  if (!confirm(t.clearConfirm)) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  chatHistory.innerHTML = '';
  addMessage(t.welcome, 'ai');
}

// ===== ПЕРЕКЛЮЧЕНИЕ ТЕМЫ =====
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sasholom_theme', theme);
  if (themeToggle) {
    themeToggle.textContent = theme === 'light' ? '☀️' : '🌓';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

// ===== ГОЛОСОВОЙ ВВОД (мультиязычный) =====
const voiceLangs = [
  { code: 'ru-RU', label: '🇷🇺 RU' },
  { code: 'en-US', label: '🇺🇸 EN' },
  { code: 'he-IL', label: '🇮🇱 HE' }
];
let currentVoiceLang = 0;
let isListening = false;
let recognition = null;

function updateLangButton() {
  if (langBtn) {
    langBtn.textContent = voiceLangs[currentVoiceLang].label;
  }
}

function switchLanguage() {
  currentVoiceLang = (currentVoiceLang + 1) % voiceLangs.length;
  updateLangButton();
  if (isListening) {
    stopListening();
    startListening();
  }
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    askInput.value = transcript;
    stopListening();
    askAI();
  };

  recognition.onerror = (event) => {
    console.error('Ошибка распознавания:', event.error);
    stopListening();
    addMessage(translations[currentUILang].voiceError, 'ai');
  };

  recognition.onend = () => {
    stopListening();
  };
}

function startListening() {
  if (!recognition) {
    addMessage(translations[currentUILang].voiceUnsupported, 'ai');
    return;
  }
  try {
    recognition.lang = voiceLangs[currentVoiceLang].code;
    recognition.start();
    isListening = true;
    voiceBtn.classList.add('listening');
    voiceBtn.textContent = '🔴';
  } catch (err) {
    console.error('Ошибка старта:', err);
    stopListening();
  }
}

function stopListening() {
  isListening = false;
  voiceBtn.classList.remove('listening');
  voiceBtn.textContent = '🎤';
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
}

// ===== СОБЫТИЯ =====
if (askBtn) askBtn.addEventListener('click', askAI);
if (clearBtn) clearBtn.addEventListener('click', clearChat);
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
if (langToggle) langToggle.addEventListener('click', () => {
  const langs = ['ru', 'en', 'he'];
  const idx = langs.indexOf(currentUILang);
  const next = langs[(idx + 1) % langs.length];
  applyLanguage(next);
});
if (voiceBtn) {
  voiceBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });
}
if (langBtn) langBtn.addEventListener('click', switchLanguage);

if (askInput) {
  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  });
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setRole(btn.dataset.role);
  });
});

// ===== ИНИЦИАЛИЗАЦИЯ =====
const savedTheme = localStorage.getItem('sasholom_theme') || 'dark';
setTheme(savedTheme);

const savedRole = localStorage.getItem('sasholom_role') || 'default';
setRole(savedRole);

const savedUILang = localStorage.getItem(UI_LANG_KEY) || 'ru';
applyLanguage(savedUILang);

updateLangButton();
loadHistory();