export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Вопрос не указан' });
    }

    const apiKey = process.env.CHAD_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API ключ не настроен' });
    }

    const response = await fetch('https://ask.chadgpt.ru/api/public/gpt-4o-mini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        api_key: apiKey
      })
    });

    const data = await response.json();

    if (!data.is_success) {
      return res.status(500).json({ error: data.error_message || 'Chad API вернул ошибку' });
    }

    return res.status(200).json({ answer: data.response });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
