const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';

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
    const text = m.querySelector('.bubble').innerHTML;
    if (!m.classList.contains('thinking')) {
      messages.push({ text, sender: isUser ? 'user' : 'ai' });
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

// ===== ДОБАВЛЕНИЕ СООБЩЕНИЯ =====
function addMessage(text, sender, save = true) {
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';
  message.innerHTML = `
    <span class="avatar">${avatar}</span>
    <div class="bubble">${text}</div>
  `;
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  return message;
}

// ===== ОТПРАВКА ВОПРОСА С ПАМЯТЬЮ =====
async function askAI() {
  const question = askInput.value.trim();
  if (!question) return;

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

    const answer = data.answer || data.error || 'Пустой ответ 🤷';
    addMessage(answer, 'ai');

    // Обновляем контекст
    context.push({ role: 'user', content: question });
    context.push({ role: 'assistant', content: answer });
    saveContext(context);

  } catch (err) {
    thinking.remove();
    addMessage('❌ Ошибка связи: ' + err.message, 'ai');
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
askBtn.addEventListener('click', askAI);
clearBtn.addEventListener('click', clearChat);
askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAI();
  }
});

// ===== ЗАПУСК =====
loadHistory();
