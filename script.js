const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';

// Проверка DOM (для отладки)
if (!askBtn) console.error('❌ Кнопка "Спросить" не найдена!');
if (!askInput) console.error('❌ Поле ввода не найдено!');
if (!chatHistory) console.error('❌ Чат-история не найдена!');

// ===== БЕЗОПАСНЫЙ РЕНДЕРИНГ MARKDOWN =====
function renderMarkdown(text) {
  if (typeof marked === 'undefined') {
    console.warn('marked.js не загружен, вывожу как текст');
    return text;
  }
  // html: false — запрещает вставку сырого HTML, экранирует теги
  // breaks: true — переносы строк становятся <br>
  return marked.parse(text, { breaks: true, html: false });
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
    // Сохраняем исходный текст (без HTML-тегов) — берём из data-атрибута
    const rawText = m.querySelector('.bubble').getAttribute('data-raw') || '';
    if (!m.classList.contains('thinking')) {
      messages.push({ text: rawText, sender: isUser ? 'user' : 'ai' });
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// ===== ПОЛУЧЕНИЕ КОНТЕКСТА ДЛЯ ИИ =====
function getContext() {
  const saved = localStorage.getItem(CONTEXT_KEY);
  return saved ? JSON.parse(saved) : [];
}

// ===== СОХРАНЕНИЕ КОНТЕКСТА =====
function saveContext(context) {
  const trimmed = context.slice(-10);
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(trimmed));
}

// ===== ДОБАВЛЕНИЕ СООБЩЕНИЯ (с кнопкой копирования для AI) =====
function addMessage(text, sender, save = true) {
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  
  if (sender === 'ai') {
    // AI-сообщения: рендерим Markdown → безопасный HTML
    bubble.innerHTML = renderMarkdown(text);
  } else {
    // Пользовательские сообщения: чистый текст
    bubble.textContent = text;
  }
  
  // Сохраняем исходный текст для localStorage и копирования
  bubble.setAttribute('data-raw', text);
  
  message.innerHTML = ''; // очищаем
  message.appendChild(document.createElement('span')).className = 'avatar';
  message.querySelector('.avatar').textContent = avatar;
  message.appendChild(bubble);
  
  // Кнопка копирования только для AI-сообщений
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
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  return message;
}

// ===== ОТПРАВКА ВОПРОСА =====
async function askAI() {
  const question = askInput.value.trim();
  if (!question) return;
  if (question.length > 2000) {
    addMessage('⚠️ Сообщение слишком длинное (макс. 2000 символов)', 'ai');
    return;
  }

  addMessage(question, 'user');
  askInput.value = '';

  const thinking = addMessage('Думаю...', 'ai', false);
  thinking.classList.add('thinking');
  askBtn.disabled = true;

  const context = getContext();

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: context })
    });

    const data = await res.json();
    thinking.remove();

    const answer = data.answer || data.error || '🤷 Извини, что-то пошло не так. Попробуй ещё раз.';
    addMessage(answer, 'ai');

    context.push({ role: 'user', content: question });
    context.push({ role: 'assistant', content: answer });
    saveContext(context);

  } catch (err) {
    thinking.remove();
    addMessage('❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.', 'ai');
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

// ===== СОБЫТИЯ =====
if (askBtn) askBtn.addEventListener('click', askAI);
if (clearBtn) clearBtn.addEventListener('click', clearChat);
if (askInput) {
  askInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI();
    }
  });
}

// ===== ЗАПУСК =====
loadHistory();  