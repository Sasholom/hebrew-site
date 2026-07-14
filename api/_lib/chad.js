// /api/_lib/chad.js
//
// Клиент нового OpenAI-совместимого API Chad (v2):
//   POST https://ask.chadgpt.ru/api/v1/chat/completions
//   Authorization: Bearer <CHAD_API_KEY>   (api_key в теле слать НЕЛЬЗЯ — вернёт 400)
//
// В отличие от старого /api/public/{model} (message + history + api_key в body),
// здесь формат как у OpenAI: { model, messages, temperature, max_tokens, ... },
// доступны свежие модели (claude-5-sonnet, claude-4.8-opus, gpt-5.5 и т.д.) и
// поддерживаются tools (function calling). Список моделей: GET /api/v1/models.
//
// Папка с префиксом "_" не становится HTTP-эндпоинтом на Vercel — это просто модуль.

const CHAD_V2_URL = 'https://ask.chadgpt.ru/api/v1/chat/completions';

/**
 * Вызов chat-completions v2.
 * @param {Object} opts
 * @param {string} opts.model — ID модели из /api/v1/models (напр. 'claude-5-sonnet')
 * @param {Array<{role:string, content:string}>} opts.messages — OpenAI-формат
 * @param {number} [opts.temperature=0.4]
 * @param {number} [opts.maxTokens=1500] — лимит output-токенов
 * @returns {Promise<string>} текст ответа модели
 */
export async function chatCompletion({ model, messages, temperature = 0.4, maxTokens = 1500 }) {
  const apiKey = process.env.CHAD_API_KEY;
  if (!apiKey) throw new Error('CHAD_API_KEY не настроен на сервере');

  let response;
  try {
    response = await fetch(CHAD_V2_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (networkErr) {
    throw new Error(`Не удалось достучаться до Chad API: ${networkErr.message}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Ответ Chad v2 не JSON:', text.slice(0, 300));
    throw new Error('Chad API вернул некорректный ответ');
  }

  const data = await response.json();

  // OpenAI-совместимый формат ошибки: { error: { message, type, ... } }
  if (!response.ok || data.error) {
    const msg = data.error?.message || `HTTP ${response.status}`;
    throw new Error(`Chad API: ${msg}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    console.error('❌ Chad v2: нет choices[0].message.content:', JSON.stringify(data).slice(0, 300));
    throw new Error('Chad API вернул ответ без текста');
  }
  return content;
}
