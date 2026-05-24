
    const askBtn = document.getElementById('ai-ask-btn');
    const askInput = document.getElementById('ai-question');
    const answerBox = document.getElementById('ai-answer');

    async function askAI() {
      const question = askInput.value.trim();
      if (!question) {
        answerBox.textContent = '⚠️ Введи вопрос, бро!';
        return;
      }
      askBtn.disabled = true;
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
      }
    }

    askBtn.addEventListener('click', askAI);
    askInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askAI();
      }
    });