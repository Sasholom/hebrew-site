// /api/_lib/library-search.js
//
// Общая логика семантического поиска по библиотеке. Лежит в папке с префиксом
// "_", поэтому Vercel НЕ превращает файл в отдельный HTTP-эндпоинт — это просто
// модуль, который импортируют серверные функции (search-library.js, ask-rebbe.js).
//
// Два шага:
//   1) embedQuery  — считает эмбеддинг вопроса через Hugging Face Inference API
//      той же моделью (multilingual-e5-base), что использовалась при индексации
//      корпуса локально (build_index.py). Модель ОБЯЗАНА быть одна и та же,
//      иначе векторы несравнимы.
//   2) searchLibrary — векторный поиск ближайших кусков в Supabase (pgvector).
//
// Переменные окружения (заданы в Vercel):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — доступ к базе
//   HF_API_TOKEN                            — токен Hugging Face

import { createClient } from '@supabase/supabase-js';

const HF_MODEL = 'intfloat/multilingual-e5-base';
// Правильный текущий формат URL Hugging Face. НЕ api-inference.huggingface.co
// (устарел) и обязательно с /pipeline/feature-extraction на конце, иначе модель
// уходит в sentence-similarity pipeline по умолчанию и падает с ошибкой.
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

/**
 * Посчитать эмбеддинг поискового запроса.
 * @param {string} text — текст вопроса пользователя
 * @returns {Promise<number[]>} вектор размерности 768
 */
export async function embedQuery(text) {
  if (!process.env.HF_API_TOKEN) {
    throw new Error('HF_API_TOKEN не задан в переменных окружения');
  }

  let res;
  try {
    res = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      // модель e5 требует префикс "query: " для поисковых запросов
      body: JSON.stringify({
        inputs: `query: ${text}`,
        options: { wait_for_model: true },
      }),
    });
  } catch (networkErr) {
    // сюда попадаем, если запрос вообще не смог уйти (DNS, сеть, таймаут)
    throw new Error(`Не удалось достучаться до Hugging Face: ${networkErr.message}`);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Hugging Face вернул ошибку ${res.status}: ${errText}`);
  }

  const embedding = await res.json();

  if (embedding.error) {
    throw new Error(`Hugging Face API error: ${embedding.error}`);
  }

  // HF иногда возвращает вложенный массив (токены x измерения) вместо готового
  // усреднённого вектора — на такой случай усредняем сами (mean pooling)
  if (Array.isArray(embedding[0])) {
    const dim = embedding[0].length;
    const pooled = new Array(dim).fill(0);
    for (const tokenVec of embedding) {
      for (let i = 0; i < dim; i++) pooled[i] += tokenVec[i];
    }
    return pooled.map((v) => v / embedding.length);
  }
  return embedding;
}

/**
 * Найти ближайшие по смыслу куски библиотеки.
 * @param {Object} opts
 * @param {number[]} opts.queryEmbedding — вектор запроса из embedQuery
 * @param {string|null} [opts.sourceType] — 'chabad' | 'igrot' | null (по всем)
 * @param {number} [opts.limit=5] — сколько кусков вернуть
 * @returns {Promise<Array>} куски с полями content, title, volume, page,
 *   source_type, source_url, similarity и т.д.
 */
export async function searchLibrary({ queryEmbedding, sourceType = null, limit = 5 }) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не заданы в переменных окружения');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc('match_library_chunks', {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter_source_type: sourceType,
  });

  if (error) {
    throw new Error(`Supabase вернул ошибку: ${error.message}`);
  }

  return data || [];
}

/**
 * Удобная обёртка: посчитать эмбеддинг и сразу выполнить поиск.
 * @param {Object} opts
 * @param {string} opts.query — текст вопроса
 * @param {string|null} [opts.sourceType]
 * @param {number} [opts.limit=5]
 */
export async function embedAndSearch({ query, sourceType = null, limit = 5 }) {
  const queryEmbedding = await embedQuery(query);
  return searchLibrary({ queryEmbedding, sourceType, limit });
}
