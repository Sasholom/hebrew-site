// api/ask-deepseek.js
// Поддержка текстовых запросов и запросов с изображениями (Claude vision)

const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 20;

const MODEL_ENDPOINTS = {
  chadgpt: 'gpt-5-nano',
  gemini: 'gemini-3-flash',
  vision: 'claude-3.7-sonnet' // модель для запросов с фото
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  if (!rateLimit.has(ip)) rateLimit.set(ip, []);
  const timestamps = rateLimit.get(ip).filter(t => t > windowStart);
  timestamps.push(now);
  rateLimit.set(ip, timestamps);
  if (timestamps.length > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Слишком много запросов. Подожди минуту 😊' });
  }

  const { question, history, systemPrompt, provider, image } = req.body;

  // Валидация: должен быть либо вопрос, либо изображение
  if (!question && !image) {
    return res.status(400).json({ error: 'Пустой запрос' });
  }
  if (question && question.length > 2000) {
    return res.status(400).json({ error: 'Вопрос слишком длинный (макс. 2000 символов)' });
  }

  let modelPath;
  if (image) {
    modelPath = MODEL_ENDPOINTS.vision;
  } else {
    const selectedProvider = provider || 'chadgpt';
    modelPath = MODEL_ENDPOINTS[selectedProvider];
    if (!modelPath) {
      return res.status(400).json({ error: 'Неверный провайдер' });
    }
  }

  const apiKey = process.env.CHAD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API-ключ Chad не настроен на сервере' });
  }

  // Формируем историю
  const chatHistory = [];
  if (systemPrompt) {
    chatHistory.push({ role: 'system', content: systemPrompt });
  } else {
    chatHistory.push({ role: 'system', content: 'Ты — дружелюбный помощник SaSholom AI. Отвечай кратко, с юмором 😊' });
  }

  if (Array.isArray(history)) {
    history.slice(-10).forEach(msg => {
      chatHistory.push({ role: msg.role, content: msg.content });
    });
  }

  const finalQuestion = question || 'Что это за объект? Какое благословение нужно произнести?';

  try {
    const requestBody = {
      message: finalQuestion,
      api_key: apiKey,
      history: chatHistory
    };
    // Добавляем изображение только если оно есть
    if (image) {
      requestBody.images = [image];
    }

    const response = await fetch(`https://ask.chadgpt.ru/api/public/${modelPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    // Проверяем, что ответ в формате JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Ответ не JSON:', text.slice(0, 300));
      return res.status(502).json({ error: 'Chad API вернул некорректный ответ' });
    }

    const data = await response.json();

    if (data.is_success) {
      return res.status(200).json({ answer: data.response });
    } else {
      const errorMsg = data.error_message || 'Ошибка Chad API';
      return res.status(500).json({ error: errorMsg });
    }
  } catch (err) {
    console.error('🔥 Ошибка сервера:', err);
    return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
  }
}
