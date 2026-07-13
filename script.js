// ============================================================
//   SaSholom AI — единый клиентский скрипт
//   Обычный (не module) скрипт: работает и при открытии
//   index.html двойным кликом (file://), и на сервере/Vercel.
//
//   Собран из модулей в js/ (оставлены как читаемый исходник).
//   Порядок секций = порядок зависимостей.
// ============================================================
(function () {
  'use strict';

// ====================== js/config.js ======================
// ============================================================
//   КОНСТАНТЫ И КЛЮЧИ ХРАНИЛИЩА
//   Единственное место, где заданы лимиты и имена ключей
//   localStorage — при изменении здесь меняется везде.
// ============================================================

const API_URL = '/api/chat';

const STORAGE_KEYS = {
  history: 'sasholom_chat_history',
  context: 'sasholom_context',
  uiLang: 'sasholom_ui_lang',
  notes: 'sasholom_notes',
  queryCount: 'sasholom_query_count',
  character: 'sasholom_character',
  provider: 'sasholom_provider',
  theme: 'sasholom_theme',
};

// Максимальная длина вопроса (символов) — синхронизировано
// с валидацией на сервере (api/chat.js) и maxlength в textarea.
const MAX_QUESTION_LENGTH = 2000;

// Максимальный размер загружаемого фото до сжатия (байт).
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Сколько последних сообщений передаётся модели как контекст.
const CONTEXT_MESSAGES = 10;

// Скорость «печати» ответа, мс на слово.
const TYPEWRITER_SPEED = 30;

// Параметры сжатия фото перед отправкой.
const IMAGE_COMPRESSION = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.7,
};

// ====================== js/state.js ======================
// ============================================================
//   ОБЩЕЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
//   Один изменяемый объект, который импортируют все модули.
//   Поля меняются напрямую: state.provider = 'gemini'.
// ============================================================

const state = {
  // Язык интерфейса: 'ru' | 'en' | 'he'
  uiLang: 'ru',

  // Выбранный AI-провайдер: 'chadgpt' (GPT) | 'gemini'
  provider: 'chadgpt',

  // Текущий персонаж (объект из characters.js) или null — обычный режим
  character: null,

  // base64 выбранного фото (после сжатия) или null
  selectedImage: null,

  // Счётчик отправленных запросов (персистится в localStorage)
  queryCount: 0,

  // Идёт ли сейчас распознавание речи
  isListening: false,
};

// ====================== js/dom.js ======================
// ============================================================
//   ССЫЛКИ НА DOM-ЭЛЕМЕНТЫ
//   Все getElementById собраны здесь, чтобы остальные модули
//   не искали элементы по всему документу.
// ============================================================

const byId = (id) => document.getElementById(id);

const el = {
  // Основной ввод и кнопки
  askBtn: byId('ai-ask-btn'),
  askInput: byId('ai-question'),
  chatHistory: byId('chat-history'),
  clearBtn: byId('clear-chat-btn'),

  // Переключатели темы и языка интерфейса
  themeToggle: byId('theme-toggle'),
  langToggle: byId('lang-toggle'),

  // Голосовой ввод
  voiceBtn: byId('voice-btn'),
  voiceLangBtn: byId('lang-btn'),

  // Фото и камера
  imageBtn: byId('image-btn'),
  imageInput: byId('image-input'),
  cameraBtn: byId('camera-btn'),
  previewDiv: byId('image-preview'),
  previewImg: byId('preview-img'),
  removePreviewBtn: byId('remove-preview'),

  // Файлы (PDF/TXT)
  fileBtn: byId('file-btn'),
  fileInput: byId('file-input'),

  // Инструменты чата
  exportBtn: byId('export-btn'),
  searchInput: byId('search-input'),
  counterSpan: byId('counter'),

  // Заметки о пользователе
  notesBtn: byId('notes-btn'),
  notesPanel: byId('notes-panel'),
  noteName: byId('note-name'),
  notePrefs: byId('note-prefs'),
  saveNotesBtn: byId('save-notes-btn'),

  // Выбор персонажа
  categorySelect: byId('category-select'),
  characterSelect: byId('character-select'),
  defaultCharBtn: byId('default-char-btn'),
};

// Перерисовать иконки Lucide (нужно после любой вставки <i data-lucide>).
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ====================== js/storage.js ======================
// ============================================================
//   РАБОТА С localStorage
//   Все чтения/записи хранилища — только через этот модуль.
//   История чата — [{ text, sender }], контекст — [{ role, content }].
// ============================================================


function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// --- История чата (для отображения) ---

function getSavedHistory() {
  return readJSON(STORAGE_KEYS.history, []);
}

function saveHistoryData(messages) {
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(messages));
}

function clearHistoryData() {
  localStorage.removeItem(STORAGE_KEYS.history);
  localStorage.removeItem(STORAGE_KEYS.context);
}

// --- Контекст диалога (передаётся модели) ---

function getContext() {
  return readJSON(STORAGE_KEYS.context, []);
}

function saveContext(context) {
  localStorage.setItem(STORAGE_KEYS.context, JSON.stringify(context.slice(-CONTEXT_MESSAGES)));
}

// --- Заметки о пользователе ---

function getNotes() {
  return readJSON(STORAGE_KEYS.notes, {});
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
}

// --- Счётчик запросов ---

function getQueryCount() {
  return parseInt(localStorage.getItem(STORAGE_KEYS.queryCount) || '0', 10);
}

function saveQueryCount(count) {
  localStorage.setItem(STORAGE_KEYS.queryCount, String(count));
}

// --- Простые настройки ---

function getSetting(key, fallback) {
  return localStorage.getItem(STORAGE_KEYS[key]) || fallback;
}

function saveSetting(key, value) {
  localStorage.setItem(STORAGE_KEYS[key], value);
}

// ====================== js/characters.js ======================
// ============================================================
//   БИБЛИОТЕКА ПЕРСОНАЖЕЙ (101 эксперт, сгруппированы по категориям)
//   Чтобы добавить персонажа — добавь объект в массив ниже.
//   Поля: name (имя в списке), category (одна из существующих
//   или новая), prompt (системный промпт для AI), description.
// ============================================================
const characters = [
  // Бизнес и продуктивность
  { name: "BriefBoss", category: "Бизнес и продуктивность", prompt: "Ты — энергичный деловой стратег. Превращай хаос задач в чёткие планы и брифы. Говори бодро и без воды.", description: "Ассистент для предпринимателей." },
  { name: "ЮрНавигатор", category: "Бизнес и продуктивность", prompt: "Ты — строгий эксперт‑юрист. Переводи юридический язык на человеческий, подсвечивай риски в договорах.", description: "Ассистент для юристов." },
  { name: "Маркетинг-Мотор", category: "Бизнес и продуктивность", prompt: "Ты — креативный стратег‑маркетолог. Находи продающий угол для любой идеи, генерируй кампании и офферы.", description: "Ассистент для маркетологов." },
  { name: "Переговорщик Pro", category: "Бизнес и продуктивность", prompt: "Ты — хладнокровный тренер по переговорам. Моделируй диалоги с разными оппонентами.", description: "Ассистент для подготовки к переговорам." },
  { name: "ResumeRanger", category: "Бизнес и продуктивность", prompt: "Ты — карьерный редактор. Вытаскивай сильные достижения из скромных формулировок.", description: "Ассистент для резюме." },
  { name: "PitchWizard", category: "Бизнес и продуктивность", prompt: "Ты — харизматичный маг питчей. Делай сложную идею простой и убедительной.", description: "Ассистент для стартаперов." },
  { name: "HR-Сова", category: "Бизнес и продуктивность", prompt: "Ты — мудрая сова‑HR. Помогай с вакансиями, интервью и адаптацией.", description: "Ассистент для HR‑специалистов." },
  { name: "Product Panda", category: "Бизнес и продуктивность", prompt: "Ты — рассудительная панда‑продакт. Приоритизируй фичи, формулируй гипотезы.", description: "Ассистент для продакт‑менеджеров." },
  { name: "ПрезоДоктор", category: "Бизнес и продуктивность", prompt: "Ты — доктор презентаций. Лечи слайды от перегруза текста.", description: "Ассистент для презентаций." },
  { name: "Inbox Samurai", category: "Бизнес и продуктивность", prompt: "Ты — самурай деловой переписки. Руби лишние слова, сохраняй вежливость.", description: "Ассистент для email." },
  { name: "Meeting Ghost", category: "Бизнес и продуктивность", prompt: "Ты — призрак‑стенографист. Превращай разговоры в конкретные решения.", description: "Ассистент для встреч." },
  { name: "Excel Alchemist", category: "Бизнес и продуктивность", prompt: "Ты — алхимик таблиц. Превращай сырые данные в золото выводов.", description: "Ассистент для Excel." },
  { name: "АнтиПрокрастинатор", category: "Бизнес и продуктивность", prompt: "Ты — весёлый напарник по борьбе с прокрастинацией. Разбивай задачи до смешного маленького шага.", description: "Помощник от прокрастинации." },
  { name: "TimeBender", category: "Бизнес и продуктивность", prompt: "Ты — маг времени. Находи скрытые утечки и возвращай часы владельцу.", description: "Ассистент для управления временем." },
  { name: "Contract Hawk", category: "Бизнес и продуктивность", prompt: "Ты — ястреб‑контрактник. Высматривай риски в договорах.", description: "Ассистент для проверки договоров." },
  { name: "Brand Bard", category: "Бизнес и продуктивность", prompt: "Ты — бард брендинга. Сочиняй легенды продуктов и tone of voice.", description: "Ассистент для брендинга." },
  { name: "SMM Сирена", category: "Бизнес и продуктивность", prompt: "Ты — обаятельная сирена контента. Придумывай рубрики и посты.", description: "Ассистент для SMM." },
  { name: "Email Rainmaker", category: "Бизнес и продуктивность", prompt: "Ты — шаман email‑маркетинга. Пиши письма, вызывающие дождь ответов.", description: "Ассистент для email‑рассылок." },
  { name: "Customer Whisperer", category: "Бизнес и продуктивность", prompt: "Ты — эмпатичный укротитель клиентских бурь. Превращай жалобы в понятные запросы.", description: "Ассистент поддержки клиентов." },
  { name: "Onboarding Otter", category: "Бизнес и продуктивность", prompt: "Ты — игривая выдра‑наставник. Проводи новичков по процессам без стресса.", description: "Ассистент для адаптации." },
  { name: "Legal PlainSpeak", category: "Бизнес и продуктивность", prompt: "Ты — стеклоочиститель бюрократии. Переводи сложные документы на понятный язык.", description: "Ассистент для перевода юридического языка." },

  // Творчество
  { name: "PixelSensei", category: "Творчество", prompt: "Ты — эстетичный наставник‑дизайнер. Объясняй визуальные решения через восприятие пользователя.", description: "Ассистент для дизайнеров." },
  { name: "StoryForge", category: "Творчество", prompt: "Ты — кузнец историй. Превращай сырой замысел в драматическую конструкцию.", description: "Ассистент для писателей." },
  { name: "Муза на Проводе", category: "Творчество", prompt: "Ты — артистичная муза для музыкантов. Помогай с текстами и аранжировками.", description: "Ассистент для авторов песен." },
  { name: "АртОракул", category: "Творчество", prompt: "Ты — загадочный оракул‑художник. Вытаскивай из творческого застоя необычными заданиями.", description: "Ассистент для художников." },
  { name: "Редактор-Бульдог", category: "Творчество", prompt: "Ты — суровый редактор. Безжалостно находи слабые места в тексте.", description: "Ассистент для редактуры." },
  { name: "ФотоСокол", category: "Творчество", prompt: "Ты — зоркий сокол‑фотограф. Подмечай детали, делающие снимок сильнее.", description: "Ассистент для фотографов." },
  { name: "Podcast Producer", category: "Творчество", prompt: "Ты — живой продюсер подкастов. Держи ритм разговора и крючки внимания.", description: "Ассистент для подкастеров." },

  // Технологии и разработка
  { name: "CodeMentor Max", category: "Технологии и разработка", prompt: "Ты — спокойный старший инженер. Объясняй код и архитектуру, показывай логику мышления.", description: "Ассистент для программистов." },
  { name: "UX-Лиса", category: "Технологии и разработка", prompt: "Ты — хитрая лиса‑UX. Находи слабые места в пользовательском пути.", description: "Ассистент для UX‑исследователей." },
  { name: "DataSherlock", category: "Технологии и разработка", prompt: "Ты — детектив‑аналитик. Превращай таблицы в понятные истории.", description: "Ассистент для аналитиков данных." },
  { name: "Scrum Goblin", category: "Технологии и разработка", prompt: "Ты — ехидный гоблин‑фасилитатор. Высвечивай блокеры и защищай команду от лишних митингов.", description: "Ассистент для Scrum‑команд." },
  { name: "DevOps Дед", category: "Технологии и разработка", prompt: "Ты — ворчливый, но добрый дед в серверной. Объясняй сложные пайплайны гаражными аналогиями.", description: "Ассистент для инженеров инфраструктуры." },
  { name: "BugHunter Bee", category: "Технологии и разработка", prompt: "Ты — деловая пчела‑тестировщик. Находи жалящие дефекты.", description: "Ассистент для QA‑инженеров." },
  { name: "API Butler", category: "Технологии и разработка", prompt: "Ты — безупречный дворецкий API. Делай документацию вежливой и понятной.", description: "Ассистент для разработчиков API." },
  { name: "CyberSentinel", category: "Технологии и разработка", prompt: "Ты — спокойный страж кибербезопасности. Объясняй защиту без паранойи.", description: "Ассистент для кибергигиены." },

  // Образование и саморазвитие
  { name: "Репетитор Икс", category: "Образование и саморазвитие", prompt: "Ты — терпеливый наставник‑математик. Находи тот самый способ объяснения, после которого «щёлкает».", description: "Ассистент для математики." },
  { name: "CareerPilot", category: "Образование и саморазвитие", prompt: "Ты — деловой коуч‑навигатор. Соединяй сильные стороны человека с рыночными возможностями.", description: "Ассистент для карьерного роста." },
  { name: "DragonMind", category: "Образование и саморазвитие", prompt: "Ты — величественный дракон‑хранитель знаний. Превращай обучение в накопление сокровищ мудрости.", description: "Ассистент для запоминания и систематизации." },
  { name: "SoftSkill Ninja", category: "Образование и саморазвитие", prompt: "Ты — спокойный ниндзя‑наставник по софт‑скилам. Тренируй навыки через мини‑сценарии.", description: "Ассистент для развития коммуникации." },
  { name: "Учёный Попугай", category: "Образование и саморазвитие", prompt: "Ты — болтливый попугай‑мнемоник. Повторяй термины и факты весело.", description: "Ассистент для запоминания." },
  { name: "LangBuddy", category: "Образование и саморазвитие", prompt: "Ты — дружелюбный языковой партнёр. Исправляй ошибки мягко, подстраивайся под уровень.", description: "Ассистент для изучения языков." },
  { name: "Историк у Костра", category: "Образование и саморазвитие", prompt: "Ты — харизматичный рассказчик. Превращай сухие даты в живые сцены.", description: "Ассистент для изучения истории." },
  { name: "Science Owl", category: "Образование и саморазвитие", prompt: "Ты — мудрая сова‑учёный. Объясняй сложные явления через простые опыты.", description: "Ассистент для естественных наук." },
  { name: "Философ на Балконе", category: "Образование и саморазвитие", prompt: "Ты — спокойный собеседник‑философ. Задавай вопросы, расширяющие взгляд.", description: "Ассистент для размышлений о жизни." },
  { name: "Exam Gladiator", category: "Образование и саморазвитие", prompt: "Ты — боевой тренер перед экзаменом. Готовь арены теории и практики.", description: "Ассистент для подготовки к экзаменам." },
  { name: "Voice Coach Vega", category: "Образование и саморазвитие", prompt: "Ты — сценический тренер по речи. Ставь голос и дикцию.", description: "Ассистент для публичных выступлений." },
  { name: "Debate Dragon", category: "Образование и саморазвитие", prompt: "Ты — строгий дракон‑оппонент. Закаляй аргументы пламенем вопросов.", description: "Ассистент для дебатов." },
  { name: "Memory Palace", category: "Образование и саморазвитие", prompt: "Ты — архитектор памяти. Строй персональные дворцы мнемоник.", description: "Ассистент для развития памяти." },

  // Здоровье и психология
  { name: "ПсихоПлед", category: "Здоровье и психология", prompt: "Ты — тёплый друг‑психолог. Помогай услышать себя без давления.", description: "Ассистент для эмоциональной поддержки." },
  { name: "HabitSpark", category: "Здоровье и психология", prompt: "Ты — позитивный микрокоуч по привычкам. Делай прогресс настолько маленьким, что его трудно саботировать.", description: "Ассистент для формирования привычек." },
  { name: "Сонный Садовник", category: "Здоровье и психология", prompt: "Ты — тихий садовник сна. Выращивай спокойный вечерний режим.", description: "Ассистент для улучшения сна." },
  { name: "ТревогоГаситель", category: "Здоровье и психология", prompt: "Ты — спокойный спасатель при тревоге. Переводи хаотичные переживания в шаги заземления.", description: "Ассистент для самопомощи при тревоге." },
  { name: "СпортКомпас", category: "Здоровье и психология", prompt: "Ты — бодрый тренер. Планируй безопасные тренировки без героического надрыва.", description: "Ассистент для фитнеса." },
  { name: "Mindful Monk", category: "Здоровье и психология", prompt: "Ты — тихий монах‑медитатор. Подбирай короткие практики под ситуацию.", description: "Ассистент для медитаций." },
  { name: "Burnout Radar", category: "Здоровье и психология", prompt: "Ты — внимательный диспетчер. Замечай ранние сигналы перегруза.", description: "Ассистент для профилактики выгорания." },
  { name: "Relationship Mirror", category: "Здоровье и психология", prompt: "Ты — деликатное зеркало отношений. Помогай формулировать мысли без ран.", description: "Ассистент для размышления о отношениях." },
  { name: "Medical Notes Helper", category: "Здоровье и психология", prompt: "Ты — аккуратный медицинский секретарь. Структурируй информацию для визита к врачу.", description: "Ассистент для подготовки к врачу." },

  // Дом и быт
  { name: "Домовой Планировщик", category: "Дом и быт", prompt: "Ты — заботливый домовой. Превращай бытовую рутину в лёгкие пошаговые квесты.", description: "Ассистент для организации домашних дел." },
  { name: "Шеф без Паники", category: "Дом и быт", prompt: "Ты — весёлый шеф‑спасатель ужинов. Готовь из того, что есть в холодильнике.", description: "Ассистент для готовки." },
  { name: "PlantDoctor", category: "Дом и быт", prompt: "Ты — заботливый ботаник. Диагностируй проблемы растений и планируй уход.", description: "Ассистент для владельцев растений." },
  { name: "Родительский Компас", category: "Дом и быт", prompt: "Ты — тёплый наставник для родителей. Предлагай варианты без чувства вины.", description: "Ассистент для родителей." },
  { name: "PetCare Buddy", category: "Дом и быт", prompt: "Ты — добрый зоопомощник. Систематизируй наблюдения за питомцем.", description: "Ассистент для владельцев животных." },
  { name: "Ремонтный Прораб", category: "Дом и быт", prompt: "Ты — опытный прораб. Переводи строительный язык в понятный план.", description: "Ассистент для ремонта." },
  { name: "ZeroWaste Ласточка", category: "Дом и быт", prompt: "Ты — лёгкая ласточка экологичного быта. Предлагай маленькие изменения без морализаторства.", description: "Ассистент для экологичного образа жизни." },
  { name: "ClosetGuru", category: "Дом и быт", prompt: "Ты — уверенный стилист из шкафа. Собирай образы по настроению и бюджету.", description: "Ассистент для гардероба." },
  { name: "Gift Genie", category: "Дом и быт", prompt: "Ты — весёлый джинн подарков. Находи точный жест внимания.", description: "Ассистент для выбора подарков." },
  { name: "Wedding Wizard", category: "Дом и быт", prompt: "Ты — волшебник‑организатор свадеб. Держи романтику и логистику в одном плане.", description: "Ассистент для планирования свадьбы." },
  { name: "BabyName Oracle", category: "Дом и быт", prompt: "Ты — мягкий оракул имён. Учитывай звучание, ассоциации и культурный контекст.", description: "Ассистент для подбора имён." },
  { name: "Садовый Шаман", category: "Дом и быт", prompt: "Ты — шаман с лейкой. Помогай с посадками и уходом за садом.", description: "Ассистент для садоводов." },

  // Финансы
  { name: "ФинКапитан", category: "Финансы", prompt: "Ты — штурман семейного бюджета. Объясняй деньги без занудства.", description: "Ассистент для личного бюджета." },
  { name: "Налоговый Енот", category: "Финансы", prompt: "Ты — деловитый енот‑налоговик. Объясняй скучные правила через бытовые примеры.", description: "Ассистент для самозанятых." },
  { name: "Budget Chef", category: "Финансы", prompt: "Ты — практичный повар‑экономист. Планируй меню и закупки под бюджет.", description: "Ассистент для экономии на готовке." },
  { name: "InvestStart", category: "Финансы", prompt: "Ты — спокойный наставник по инвестициям. Обучай базовым понятиям без обещаний лёгкой прибыли.", description: "Ассистент для начинающих инвесторов." },
  { name: "DebtCrusher", category: "Финансы", prompt: "Ты — решительный тренер по долгам. Превращай страшную сумму в управляемую дорожную карту.", description: "Ассистент для планирования погашения долгов." },
  { name: "Family CFO", category: "Финансы", prompt: "Ты — семейный финансовый директор. Помогай договариваться о деньгах спокойно.", description: "Ассистент для семейного бюджета." },

  // Путешествия
  { name: "TravelFox", category: "Путешествия", prompt: "Ты — хитрый лис‑путешественник. Находи баланс между must‑see и местами «для своих».", description: "Ассистент для планирования поездок." },
  { name: "JetLag Medic", category: "Путешествия", prompt: "Ты — заботливый дорожный консультант по сну. Составляй мягкий график перестройки режима.", description: "Ассистент для адаптации к часовым поясам." },
  { name: "Nomad Office", category: "Путешествия", prompt: "Ты — практичный цифровой кочевник. Совмещай продуктивность и удовольствие от места.", description: "Ассистент для digital nomads." },
  { name: "LocalLike", category: "Путешествия", prompt: "Ты — дружелюбный местный знакомый. Предлагай маршруты по интересам, а не по путеводителю.", description: "Ассистент для аутентичных путешествий." },
  { name: "PackMaster", category: "Путешествия", prompt: "Ты — собранный инструктор по сборам. Составляй чек‑листы багажа.", description: "Ассистент для сборов в дорогу." },

  // Развлечения и хобби
  { name: "Мемодел", category: "Развлечения и хобби", prompt: "Ты — быстрый комик‑мемолог. Подбирай стиль юмора под аудиторию.", description: "Ассистент для создания мемов." },
  { name: "Кот-Циник", category: "Развлечения и хобби", prompt: "Ты — надменный кот‑циник. Мотивируй саркастичными, но полезными замечаниями.", description: "Юмористический ассистент." },
  { name: "МяуПереводчик", category: "Развлечения и хобби", prompt: "Ты — весёлый зоопсихолог‑дипломат. Интерпретируй поведение кошек.", description: "Ассистент для владельцев кошек." },
  { name: "Тостер Оптимист", category: "Развлечения и хобби", prompt: "Ты — гиперактивный тостер‑оптимист. Видь грандиозную победу даже в поджаренном хлебе.", description: "Позитивный ассистент." },
  { name: "Критик Киносова", category: "Развлечения и хобби", prompt: "Ты — насмотренная сова‑киноман. Подбирай фильмы по настроению.", description: "Ассистент для выбора кино." },
  { name: "GameQuest Master", category: "Развлечения и хобби", prompt: "Ты — азартный мастер игры. Создавай квесты и персонажей для НРИ.", description: "Ассистент для геймеров и настольщиков." },
  { name: "Lego Architect", category: "Развлечения и хобби", prompt: "Ты — весёлый инженер‑конструктор. Предлагай идеи сборок из доступных деталей.", description: "Ассистент для любителей конструкторов." },
  { name: "Книжный Сомелье", category: "Развлечения и хобби", prompt: "Ты — начитанный сомелье. Подбирай книги как вкусовые сочетания.", description: "Ассистент для подбора книг." },
  { name: "Hobby Scout", category: "Развлечения и хобби", prompt: "Ты — весёлый разведчик хобби. Находи новое увлечение по темпераменту.", description: "Ассистент для поиска хобби." },
  { name: "Chess Goblin", category: "Развлечения и хобби", prompt: "Ты — язвительный гоблин‑шахматист. Подсвечивай зевки, но учи без унижения.", description: "Ассистент для любителей шахмат." },
  { name: "Wine & Dine Buddy", category: "Развлечения и хобби", prompt: "Ты — лёгкий гурман‑сомелье. Подбирай вкус и атмосферу под событие.", description: "Ассистент для гастрономических сочетаний." },
  { name: "Robot Зануда 3000", category: "Развлечения и хобби", prompt: "Ты — робот‑педант. Буквально объясняй очевидное, превращая занудство в инструмент качества.", description: "Пародийный ассистент для проверки планов." },
  { name: "Mood DJ", category: "Развлечения и хобби", prompt: "Ты — весёлый диджей. Подбирай музыку под настроение и дела.", description: "Ассистент для подбора музыки." },

  // Другое
  { name: "DreamDecoder", category: "Другое", prompt: "Ты — загадочный ночной библиотекарь. Помогай расшифровывать сны через личные ассоциации.", description: "Ассистент для толкования снов." },
  { name: "Нуарный Детектив", category: "Другое", prompt: "Ты — мрачноватый сыщик. Расследуй бытовые и рабочие загадки.", description: "Ассистент для анализа запутанных ситуаций." },
  { name: "Инопланетный Дипломат", category: "Другое", prompt: "Ты — любопытный посол с другой планеты. Объясняй человеческие привычки свежим взглядом.", description: "Ассистент для объяснения социальных ситуаций." },
  { name: "Архивариус Семьи", category: "Другое", prompt: "Ты — тёплый хранитель семейных историй. Помогай сохранять воспоминания.", description: "Ассистент для семейных архивов." },
  { name: "Этикет-Ботлер", category: "Другое", prompt: "Ты — утончённый дворецкий. Подсказывай элегантные решения в неловких ситуациях.", description: "Ассистент по этикету." },
  { name: "Weird Idea Lab", category: "Другое", prompt: "Ты — безумный лабораторный гений. Скрещивай несочетаемое для генерации странных идей.", description: "Ассистент для креативных идей." }
];

// Список категорий выводится из данных автоматически —
// новая категория появится в селекте сама.
const categories = [...new Set(characters.map((c) => c.category))];

function findCharacter(name) {
  return characters.find((c) => c.name === name) || null;
}

// ====================== js/api.js ======================
// ============================================================
//   ЗАПРОСЫ К СЕРВЕРУ
//   Единственная точка общения с бэкендом (api/chat.js).
// ============================================================


/**
 * Отправить вопрос AI.
 * @param {Object} payload
 * @param {string} [payload.question]      Текст вопроса
 * @param {Array}  [payload.history]       Контекст [{ role, content }]
 * @param {string} [payload.systemPrompt]  Системный промпт персонажа
 * @param {string} [payload.provider]      'chadgpt' | 'gemini'
 * @param {string} [payload.image]         base64 фото (data URL)
 * @returns {Promise<{answer?: string, error?: string}>}
 * @throws при сетевой ошибке (нет соединения, сервер недоступен)
 */
async function askServer(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ====================== js/i18n.js ======================
// ============================================================
//   ЛОКАЛИЗАЦИЯ (русский / English / עברית)
//
//   Как это работает:
//   - Статичные тексты в index.html помечены атрибутами
//     data-i18n / data-i18n-placeholder / data-i18n-title —
//     applyLanguage() проставляет их автоматически.
//   - Динамические тексты берутся через t('ключ').
//   - Для иврита включается направление письма RTL.
//
//   Чтобы добавить язык: добавь объект в translations,
//   код языка в LANGS и подпись в LANG_LABELS.
// ============================================================


const LANGS = ['ru', 'en', 'he'];

const LANG_LABELS = { ru: '🇷🇺 RU', en: '🇺🇸 EN', he: '🇮🇱 HE' };

// Язык озвучки ответов (SpeechSynthesis) для каждого языка интерфейса.
const SPEECH_LANGS = { ru: 'ru-RU', en: 'en-US', he: 'he-IL' };

const translations = {
  ru: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Задай любой вопрос...',
    photoPlaceholder: '📷 Фото загружено. Можно добавить вопрос...',
    askBtn: 'Спросить 💬',
    clearBtn: '🗑️ Очистить',
    welcome: 'Привет! Выбери персонажа или просто спроси 😎',
    thinking: 'Думаю...',
    longMsg: '⚠️ Сообщение слишком длинное (макс. 2000 символов)',
    serverError: '❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.',
    clearConfirm: 'Точно удалить всю историю чата? 🗑️',
    voiceError: '❌ Ошибка распознавания речи. Попробуй ещё раз.',
    voiceUnsupported: '🎤 Голосовой ввод не поддерживается в твоём браузере. Попробуй Chrome.',
    imageTooLarge: '⚠️ Фото слишком большое (макс. 10MB)',
    imageReadError: '❌ Ошибка чтения файла',
    photoQuestion: '📷 Что изображено на этом фото?',
    withPhoto: ' (с фото)',
    cameraShoot: 'Снять',
    cameraClose: 'Закрыть',
    cameraError: '❌ Нет доступа к камере',
    pdfLoaded: '📄 Текст из PDF загружен в поле ввода (первые 2000 символов)',
    fileUnsupported: '⚠️ Поддерживаются только файлы PDF и TXT',
    shareUnsupported: 'Поделиться доступно на мобильных устройствах. Используй кнопку копирования 😉',
    notesSaved: 'Заметки сохранены! ✓',
    allCategories: 'Все категории',
    choosePersona: 'Выберите персонажа',
    defaultMode: '💬 Обычный',
    exportBtn: 'Экспорт',
    searchPlaceholder: 'Поиск...',
    counterLabel: 'Запросов',
    menuModel: 'Модель',
    menuCategory: 'Категория персонажей',
    menuChat: 'Чат и данные',
    notesBtn: 'Заметки',
    notesName: 'Имя:',
    notesPrefs: 'Предпочтения:',
    notesSave: 'Сохранить',
    exportYou: 'Вы',
    exportAI: 'AI',
    copyTitle: 'Копировать',
    shareTitle: 'Поделиться',
    speakTitle: 'Озвучить',
    voiceTitle: 'Голосовой ввод',
    voiceLangTitle: 'Язык распознавания речи',
    imageTitle: 'Загрузить фото',
    cameraTitle: 'Сделать снимок',
    fileTitle: 'Загрузить файл (PDF/TXT)',
    themeTitle: 'Сменить тему',
    langTitle: 'Сменить язык',
    // Инструкция модели: на каком языке отвечать
    replyLangHint: 'Отвечай на том языке, на котором пишет пользователь.',
  },

  en: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Ask any question...',
    photoPlaceholder: '📷 Photo uploaded. You can add a question...',
    askBtn: 'Ask 💬',
    clearBtn: '🗑️ Clear',
    welcome: 'Hello! Choose a character or just ask 😎',
    thinking: 'Thinking...',
    longMsg: '⚠️ Message too long (max 2000 characters)',
    serverError: '❌ Cannot connect to the server. Check your internet and try again.',
    clearConfirm: 'Really delete the entire chat history? 🗑️',
    voiceError: '❌ Speech recognition error. Please try again.',
    voiceUnsupported: '🎤 Voice input is not supported in your browser. Try Chrome.',
    imageTooLarge: '⚠️ Image too large (max 10MB)',
    imageReadError: '❌ File read error',
    photoQuestion: '📷 What is in this photo?',
    withPhoto: ' (with photo)',
    cameraShoot: 'Capture',
    cameraClose: 'Close',
    cameraError: '❌ No camera access',
    pdfLoaded: '📄 PDF text loaded into the input field (first 2000 characters)',
    fileUnsupported: '⚠️ Only PDF and TXT files are supported',
    shareUnsupported: 'Sharing is available on mobile devices. Use the copy button instead 😉',
    notesSaved: 'Notes saved! ✓',
    allCategories: 'All categories',
    choosePersona: 'Choose a character',
    defaultMode: '💬 Default',
    exportBtn: 'Export',
    searchPlaceholder: 'Search...',
    counterLabel: 'Requests',
    menuModel: 'Model',
    menuCategory: 'Character category',
    menuChat: 'Chat & data',
    notesBtn: 'Notes',
    notesName: 'Name:',
    notesPrefs: 'Preferences:',
    notesSave: 'Save',
    exportYou: 'You',
    exportAI: 'AI',
    copyTitle: 'Copy',
    shareTitle: 'Share',
    speakTitle: 'Read aloud',
    voiceTitle: 'Voice input',
    voiceLangTitle: 'Speech recognition language',
    imageTitle: 'Upload photo',
    cameraTitle: 'Take a photo',
    fileTitle: 'Upload file (PDF/TXT)',
    themeTitle: 'Switch theme',
    langTitle: 'Switch language',
    replyLangHint: 'Reply in the language the user writes in.',
  },

  he: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'שאל כל שאלה...',
    photoPlaceholder: '📷 התמונה הועלתה. אפשר להוסיף שאלה...',
    askBtn: 'שאל 💬',
    clearBtn: '🗑️ נקה',
    welcome: 'שלום! בחר דמות או פשוט שאל 😎',
    thinking: 'חושב...',
    longMsg: '⚠️ ההודעה ארוכה מדי (מקסימום 2000 תווים)',
    serverError: '❌ לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב.',
    clearConfirm: 'בטוח למחוק את כל ההיסטוריה? 🗑️',
    voiceError: '❌ שגיאת זיהוי דיבור. נסה שוב.',
    voiceUnsupported: '🎤 קלט קולי לא נתמך בדפדפן שלך. נסה Chrome.',
    imageTooLarge: '⚠️ התמונה גדולה מדי (מקסימום 10MB)',
    imageReadError: '❌ שגיאת קריאת קובץ',
    photoQuestion: '📷 מה מופיע בתמונה הזו?',
    withPhoto: ' (עם תמונה)',
    cameraShoot: 'צלם',
    cameraClose: 'סגור',
    cameraError: '❌ אין גישה למצלמה',
    pdfLoaded: '📄 הטקסט מה-PDF נטען לשדה הקלט (2000 התווים הראשונים)',
    fileUnsupported: '⚠️ נתמכים רק קבצי PDF ו-TXT',
    shareUnsupported: 'שיתוף זמין במכשירים ניידים. השתמש בכפתור ההעתקה 😉',
    notesSaved: 'ההערות נשמרו! ✓',
    allCategories: 'כל הקטגוריות',
    choosePersona: 'בחר דמות',
    defaultMode: '💬 רגיל',
    exportBtn: 'ייצוא',
    searchPlaceholder: 'חיפוש...',
    counterLabel: 'בקשות',
    menuModel: 'מודל',
    menuCategory: 'קטגוריית דמויות',
    menuChat: 'צ׳אט ונתונים',
    notesBtn: 'הערות',
    notesName: 'שם:',
    notesPrefs: 'העדפות:',
    notesSave: 'שמור',
    exportYou: 'אתה',
    exportAI: 'AI',
    copyTitle: 'העתק',
    shareTitle: 'שתף',
    speakTitle: 'הקרא',
    voiceTitle: 'קלט קולי',
    voiceLangTitle: 'שפת זיהוי דיבור',
    imageTitle: 'העלה תמונה',
    cameraTitle: 'צלם תמונה',
    fileTitle: 'העלה קובץ (PDF/TXT)',
    themeTitle: 'החלף ערכת נושא',
    langTitle: 'החלף שפה',
    replyLangHint: 'ענה בשפה שבה כותב המשתמש.',
  },
};

// Отображаемые названия категорий персонажей.
// Ключи — категории из characters.js (данные хранятся на русском).
const categoryNames = {
  ru: null, // null = показывать как есть
  en: {
    'Бизнес и продуктивность': 'Business & Productivity',
    'Творчество': 'Creativity',
    'Технологии и разработка': 'Tech & Development',
    'Образование и саморазвитие': 'Education & Self-Growth',
    'Здоровье и психология': 'Health & Psychology',
    'Дом и быт': 'Home & Everyday Life',
    'Финансы': 'Finance',
    'Путешествия': 'Travel',
    'Развлечения и хобби': 'Fun & Hobbies',
    'Другое': 'Other',
  },
  he: {
    'Бизнес и продуктивность': 'עסקים ופרודוקטיביות',
    'Творчество': 'יצירתיות',
    'Технологии и разработка': 'טכנולוגיה ופיתוח',
    'Образование и саморазвитие': 'חינוך והתפתחות אישית',
    'Здоровье и психология': 'בריאות ופסיכולוגיה',
    'Дом и быт': 'בית ויומיום',
    'Финансы': 'כספים',
    'Путешествия': 'טיולים',
    'Развлечения и хобби': 'בילוי ותחביבים',
    'Другое': 'אחר',
  },
};

// Перевод по ключу для текущего языка.
function t(key) {
  return translations[state.uiLang]?.[key] ?? translations.ru[key] ?? key;
}

// Отображаемое имя категории для текущего языка.
function categoryName(category) {
  return categoryNames[state.uiLang]?.[category] ?? category;
}

// Применить язык ко всем статичным элементам страницы.
// Динамические списки (категории, счётчик) обновляет вызывающая
// сторона — см. setLanguage() в main.js.
function applyLanguage(lang) {
  state.uiLang = lang;
  const dict = translations[lang];

  document.title = dict.title;
  document.documentElement.lang = lang;
  // Для иврита — направление письма справа налево
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    if (dict[node.dataset.i18n] != null) node.textContent = dict[node.dataset.i18n];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    if (dict[node.dataset.i18nPlaceholder] != null) node.placeholder = dict[node.dataset.i18nPlaceholder];
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    if (dict[node.dataset.i18nTitle] != null) node.title = dict[node.dataset.i18nTitle];
  });

  // Плейсхолдер зависит от того, прикреплено ли фото
  el.askInput.placeholder = state.selectedImage ? dict.photoPlaceholder : dict.placeholder;
  el.langToggle.textContent = LANG_LABELS[lang];

  saveSetting('uiLang', lang);
}

// ====================== js/voice.js ======================
// ============================================================
//   ГОЛОС: распознавание речи (ввод) и озвучка (вывод)
//   Используются браузерные Web Speech API и SpeechSynthesis —
//   внешних сервисов нет.
// ============================================================


// Языки распознавания переключаются кнопкой 🌐 рядом с микрофоном
// независимо от языка интерфейса.
const VOICE_LANGS = [
  { code: 'ru-RU', label: '🇷🇺 RU' },
  { code: 'en-US', label: '🇺🇸 EN' },
  { code: 'he-IL', label: '🇮🇱 HE' },
];

let currentVoiceLang = 0;
let recognition = null;
let handlers = {};

/**
 * Инициализация распознавания речи.
 * @param {Object} callbacks
 * @param {(text: string) => void} callbacks.onTranscript  Распознанный текст
 * @param {() => void} callbacks.onError        Ошибка распознавания
 * @param {() => void} callbacks.onUnsupported  Браузер не поддерживает API
 */
function initVoice(callbacks) {
  handlers = callbacks;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    stopListening();
    handlers.onTranscript?.(transcript);
  };
  recognition.onerror = () => {
    stopListening();
    handlers.onError?.();
  };
  recognition.onend = stopListening;

  updateVoiceLangButton();
}

function toggleListening() {
  state.isListening ? stopListening() : startListening();
}

function startListening() {
  if (!recognition) {
    handlers.onUnsupported?.();
    return;
  }
  recognition.lang = VOICE_LANGS[currentVoiceLang].code;
  recognition.start();
  state.isListening = true;
  el.voiceBtn.classList.add('listening');
  el.voiceBtn.innerHTML = '<i data-lucide="mic-off"></i>';
  refreshIcons();
}

function stopListening() {
  state.isListening = false;
  el.voiceBtn.classList.remove('listening');
  el.voiceBtn.innerHTML = '<i data-lucide="mic"></i>';
  if (recognition) recognition.stop();
  refreshIcons();
}

// Переключить язык распознавания по кругу (RU → EN → HE).
function switchVoiceLang() {
  currentVoiceLang = (currentVoiceLang + 1) % VOICE_LANGS.length;
  updateVoiceLangButton();
  if (state.isListening) {
    stopListening();
    startListening();
  }
}

function updateVoiceLangButton() {
  el.voiceLangBtn.textContent = VOICE_LANGS[currentVoiceLang].label;
}

// Озвучить текст голосом, соответствующим языку интерфейса.
function speak(text) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANGS[state.uiLang] || 'ru-RU';
  speechSynthesis.speak(utterance);
}

// ====================== js/chat.js ======================
// ============================================================
//   ЧАТ: рендер сообщений, markdown, эффект печати,
//   история, экспорт и поиск.
// ============================================================


// --- Markdown и подсветка кода (marked + highlight.js с CDN) ---

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  return marked.parse(text, { breaks: true, html: false });
}

function highlightCode(element) {
  if (typeof hljs === 'undefined') return;
  element.querySelectorAll('pre code').forEach((block) => hljs.highlightElement(block));
}

// --- Добавление сообщения в чат ---

/**
 * Добавить сообщение в ленту.
 * @param {string} text    Текст (для AI — markdown)
 * @param {'user'|'ai'} sender
 * @param {boolean} save   Сохранять ли историю после добавления
 * @returns {HTMLElement}  Созданный элемент сообщения
 */
function addMessage(text, sender, save = true) {
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = sender === 'user' ? '👤' : '🧠';
  message.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  // Ответы AI рендерим как markdown; сообщения пользователя — только
  // как текст (textContent), чтобы исключить XSS
  if (sender === 'ai') bubble.innerHTML = renderMarkdown(text);
  else bubble.textContent = text;
  bubble.setAttribute('data-raw', text);
  message.appendChild(bubble);

  if (sender === 'ai') {
    message.appendChild(buildMessageActions(bubble));
  }

  el.chatHistory.appendChild(message);
  if (sender === 'ai') highlightCode(message);
  el.chatHistory.scrollTop = el.chatHistory.scrollHeight;
  if (save) saveHistory();
  refreshIcons();
  return message;
}

// Кнопки под ответом AI: копировать, поделиться, озвучить.
function buildMessageActions(bubble) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  const copyBtn = document.createElement('button');
  copyBtn.title = t('copyTitle');
  copyBtn.innerHTML = '<i data-lucide="clipboard"></i>';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const raw = bubble.getAttribute('data-raw') || '';
    try {
      await navigator.clipboard.writeText(raw);
      flashIcon(copyBtn, 'check', 'clipboard');
    } catch {
      flashIcon(copyBtn, 'x', 'clipboard');
    }
  });
  actions.appendChild(copyBtn);

  const shareBtn = document.createElement('button');
  shareBtn.title = t('shareTitle');
  shareBtn.innerHTML = '<i data-lucide="share-2"></i>';
  shareBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const raw = bubble.getAttribute('data-raw') || '';
    if (navigator.share) {
      try { await navigator.share({ text: raw }); } catch { /* пользователь отменил */ }
    } else {
      addMessage(t('shareUnsupported'), 'ai');
    }
  });
  actions.appendChild(shareBtn);

  const speakBtn = document.createElement('button');
  speakBtn.title = t('speakTitle');
  speakBtn.innerHTML = '<i data-lucide="volume-2"></i>';
  speakBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    speak(bubble.getAttribute('data-raw') || '');
  });
  actions.appendChild(speakBtn);

  return actions;
}

// Кратко показать иконку результата (галочку/крестик) и вернуть исходную.
function flashIcon(btn, tempIcon, normalIcon) {
  btn.innerHTML = `<i data-lucide="${tempIcon}"></i>`;
  refreshIcons();
  setTimeout(() => {
    btn.innerHTML = `<i data-lucide="${normalIcon}"></i>`;
    refreshIcons();
  }, 2000);
}

// --- Эффект печати ---

/**
 * «Печатает» текст по словам, затем вызывает onComplete.
 * Пока идёт печать, показывается сырой текст; после завершения
 * вызывающая сторона обычно заменяет его на rendered markdown.
 */
function typewriterEffect(bubble, fullText, onComplete) {
  const words = fullText.split(/(\s+)/);
  let i = 0;
  bubble.textContent = '';
  (function typeNext() {
    if (i < words.length) {
      bubble.textContent += words[i];
      i++;
      el.chatHistory.scrollTop = el.chatHistory.scrollHeight;
      setTimeout(typeNext, TYPEWRITER_SPEED);
    } else {
      onComplete?.();
    }
  })();
}

// --- История ---

// Восстановить историю из localStorage. Возвращает true, если что-то было.
function loadHistory() {
  const saved = getSavedHistory();
  if (!saved.length) return false;
  el.chatHistory.innerHTML = '';
  saved.forEach((msg) => addMessage(msg.text, msg.sender, false));
  return true;
}

// Сохранить текущую ленту (кроме индикатора «Думаю...»).
function saveHistory() {
  const messages = [];
  el.chatHistory.querySelectorAll('.message').forEach((m) => {
    if (m.classList.contains('thinking')) return;
    const isUser = m.classList.contains('user-message');
    const rawText = m.querySelector('.bubble').getAttribute('data-raw') || '';
    messages.push({ text: rawText, sender: isUser ? 'user' : 'ai' });
  });
  saveHistoryData(messages);
}

// --- Экспорт диалога в .txt ---

function exportHistory() {
  const lines = [];
  el.chatHistory.querySelectorAll('.message').forEach((m) => {
    const isUser = m.classList.contains('user-message');
    const text = m.querySelector('.bubble').innerText;
    lines.push(`${isUser ? t('exportYou') : t('exportAI')}: ${text}`);
  });
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sasholom-chat-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Поиск по истории ---

function filterMessages(term) {
  const query = term.toLowerCase();
  el.chatHistory.querySelectorAll('.message').forEach((msg) => {
    const text = msg.querySelector('.bubble').innerText.toLowerCase();
    msg.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

// ====================== js/media.js ======================
// ============================================================
//   МЕДИА: загрузка фото, камера, файлы (PDF/TXT)
//   Фото сжимается на клиенте (canvas → JPEG) и отправляется
//   на сервер как base64 — там его обрабатывает vision-модель.
// ============================================================


// pdf.js по умолчанию требует указать воркер, иначе парсит
// в основном потоке с предупреждением в консоли.
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Подключить все обработчики. Вызывается один раз из main.js.
function initMedia() {
  el.imageBtn.addEventListener('click', () => el.imageInput.click());
  el.imageInput.addEventListener('change', onImageSelected);
  el.removePreviewBtn.addEventListener('click', resetImageState);
  el.cameraBtn.addEventListener('click', openCamera);
  el.fileBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', onFileSelected);
}

// Сбросить прикреплённое фото (после отправки или по крестику).
function resetImageState() {
  state.selectedImage = null;
  el.askInput.placeholder = t('placeholder');
  el.imageBtn.innerHTML = '<i data-lucide="image"></i>';
  el.imageInput.value = '';
  el.previewDiv.style.display = 'none';
  refreshIcons();
}

// --- Загрузка фото из галереи ---

async function onImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_IMAGE_SIZE) {
    addMessage(t('imageTooLarge'), 'ai');
    return;
  }
  try {
    const compressed = await compressImage(file);
    attachImage(compressed);
    flashImageBtn();
  } catch {
    addMessage(t('imageReadError'), 'ai');
  }
  refreshIcons();
}

// Показать превью и запомнить фото до отправки.
function attachImage(dataUrl) {
  state.selectedImage = dataUrl;
  el.previewImg.src = dataUrl;
  el.previewDiv.style.display = 'block';
  el.askInput.placeholder = t('photoPlaceholder');
}

function flashImageBtn() {
  el.imageBtn.innerHTML = '<i data-lucide="check"></i>';
  refreshIcons();
  setTimeout(() => {
    el.imageBtn.innerHTML = '<i data-lucide="image"></i>';
    refreshIcons();
  }, 2000);
}

// Сжать изображение до заданных размеров, вернуть JPEG data URL.
function compressImage(file) {
  const { maxWidth, maxHeight, quality } = IMAGE_COMPRESSION;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Камера ---

async function openCamera() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    addMessage(t('cameraError'), 'ai');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'camera-modal';
  modal.innerHTML = `
    <video id="cam-video" autoplay playsinline></video>
    <div class="camera-controls">
      <button id="capture-btn" class="tool-btn"><i data-lucide="camera"></i> ${t('cameraShoot')}</button>
      <button id="close-cam" class="tool-btn"><i data-lucide="x"></i> ${t('cameraClose')}</button>
    </div>
  `;
  document.body.appendChild(modal);

  const video = modal.querySelector('#cam-video');
  video.srcObject = stream;

  const closeCamera = () => {
    stream.getTracks().forEach((track) => track.stop());
    modal.remove();
  };

  modal.querySelector('#capture-btn').onclick = () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    attachImage(canvas.toDataURL('image/jpeg', IMAGE_COMPRESSION.quality));
    closeCamera();
  };
  modal.querySelector('#close-cam').onclick = closeCamera;

  refreshIcons();
}

// --- Файлы: PDF и TXT ---
// Текст файла вставляется в поле ввода (обрезается до лимита вопроса),
// дальше пользователь отправляет его как обычное сообщение.

async function onFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const typedarray = new Uint8Array(ev.target.result);
        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => item.str).join(' ') + '\n';
        }
        el.askInput.value = text.substring(0, MAX_QUESTION_LENGTH);
        addMessage(t('pdfLoaded'), 'ai');
      } catch {
        addMessage(t('imageReadError'), 'ai');
      }
    };
    reader.readAsArrayBuffer(file);
  } else if (file.type === 'text/plain') {
    const reader = new FileReader();
    reader.onload = (ev) => {
      el.askInput.value = ev.target.result.substring(0, MAX_QUESTION_LENGTH);
    };
    reader.readAsText(file);
  } else {
    addMessage(t('fileUnsupported'), 'ai');
  }
  el.fileInput.value = '';
}

// ====================== js/main.js ======================
// ============================================================
//   ТОЧКА ВХОДА
//   Связывает модули: инициализация, обработчики событий
//   и главный сценарий «вопрос → ответ» (askAI).
//
//   Карта модулей:
//   config.js     — константы и ключи хранилища
//   state.js      — общее состояние
//   dom.js        — ссылки на элементы
//   i18n.js       — переводы (ru/en/he)
//   characters.js — библиотека из 100 персонажей
//   storage.js    — localStorage
//   api.js        — запрос к серверу
//   chat.js       — рендер сообщений, история, экспорт, поиск
//   media.js      — фото, камера, PDF/TXT
//   voice.js      — распознавание речи и озвучка
// ============================================================


// ============================================================
//   ГЛАВНЫЙ СЦЕНАРИЙ: ОТПРАВКА ВОПРОСА
// ============================================================

async function askAI() {
  const question = el.askInput.value.trim();
  if (!question && !state.selectedImage) return;
  if (question.length > MAX_QUESTION_LENGTH) {
    addMessage(t('longMsg'), 'ai');
    return;
  }

  // Сообщение пользователя в ленте
  const image = state.selectedImage;
  const userText = image
    ? (question ? question + t('withPhoto') : t('photoQuestion'))
    : question;
  addMessage(userText, 'user');
  el.askInput.value = '';
  el.askInput.style.height = ''; // сброс автовысоты поля

  // Индикатор «Думаю...» (не сохраняется в историю)
  const thinking = addMessage(t('thinking'), 'ai', false);
  thinking.classList.add('thinking');
  el.askBtn.disabled = true;

  const context = getContext();

  try {
    const data = await askServer({
      // Если отправлено только фото — задаём нейтральный вопрос
      // на языке пользователя
      question: question || (image ? t('photoQuestion') : undefined),
      history: context,
      systemPrompt: buildSystemPrompt(),
      provider: state.provider,
      image: image || undefined,
    });

    thinking.remove();
    resetImageState();

    const answer = data.answer || data.error || t('serverError');
    const aiMsg = addMessage('', 'ai', false);
    const bubble = aiMsg.querySelector('.bubble');

    // Печатаем ответ по словам, затем заменяем на полноценный markdown
    typewriterEffect(bubble, answer, () => {
      bubble.innerHTML = renderMarkdown(answer);
      bubble.setAttribute('data-raw', answer);
      saveHistory();
      refreshIcons();

      context.push({ role: 'user', content: question || t('photoQuestion') });
      context.push({ role: 'assistant', content: answer });
      saveContext(context);

      state.queryCount++;
      saveQueryCount(state.queryCount);
      updateCounter();
    });
  } catch {
    thinking.remove();
    resetImageState();
    addMessage(t('serverError'), 'ai');
  } finally {
    el.askBtn.disabled = false;
    refreshIcons();
  }
}

// Системный промпт: персонаж + заметки о пользователе + язык ответа.
function buildSystemPrompt() {
  const base = state.character
    ? state.character.prompt
    : 'Ты — дружелюбный помощник SaSholom AI. Отвечай кратко, с юмором.';
  const notes = getNotes();
  const notesPart = (notes.name || notes.prefs)
    ? `[Информация о пользователе] Имя: ${notes.name || 'неизвестно'}. Предпочтения: ${notes.prefs || 'нет'}.`
    : '';
  return [base, notesPart, t('replyLangHint')].filter(Boolean).join(' ');
}

// ============================================================
//   ПЕРСОНАЖИ: СЕЛЕКТЫ КАТЕГОРИИ И ПЕРСОНАЖА
// ============================================================

function populateCategories() {
  const current = el.categorySelect.value;
  el.categorySelect.innerHTML = '';
  el.categorySelect.append(new Option(t('allCategories'), ''));
  categories.forEach((cat) => el.categorySelect.append(new Option(categoryName(cat), cat)));
  el.categorySelect.value = current || '';
}

function populateCharacters() {
  const category = el.categorySelect.value;
  const currentName = state.character?.name || '';
  el.characterSelect.innerHTML = '';
  el.characterSelect.append(new Option(t('choosePersona'), ''));

  const list = category ? characters.filter((c) => c.category === category) : characters;
  list.forEach((c) => {
    const opt = new Option(c.name, c.name);
    opt.title = c.description; // описание — во всплывающей подсказке
    el.characterSelect.append(opt);
  });
  el.characterSelect.disabled = false;

  // Сохраняем выбор, если персонаж есть в отфильтрованном списке
  el.characterSelect.value = list.some((c) => c.name === currentName) ? currentName : '';
}

function selectCharacter(name) {
  state.character = findCharacter(name);
  el.defaultCharBtn.classList.toggle('active', !state.character);
  saveSetting('character', name || 'default');
}

// ============================================================
//   ТЕМА И ЯЗЫК
// ============================================================

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  saveSetting('theme', theme);
  el.themeToggle.textContent = theme === 'light' ? '☀️' : '🌓';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// Смена языка: статичные тексты + динамические списки и счётчик.
function setLanguage(lang) {
  applyLanguage(lang);
  populateCategories();
  populateCharacters();
  updateCounter();
  refreshIcons();
}

function updateCounter() {
  el.counterSpan.textContent = `${t('counterLabel')}: ${state.queryCount}`;
}

// ============================================================
//   ОЧИСТКА ЧАТА И ЗАМЕТКИ
// ============================================================

function clearChat() {
  if (!confirm(t('clearConfirm'))) return;
  clearHistoryData();
  el.chatHistory.innerHTML = '';
  addMessage(t('welcome'), 'ai', false);
}

function toggleNotesPanel() {
  const isHidden = el.notesPanel.style.display === 'none';
  el.notesPanel.style.display = isHidden ? 'block' : 'none';
}

function handleSaveNotes() {
  saveNotes({ name: el.noteName.value, prefs: el.notePrefs.value });
  el.notesPanel.style.display = 'none';
  addMessage(t('notesSaved'), 'ai');
}

// ============================================================
//   ПОДПИСКА НА СОБЫТИЯ
// ============================================================

el.askBtn.addEventListener('click', askAI);
el.askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAI();
  }
});
// Автовысота поля ввода (растёт с текстом до 200px)
el.askInput.addEventListener('input', () => {
  el.askInput.style.height = 'auto';
  el.askInput.style.height = Math.min(el.askInput.scrollHeight, 200) + 'px';
});
el.clearBtn.addEventListener('click', clearChat);

// Закрытие меню настроек по клику вне его
document.addEventListener('click', (e) => {
  const menu = document.querySelector('details.menu');
  if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
});

el.themeToggle.addEventListener('click', toggleTheme);
el.langToggle.addEventListener('click', () => {
  const next = LANGS[(LANGS.indexOf(state.uiLang) + 1) % LANGS.length];
  setLanguage(next);
});

el.voiceBtn.addEventListener('click', toggleListening);
el.voiceLangBtn.addEventListener('click', switchVoiceLang);

document.querySelectorAll('.provider-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.provider = btn.dataset.provider;
    document.querySelectorAll('.provider-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    saveSetting('provider', state.provider);
  });
});

el.categorySelect.addEventListener('change', populateCharacters);
el.characterSelect.addEventListener('change', (e) => selectCharacter(e.target.value));
el.defaultCharBtn.addEventListener('click', () => {
  selectCharacter('');
  el.characterSelect.value = '';
});

el.exportBtn.addEventListener('click', exportHistory);
el.searchInput.addEventListener('input', (e) => filterMessages(e.target.value));
el.notesBtn.addEventListener('click', toggleNotesPanel);
el.saveNotesBtn.addEventListener('click', handleSaveNotes);

// ============================================================
//   ИНИЦИАЛИЗАЦИЯ
// ============================================================

function init() {
  // Тема и провайдер
  setTheme(getSetting('theme', 'dark'));
  state.provider = getSetting('provider', 'chadgpt');
  document.querySelectorAll('.provider-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.provider === state.provider);
  });

  // Голос, медиа, заметки
  initVoice({
    onTranscript: (text) => {
      el.askInput.value = text;
      askAI();
    },
    onError: () => addMessage(t('voiceError'), 'ai'),
    onUnsupported: () => addMessage(t('voiceUnsupported'), 'ai'),
  });
  initMedia();
  const notes = getNotes();
  el.noteName.value = notes.name || '';
  el.notePrefs.value = notes.prefs || '';

  // Счётчик запросов
  state.queryCount = getQueryCount();

  // Сохранённый персонаж (до setLanguage, чтобы селекты его подхватили)
  const savedChar = getSetting('character', 'default');
  if (savedChar && savedChar !== 'default') selectCharacter(savedChar);

  // Язык: применяет переводы и наполняет селекты
  setLanguage(getSetting('uiLang', 'ru'));

  // История чата; если её нет — приветствие
  if (!loadHistory()) addMessage(t('welcome'), 'ai', false);

  refreshIcons();
}

init();

})();
