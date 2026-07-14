// /api/search-library.js
//
// Vercel serverless-функция: принимает вопрос пользователя, считает его
// эмбеддинг через Hugging Face (модель multilingual-e5-base — та же самая,
// что использовалась при индексации библиотеки в build_index.py), ищет
// ближайшие по смыслу куски в Supabase, возвращает их с указанием источника.
//
// Низкоуровневая логика (эмбеддинг + запрос к Supabase) вынесена в общий
// модуль ./_lib/library-search.js — им же пользуется /api/ask-rebbe.js.
//
// Переменные окружения (задать в Vercel: Project Settings → Environment Variables):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — доступ к базе
//   HF_API_TOKEN                            — токен Hugging Face

import { embedQuery, searchLibrary } from './_lib/library-search.js';

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
    const results = await searchLibrary({ queryEmbedding, sourceType: source_type, limit });
    return res.status(200).json({ results });
  } catch (err) {
    console.error('searchLibrary failed:', err);
    return res.status(500).json({ error: 'Database search failed', details: err.message });
  }
}
