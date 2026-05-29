// Простейший in-memory rate limiter (действует, пока функция "тёплая")
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const MAX_REQUESTS = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  // --- Rate Limiting ---
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, []);
  }
  const timestamps = rateLimit.get(ip).filter(t => t > windowStart);
  timestamps.push(now);
  rateLimit.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Слишком много запросов. Подожди минуту и попробуй снова 😊' });
  }
  // --- Конец Rate Limiting ---

  const { question, history, systemPrompt } = req.body;

  // Валидация вопроса
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Пустой вопрос' });
  }
  if (question.length > 2000) {
    return res.status(400).json({ error: 'Вопрос слишком длинный (макс. 2000 символов)' });
  }

  // Формируем историю для ChadGPT
  const chatHistory = [];

  // Системный промпт (кастомный или дефолтный)
  chatHistory.push({
    role: 'system',
    content: systemPrompt || 'Ты — дружелюбный и умный помощник по имени SaSholom AI. Отвечай кратко, по делу, с лёгким юмором. Используй эмодзи там, где уместно. 😊'
  });

  // Добавляем последние 10 сообщений истории (если есть)
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
    return res.status(500).json({ error: 'Ошибка соединения с ИИ. Попробуй позже.' });
  }
}
