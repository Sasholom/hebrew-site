const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';

// Проверка, что элементы найдены
if (!askBtn) console.error('❌ Кнопка "Спросить" не найдена!');
if (!askInput) console.error('❌ Поле ввода не найдено!');
if (!chatHistory) console.error('❌ Чат-история не найдена!');
console.log('✅ DOM-элементы загружены');

// ===== ЗАГРУЗКА ИСТОРИИ =====
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const messages = JSON.parse(saved);
    chatHistory.innerHTML = '';
    messages.forEach(msg => addMessage(msg.text, msg.sender, false));
  }
  console.log('📜 История загружена');
}

// ===== СОХРАНЕНИЕ ИСТОРИИ =====
function saveHistory() {
  const messages = [];
  chatHistory.querySelectorAll('.message').forEach(m => {
    const isUser = m.classList.contains('user-message');
    const text = m.querySelector('.bubble').innerHTML;
    if (!m.classList.contains('thinking')) {
      messages.push({ text, sender: isUser ? 'user' : 'ai' });
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
  console.log(`💬 Добавляю сообщение: ${sender} — "${text.slice(0, 30)}..."`);
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';
  message.innerHTML = `<span class="avatar">${avatar}</span><div class="bubble"></div>`;
  message.querySelector('.bubble').textContent = text; // безопасный вывод
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  return message;
}

// ===== ОТПРАВКА ВОПРОСА =====
async function askAI() {
  console.log('🚀 askAI вызвана');
  const question = askInput.value.trim();
  if (!question) {
    console.warn('⚠️ Пустой вопрос');
    return;
  }
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
    console.log('📡 Отправляю запрос на /api/ask-deepseek...');
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: context })
    });

    console.log('📨 Ответ получен, статус:', res.status);
    const data = await res.json();
    console.log('📦 Данные:', data);
    thinking.remove();

    const answer = data.answer || data.error || '🤷 Извини, что-то пошло не так. Попробуй ещё раз.';
    addMessage(answer, 'ai');

    context.push({ role: 'user', content: question });
    context.push({ role: 'assistant', content: answer });
    saveContext(context);

  } catch (err) {
    console.error('🔥 Ошибка при fetch:', err);
    thinking.remove();
    addMessage('❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.', 'ai');
  } finally {
    askBtn.disabled = false;
  }
}

// ===== ОЧИСТКА ЧАТА =====
function clearChat() {
  console.log('🗑️ Очистка чата');
  if (!confirm('Точно удалить всю историю чата? 🗑️')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  chatHistory.innerHTML = '';
  addMessage('Привет! Задай мне любой вопрос 😎', 'ai');
}

// ===== СОБЫТИЯ =====
if (askBtn) {
  askBtn.addEventListener('click', askAI);
  console.log('👆 Обработчик клика повешен на кнопку "Спросить"');
} else {
  console.error('❌ Не могу повесить обработчик — кнопка не найдена');
}

if (clearBtn) {
  clearBtn.addEventListener('click', clearChat);
}

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
console.log('🏁 Скрипт инициализирован');
