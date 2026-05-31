// api/ask-deepseek.js (минимальная версия для теста)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Пустой вопрос' });
  }

  const apiKey = process.env.CHAD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API-ключ Chad не настроен на сервере' });
  }

  try {
    const response = await fetch('https://ask.chadgpt.ru/api/public/gpt-5-nano', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        api_key: apiKey
      })
    });

    const data = await response.json();

    if (data.is_success) {
      return res.status(200).json({ answer: data.response });
    } else {
      return res.status(500).json({ error: data.error_message || 'Ошибка Chad API' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка соединения: ' + err.message });
  }
}
