const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');
const themeToggle = document.getElementById('theme-toggle');

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';

// Проверка DOM
if (!askBtn) console.error('❌ Кнопка "Спросить" не найдена!');
if (!askInput) console.error('❌ Поле ввода не найдено!');
if (!chatHistory) console.error('❌ Чат-история не найдена!');

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
  const words = fullText.split(/(\s+)/); // разбиваем с пробелами
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

  // Кнопка копирования для AI
  if (sender === 'ai') {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Копировать';
    copyBtn.title = 'Скопировать ответ';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rawText = bubble.getAttribute('data-raw') || '';
      try {
        await navigator.clipboard.writeText(rawText);
        copyBtn.textContent = 'Скопировано ✓';
        setTimeout(() => { copyBtn.textContent = 'Копировать'; }, 2000);
      } catch (err) {
        copyBtn.textContent = 'Ошибка';
        setTimeout(() => { copyBtn.textContent = 'Копировать'; }, 2000);
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

// ===== ОТПРАВКА ВОПРОСА (с эффектом печати по словам) =====
async function askAI() {
  const question = askInput.value.trim();
  if (!question) return;
  if (question.length > 2000) {
    addMessage('⚠️ Сообщение слишком длинное (макс. 2000 символов)', 'ai');
    return;
  }

  addMessage(question, 'user');
  askInput.value = '';

  // Показываем "Думаю..."
  const thinking = addMessage('Думаю...', 'ai', false);
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

    // Создаём пустое AI-сообщение для печати
    const aiMsg = addMessage('', 'ai', false);
    const bubble = aiMsg.querySelector('.bubble');
    bubble.innerHTML = ''; // убираем возможную обёртку Markdown
    bubble.textContent = '';

    typewriterEffect(bubble, answer, 30, () => {
      // По окончании печати заменяем текст на отрендеренный Markdown
      bubble.innerHTML = renderMarkdown(answer);
      bubble.setAttribute('data-raw', answer);
      highlightCode(aiMsg);

      // Сохраняем контекст и историю
      context.push({ role: 'user', content: question });
      context.push({ role: 'assistant', content: answer });
      saveContext(context);
      saveHistory();
      console.log('✨ Печать завершена');
    });

  } catch (err) {
    thinking.remove();
    addMessage('❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.', 'ai');
    console.error('🔥 Ошибка:', err);
  } finally {
    askBtn.disabled = false;
  }
}

// ===== ОЧИСТКА ЧАТА =====
function clearChat() {
  if (!confirm('Точно удалить всю историю чата? 🗑️')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  chatHistory.innerHTML = '';
  addMessage('Привет! Задай мне любой вопрос 😎', 'ai');
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

// ===== СОБЫТИЯ =====
if (askBtn) askBtn.addEventListener('click', askAI);
if (clearBtn) clearBtn.addEventListener('click', clearChat);
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

if (askInput) {
  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  });
}

// Обработчики пресетов
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

loadHistory();