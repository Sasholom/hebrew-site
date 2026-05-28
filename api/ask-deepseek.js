export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, history } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Нет вопроса' });
  }

  // Формируем массив сообщений с историей
  const messages = [
    {
      role: 'system',
      content: 'Ты — дружелюбный и умный помощник по имени SaSholom AI. Отвечай кратко, по делу, с лёгким юмором. Используй эмодзи там, где уместно. 😊'
    }
  ];

  // Добавляем историю разговора (последние 10 сообщений)
  if (Array.isArray(history)) {
    history.slice(-10).forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });
  }

  // Добавляем текущий вопрос
  messages.push({ role: 'user', content: question });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHAD_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      return res.status(200).json({ answer: data.choices[0].message.content });
    } else {
      return res.status
