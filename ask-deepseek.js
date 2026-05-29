exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { question } = JSON.parse(event.body);

    if (!question) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Вопрос не указан' })
      };
    }

    const apiKey = process.env.CHAD_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API ключ не настроен' })
      };
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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: data.error_message || 'Chad API вернул ошибку' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer: data.response })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};