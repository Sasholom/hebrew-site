// ============================================================
//   СЕРВЕРНАЯ ФУНКЦИЯ (Vercel Serverless)
//   Принимает вопрос с клиента и проксирует его в Chad API
//   (единый ключ для GPT / Gemini / Claude).
//
//   Требуемая переменная окружения: CHAD_API_KEY
//   (Vercel → Project → Settings → Environment Variables)
// ============================================================

// Rate limiting: не больше MAX_REQUESTS запросов в минуту с одного IP.
// ВАЖНО: Map живёт в памяти конкретного инстанса функции — при холодном
// старте сбрасывается и между инстансами не разделяется. Для строгого
// лимита нужен внешний стор (Vercel KV / Upstash) — см. бэклог.
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 20;

const MAX_QUESTION_LENGTH = 2000; // синхронизировано с js/config.js
const CONTEXT_MESSAGES = 10;

// Модели Chad API. vision — модель для запросов с фото.
const MODEL_ENDPOINTS = {
  chadgpt: 'gpt-5-nano',
  gemini: 'gemini-3-flash',
  vision: 'claude-3.7-sonnet',
};

const DEFAULT_SYSTEM_PROMPT =
  'Ты — дружелюбный помощник SaSholom AI. Отвечай кратко, с юмором 😊 Отвечай на том языке, на котором пишет пользователь.';

// Вопрос по умолчанию, если пришло фото без текста
// (клиент обычно присылает свой, локализованный).
const DEFAULT_IMAGE_QUESTION = 'Что изображено на этом фото? Опиши подробно.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  // --- Rate limiting ---
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  const timestamps = (rateLimit.get(ip) || []).filter((ts) => ts > windowStart);
  timestamps.push(now);
  rateLimit.set(ip, timestamps);
  if (timestamps.length > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Слишком много запросов. Подожди минуту 😊' });
  }

  // --- Валидация входа ---
  const { question, history, systemPrompt, provider, image } = req.body;

  if (!question && !image) {
    return res.status(400).json({ error: 'Пустой запрос' });
  }
  if (question && question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Вопрос слишком длинный (макс. ${MAX_QUESTION_LENGTH} символов)` });
  }

  // Для фото всегда используется vision-модель, иначе — выбранный провайдер
  let modelPath;
  if (image) {
    modelPath = MODEL_ENDPOINTS.vision;
  } else {
    modelPath = MODEL_ENDPOINTS[provider || 'chadgpt'];
    if (!modelPath) {
      return res.status(400).json({ error: 'Неверный провайдер' });
    }
  }

  const apiKey = process.env.CHAD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API-ключ Chad не настроен на сервере' });
  }

  // --- История для модели: системный промпт + последние сообщения ---
  const chatHistory = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
  ];
  if (Array.isArray(history)) {
    history
      .slice(-CONTEXT_MESSAGES)
      // Принимаем только валидные сообщения — защита от мусора в запросе
      .filter((msg) => ['user', 'assistant'].includes(msg?.role) && typeof msg?.content === 'string')
      .forEach((msg) => chatHistory.push({ role: msg.role, content: msg.content }));
  }

  // --- Запрос к Chad API ---
  try {
    const requestBody = {
      message: question || DEFAULT_IMAGE_QUESTION,
      api_key: apiKey,
      history: chatHistory,
    };
    if (image) {
      requestBody.images = [image];
    }

    const response = await fetch(`https://ask.chadgpt.ru/api/public/${modelPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Ответ Chad API не JSON:', text.slice(0, 300));
      return res.status(502).json({ error: 'Chad API вернул некорректный ответ' });
    }

    const data = await response.json();
    if (data.is_success) {
      return res.status(200).json({ answer: data.response });
    }
    return res.status(500).json({ error: data.error_message || 'Ошибка Chad API' });
  } catch (err) {
    console.error('🔥 Ошибка сервера:', err);
    return res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
  }
}
