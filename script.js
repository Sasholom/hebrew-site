// ===== АНИМАЦИЯ ПОЯВЛЕНИЯ ПРИ СКРОЛЛЕ =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));


// ===== ВСЕЗНАЙКА ИИ (Netlify + DeepSeek) =====
const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const answerBox = document.getElementById('ai-answer');
const btnText = askBtn.querySelector('.btn-text');

async function askAI() {
  const question = askInput.value.trim();
  if (!question) {
    answerBox.textContent = '⚠️ Введи вопрос, бро!';
    return;
  }

  askBtn.disabled = true;
  btnText.textContent = 'Думаю...';
  answerBox.textContent = '🤔 Думаю...';

  try {
    const res = await fetch('/.netlify/functions/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error('Ошибка сети');
    const data = await res.json();
    answerBox.textContent = data.answer || data.error || 'Пустой ответ';
  } catch (err) {
    answerBox.textContent = '❌ Не получилось связаться с ИИ: ' + err.message;
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