export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, history } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Нет вопроса' });
  }

  // Формируем историю для ChadGPT
  const chatHistory = [];

  // Системный промпт
  chatHistory.push({
    role: 'system',
    content: 'Ты — дружелюбный и умный помощник по имени SaSholom AI. Отвечай кратко, по делу, с лёгким юмором. Используй эмодзи там, где уместно. 😊'
  });

  // Добавляем последние 10 сообщений истории
  if (Array.isArray(history)) {
    history.slice(-10).forEach(msg => {
      chatHistory.push({ role: msg.role, content: msg.content });
    });
  }

  try {
    const response = await fetch('https://ask.chadgpt.ru/api/public/gpt-4o-mini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: question,
        api_key: process.env.CHAD_API_KEY,
        history: chatHistory
      })
    });

    const data = await response.json();

    if (data.is_success) {
      return res.status(200).json({ answer: data.response });
    } else {
      return res.status(500).json({ 
        error: data.error_message || 'Ошибка ChadGPT 🤷' 
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
}
