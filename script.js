const askBtn   = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const answerBox = document.getElementById('ai-answer');
const btnText  = askBtn.querySelector('.btn-text');

async function askAI() {
  const question = askInput.value.trim();
  if (!question) {
    answerBox.textContent = '⚠️ Введи вопрос, бро!';
    return;
  }

  askBtn.disabled = true;
  btnText.textContent = 'Думаю';
  answerBox.innerHTML = '🤔 <span class="loading-dots">Думаю</span>';

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    answerBox.textContent = data.answer || data.error || 'Пустой ответ 🤷';
  } catch (err) {
    answerBox.textContent = '❌ Ошибка связи: ' + err.message;
  } finally {
    askBtn.disabled = false;
    btnText.textContent = 'Спросить';
  }
}

askBtn.addEventListener('click', askAI);
askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAI();
  }
});