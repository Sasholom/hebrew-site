// ============================================================
//   /api/ask-rebbe.js  —  «Ответ Ребе» (RAG)
//
//   Отдельный от обычного чата эндпоинт. Логика:
//     1) по вопросу пользователя ищем ближайшие по смыслу куски в библиотеке
//        (письма Игрот Кодеш + статьи chabad.org) через ./_lib/library-search.js
//     2) если нашлись релевантные (similarity >= порога) — строим системный
//        промпт с этими фрагментами и просим модель ответить, ОПИРАЯСЬ на них,
//        с указанием источника (том/страница письма, ссылка на статью)
//     3) если релевантного нет — честно говорим об этом и отвечаем общо,
//        НЕ выдумывая источников
//
//   Chad API (ask.chadgpt.ru) не поддерживает нативный function calling, поэтому
//   «поиск в библиотеке» оркеструется здесь, на сервере, а не самой моделью.
//
//   Переменные окружения (уже настроены в Vercel):
//     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — доступ к базе
//     HF_API_TOKEN                            — эмбеддинг вопроса
//     CHAD_API_KEY                            — доступ к модели (GPT/Gemini/Claude)
// ============================================================

import { embedAndSearch } from './_lib/library-search.js';

// --- Rate limiting (in-memory, как в chat.js: сбрасывается на холодном старте,
//     между инстансами не делится — для строгого лимита нужен внешний стор) ---
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 15;

const MAX_QUESTION_LENGTH = 2000;
const CONTEXT_MESSAGES = 6; // сколько последних реплик отдаём модели для контекста

// Модель для ответа. gemini-3-flash — баланс качества/скорости/цены и хорошо
// держит русский. Можно поднять до 'claude-3.7-sonnet' для лучшего следования
// инструкции «не выдумывай источник», либо снизить до 'gpt-5-nano' ради цены.
const REBBE_MODEL = 'gemini-3-flash';

// Сколько кусков тянем из базы и порог косинусной похожести, ниже которого
// считаем, что относящегося к вопросу материала не нашлось. Порог подобран
// консервативно — стоит подстроить, посмотрев реальные значения similarity
// в логах на типичных вопросах.
const SEARCH_LIMIT = 6;
const SIMILARITY_THRESHOLD = 0.75;
const MAX_CHUNK_CHARS = 1200; // обрезаем длинные куски, чтобы не раздувать контекст

// Достаём оценку похожести из строки результата. Точное имя поля, которое
// возвращает RPC match_library_chunks, задано в Supabase (обычно similarity =
// 1 - косинусное расстояние). Проверяем несколько вариантов, чтобы фильтр не
// сломался молча, если поле называется иначе.
function similarityOf(row) {
  if (typeof row.similarity === 'number') return row.similarity;
  if (typeof row.score === 'number') return row.score;
  if (typeof row.distance === 'number') return 1 - row.distance;
  return null;
}

// Человеко-читаемая подпись источника для промпта и для карточки на клиенте.
function sourceLabel(row) {
  if (row.source_type === 'igrot') {
    const vol = row.volume ? `том ${row.volume}` : '';
    const page = row.page ? `стр. ${row.page}` : '';
    const ref = [vol, page].filter(Boolean).join(', ');
    return `Игрот Кодеш${ref ? ', ' + ref : ''}`;
  }
  // chabad.org
  return row.title ? `chabad.org — «${row.title}»` : 'chabad.org';
}

// Компактная структура источника для ответа клиенту (для карточек со ссылками).
function toSource(row) {
  const sim = similarityOf(row);
  return {
    type: row.source_type,
    label: sourceLabel(row),
    title: row.title || null,
    volume: row.volume ?? null,
    page: row.page ?? null,
    url: row.source_url || null,
    similarity: typeof sim === 'number' ? Number(sim.toFixed(3)) : null,
  };
}

const GROUNDED_RULES = [
  'Ты — «Ответ Ребе»: помощник, который отвечает на вопросы, опираясь на приведённые ниже фрагменты из библиотеки — писем Любавичского Ребе (Игрот Кодеш) и статей chabad.org.',
  'Правила:',
  '— Отвечай, опираясь прежде всего на эти фрагменты. Передай суть того, что в них сказано по вопросу человека; где уместно — коротко процитируй.',
  '— НЕ выдумывай цитаты, номера томов, страниц и ссылки. Указывай только те источники, что перечислены ниже.',
  '— В конце ответа приведи блок «Источник(и)»: для писем — «Игрот Кодеш, том N, стр. M»; для статей — название и ссылку.',
  '— Если фрагменты лишь частично касаются вопроса — так и скажи, не притягивая их за уши.',
  '— Тон тёплый, уважительный, ясный. Отвечай на языке, на котором написан вопрос.',
].join('\n');

const UNGROUNDED_PROMPT = [
  'Ты — «Ответ Ребе». По вопросу человека в библиотеке (письма Игрот Кодеш и статьи chabad.org) не нашлось подходящего письма или статьи.',
  'Честно и мягко сообщи об этом в первой фразе. Затем дай общий, доброжелательный ответ в духе хасидского подхода.',
  'СТРОГО: не ссылайся на конкретные письма, тома, страницы или ссылки и не выдумывай источники — их у тебя сейчас нет.',
  'Можешь предложить переформулировать вопрос. Отвечай на языке, на котором написан вопрос.',
].join('\n');

// Собирает системный промпт с фрагментами для grounded-ответа.
function buildGroundedPrompt(rows) {
  const blocks = rows.map((row, i) => {
    const content = (row.content || '').slice(0, MAX_CHUNK_CHARS);
    const simVal = similarityOf(row);
    const sim = typeof simVal === 'number' ? simVal.toFixed(2) : '—';
    return `--- Источник ${i + 1}: ${sourceLabel(row)}${row.source_url ? ` (${row.source_url})` : ''} [похожесть ${sim}] ---\n${content}`;
  });
  return `${GROUNDED_RULES}\n\n[Найденные фрагменты]\n${blocks.join('\n\n')}`;
}

// Прокси-запрос к Chad API (тот же интерфейс, что в chat.js).
async function callChad({ systemPrompt, question, history }) {
  const apiKey = process.env.CHAD_API_KEY;
  if (!apiKey) throw new Error('CHAD_API_KEY не настроен на сервере');

  const chatHistory = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(history)) {
    history
      .slice(-CONTEXT_MESSAGES)
      .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
      .forEach((m) => chatHistory.push({ role: m.role, content: m.content }));
  }

  const response = await fetch(`https://ask.chadgpt.ru/api/public/${REBBE_MODEL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question, api_key: apiKey, history: chatHistory }),
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Ответ Chad API не JSON:', text.slice(0, 300));
    throw new Error('Chad API вернул некорректный ответ');
  }

  const data = await response.json();
  if (!data.is_success) {
    throw new Error(data.error_message || 'Ошибка Chad API');
  }
  return data.response;
}

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

  // --- Валидация ---
  const { question, history } = req.body || {};
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Пустой вопрос' });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `Вопрос слишком длинный (макс. ${MAX_QUESTION_LENGTH} символов)` });
  }
  const cleanQuestion = question.trim();

  // --- Шаг 1: поиск по библиотеке (по всем источникам сразу) ---
  let rows = [];
  try {
    rows = await embedAndSearch({ query: cleanQuestion, sourceType: null, limit: SEARCH_LIMIT });
  } catch (err) {
    console.error('library search failed:', err);
    return res.status(500).json({ error: 'Не удалось выполнить поиск по библиотеке', details: err.message });
  }

  // Оставляем только достаточно похожие куски. Если ни у одной строки не удалось
  // прочитать оценку похожести (поле называется иначе, чем ожидаем) — не отсекаем
  // всё молча, а доверяем ранжированию RPC (оно уже вернуло топ по похожести).
  const canScore = rows.some((r) => similarityOf(r) !== null);
  const relevant = canScore
    ? rows.filter((r) => {
        const s = similarityOf(r);
        return s !== null && s >= SIMILARITY_THRESHOLD;
      })
    : rows;
  const grounded = relevant.length > 0;

  // Лог для калибровки порога: видно реальные значения similarity в Vercel logs.
  const topSims = rows.map((r) => similarityOf(r)).filter((s) => s !== null);
  console.log(
    `[ask-rebbe] найдено ${rows.length}, релевантных ${relevant.length}, ` +
      `similarity top=[${topSims.slice(0, 3).map((s) => s.toFixed(3)).join(', ')}]` +
      (canScore ? '' : ' (поле similarity не распознано — фолбэк на ранжирование)')
  );

  // --- Шаг 2: ответ модели ---
  const systemPrompt = grounded ? buildGroundedPrompt(relevant) : UNGROUNDED_PROMPT;

  let answer;
  try {
    answer = await callChad({ systemPrompt, question: cleanQuestion, history });
  } catch (err) {
    console.error('callChad failed:', err);
    return res.status(500).json({ error: 'Ошибка модели: ' + err.message });
  }

  return res.status(200).json({
    answer,
    grounded,
    // Уникальные источники (по label) для карточек на клиенте
    sources: grounded ? dedupeSources(relevant.map(toSource)) : [],
  });
}

// Убираем дубли источников: один и тот же кусок текста может встретиться
// несколько раз, а для карточек нужен уникальный список.
function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources) {
    const key = s.url || s.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
