const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');

// Функция добавления сообщения
function addMessage(text, sender) {
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  
  const avatar = sender === 'user' ? '👤' : '🧠';
  
  message.innerHTML = `
    <span class="avatar">${avatar}</span>
    <div class="bubble">${text}</div>
  `;
  
  chatHistory.appendChild(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  return message;
}

// Главная функция
async function askAI() {
  const question = askInput.value.trim();
  if (!question) return;

  // Показываем вопрос
  addMessage(question, 'user');
  askInput.value = '';
  
  // Показываем "Думаю..."
  const thinking = addMessage('Думаю', 'ai');
  thinking.classList.add('thinking');
  
  askBtn.disabled = true;

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    
    // Удаляем "Думаю..."
    thinking.remove();
    
    // Показываем ответ
    addMessage(data.answer || data.error || 'Пустой ответ 🤷', 'ai');
  } catch (err) {
    thinking.remove();
    addMessage('❌ Ошибка связи: ' + err.message, 'ai');
  } finally {
    askBtn.disabled = false;
  }
}

askBtn.addEventListener('click', askAI);
askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAI();
  }
});