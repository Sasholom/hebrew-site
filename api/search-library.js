// /api/search-library.js
//
// Vercel serverless-функция: принимает вопрос пользователя, считает его
// эмбеддинг через Hugging Face Inference API (модель multilingual-e5-base —
// та же самая, что использовалась при индексации библиотеки в build_index.py),
// ищет ближайшие по смыслу куски в Supabase, возвращает их с указанием источника.
//
// Переменные окружения (задать в Vercel: Project Settings → Environment Variables):
//   SUPABASE_URL              — из Supabase: Settings → API → Project URL
//   SUPABASE_SERVICE_ROLE_KEY — из Supabase: Settings → API → service_role
//                                (или новый secret-ключ sb_secret_...)
//   HF_API_TOKEN               — huggingface.co/settings/tokens → New token (Read)
//
// Установка зависимости в проекте:
//   npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js';

const HF_MODEL = 'intfloat/multilingual-e5-base';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;

async function embedQuery(text) {
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

async function searchSupabase(queryEmbedding, sourceType, limit) {
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

  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { query, source_type = null, limit = 5 } = req.body || {};
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Field "query" is required' });
  }

  let queryEmbedding;
  try {
    queryEmbedding = await embedQuery(query.trim());
  } catch (err) {
    console.error('embedQuery failed:', err);
    return res.status(500).json({ error: 'Embedding step failed', details: err.message });
  }

  try {
    const results = await searchSupabase(queryEmbedding, source_type, limit);
    return res.status(200).json({ results });
  } catch (err) {
    console.error('searchSupabase failed:', err);
    return res.status(500).json({ error: 'Database search failed', details: err.message });
  }
}
