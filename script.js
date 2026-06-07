// ============================================================
//   DOM‑ЭЛЕМЕНТЫ
// ============================================================
const askBtn = document.getElementById('ai-ask-btn');
const askInput = document.getElementById('ai-question');
const chatHistory = document.getElementById('chat-history');
const clearBtn = document.getElementById('clear-chat-btn');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
const voiceBtn = document.getElementById('voice-btn');
const langBtn = document.getElementById('lang-btn');
const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
const cameraBtn = document.getElementById('camera-btn');
const fileInput = document.getElementById('file-input');
const fileBtn = document.getElementById('file-btn');
const exportBtn = document.getElementById('export-btn');
const searchInput = document.getElementById('search-input');
const counterSpan = document.getElementById('counter');
const notesBtn = document.getElementById('notes-btn');
const notesPanel = document.getElementById('notes-panel');
const noteName = document.getElementById('note-name');
const notePrefs = document.getElementById('note-prefs');
const saveNotesBtn = document.getElementById('save-notes-btn');
const previewDiv = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removePreviewBtn = document.getElementById('remove-preview');
const categorySelect = document.getElementById('category-select');
const characterSelect = document.getElementById('character-select');
const defaultCharBtn = document.getElementById('default-char-btn');

// ============================================================
//   КЛЮЧИ LOCALSTORAGE
// ============================================================
const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';
const UI_LANG_KEY = 'sasholom_ui_lang';
const NOTES_KEY = 'sasholom_notes';
const QUERY_COUNT_KEY = 'sasholom_query_count';
const CHARACTER_KEY = 'sasholom_character';

// ============================================================
//   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================================
let currentUILang = 'ru';
let currentRole = 'default';
let currentProvider = 'chadgpt';
let selectedImageBase64 = null;
let isListening = false;
let recognition = null;
let queryCount = parseInt(localStorage.getItem(QUERY_COUNT_KEY) || '0');
let currentCharacter = null; // null = обычный режим

// ============================================================
//   ПЕРЕВОДЫ ИНТЕРФЕЙСА
// ============================================================
const translations = {
  ru: {
    title: '🚀 SaSholom', cardTitle: '🧠 Hebrew AI',
    placeholder: 'Задай любой вопрос...', photoPlaceholder: '📷 Фото загружено...',
    askBtn: 'Спросить 💬', clearBtn: '🗑️ Очистить чат',
    welcome: 'Привет! Выбери персонажа или просто спроси 😎',
    thinking: 'Думаю...', copyBtn: 'Копировать', copied: 'Скопировано ✓',
    error: 'Ошибка', longMsg: '⚠️ Сообщение слишком длинное (макс. 2000 символов)',
    serverError: '❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.',
    clearConfirm: 'Точно удалить всю историю чата? 🗑️',
    voiceError: '❌ Ошибка распознавания речи. Попробуй ещё раз.',
    voiceUnsupported: '🎤 Голосовой ввод не поддерживается в твоём браузере. Попробуй Chrome.',
    imageTooLarge: '⚠️ Фото слишком большое (макс 4MB)', imageReadError: '❌ Ошибка чтения файла',
    footer: 'Made with 💚 by S.K.'
  },
  en: {
    title: '🚀 SaSholom', cardTitle: '🧠 Hebrew AI',
    placeholder: 'Ask any question...', photoPlaceholder: '📷 Photo uploaded...',
    askBtn: 'Ask 💬', clearBtn: '🗑️ Clear chat',
    welcome: 'Hello! Choose a character or just ask 😎',
    thinking: 'Thinking...', copyBtn: 'Copy', copied: 'Copied ✓',
    error: 'Error', longMsg: '⚠️ Message too long (max 2000 chars)',
    serverError: '❌ Cannot connect to server. Check internet and try again.',
    clearConfirm: 'Really delete entire chat history? 🗑️',
    voiceError: '❌ Speech recognition error. Please try again.',
    voiceUnsupported: '🎤 Voice input not supported in your browser. Try Chrome.',
    imageTooLarge: '⚠️ Image too large (max 4MB)', imageReadError: '❌ File read error',
    footer: 'Made with 💚 by S.K.'
  },
  he: {
    title: '🚀 SaSholom', cardTitle: '🧠 Hebrew AI',
    placeholder: 'שאל כל שאלה...', photoPlaceholder: '📷 תמונה הועלתה...',
    askBtn: 'שאל 💬', clearBtn: '🗑️ נקה צ\'אט',
    welcome: 'שלום! בחר דמות או פשוט שאל 😎',
    thinking: 'חושב...', copyBtn: 'העתק', copied: 'הועתק ✓',
    error: 'שגיאה', longMsg: '⚠️ הודעה ארוכה מדי (מקסימום 2000 תווים)',
    serverError: '❌ לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב.',
    clearConfirm: 'בטוח למחוק את כל ההיסטוריה? 🗑️',
    voiceError: '❌ שגיאת זיהוי דיבור. נסה שוב.',
    voiceUnsupported: '🎤 קלט קולי לא נתמך בדפדפן שלך. נסה Chrome.',
    imageTooLarge: '⚠️ תמונה גדולה מדי (מקסימום 4MB)', imageReadError: '❌ שגיאת קריאת קובץ',
    footer: 'Made with 💚 by S.K.'
  }
};

function applyLanguage(lang) {
  currentUILang = lang;
  const t = translations[lang];
  document.title = t.title;
  document.querySelector('h1').textContent = t.title;
  document.querySelector('.card h2').textContent = t.cardTitle;
  if (!selectedImageBase64) askInput.placeholder = t.placeholder;
  else askInput.placeholder = t.photoPlaceholder;
  askBtn.textContent = t.askBtn;
  clearBtn.textContent = t.clearBtn;
  document.querySelector('footer').innerHTML = t.footer.replace('💚', '<span>💚</span>');
  const langLabels = { ru: '🇷🇺 RU', en: '🇺🇸 EN', he: '🇮🇱 HE' };
  if (langToggle) langToggle.textContent = langLabels[lang];
  localStorage.setItem(UI_LANG_KEY, lang);
  refreshIcons();
}

// ============================================================
//   БИБЛИОТЕКА ПЕРСОНАЖЕЙ (100 штук)
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

// ============================================================
//   ЛОГИКА ВЫБОРА ПЕРСОНАЖА
// ============================================================
function updateCharacterList() {
  const category = categorySelect.value;
  characterSelect.innerHTML = '<option value="">Выберите персонажа</option>';
  const filtered = category ? characters.filter(c => c.category === category) : characters;
  filtered.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    characterSelect.appendChild(opt);
  });
  characterSelect.disabled = false;
}

function selectCharacter(name) {
  currentCharacter = characters.find(c => c.name === name) || null;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (!currentCharacter && defaultCharBtn) {
    defaultCharBtn.classList.add('active');
  }
  localStorage.setItem(CHARACTER_KEY, name || 'default');
}

if (defaultCharBtn) {
  defaultCharBtn.addEventListener('click', () => {
    selectCharacter(null);
    characterSelect.value = '';
  });
}

// ============================================================
//   ИКОНКИ LUCIDE
// ============================================================
function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

// ============================================================
//   СЖАТИЕ ИЗОБРАЖЕНИЙ
// ============================================================
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
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

function resetImageState() {
  selectedImageBase64 = null;
  askInput.placeholder = translations[currentUILang].placeholder;
  if (imageBtn) imageBtn.innerHTML = '<i data-lucide="image"></i>';
  if (imageInput) imageInput.value = '';
  if (previewDiv) previewDiv.style.display = 'none';
  refreshIcons();
}

// ============================================================
//   ЗАГРУЗКА ФОТО
// ============================================================
if (imageInput) {
  imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addMessage(translations[currentUILang].imageTooLarge, 'ai');
      return;
    }
    try {
      const compressed = await compressImage(file);
      selectedImageBase64 = compressed;
      previewImg.src = compressed;
      previewDiv.style.display = 'block';
      askInput.placeholder = translations[currentUILang].photoPlaceholder;
      if (imageBtn) imageBtn.innerHTML = '<i data-lucide="check"></i>';
      setTimeout(() => { if (imageBtn) imageBtn.innerHTML = '<i data-lucide="image"></i>'; refreshIcons(); }, 2000);
    } catch (err) {
      addMessage(translations[currentUILang].imageReadError, 'ai');
    }
    refreshIcons();
  });
}

if (imageBtn) {
  imageBtn.addEventListener('click', () => imageInput.click());
}

if (removePreviewBtn) {
  removePreviewBtn.addEventListener('click', () => {
    selectedImageBase64 = null;
    previewDiv.style.display = 'none';
    imageInput.value = '';
    askInput.placeholder = translations[currentUILang].placeholder;
  });
}

// ============================================================
//   КАМЕРА
// ============================================================
cameraBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const modal = document.createElement('div');
    modal.className = 'camera-modal';
    modal.innerHTML = `
      <video id="cam-video" autoplay style="width:100%;max-width:400px;border-radius:10px;"></video>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:10px;">
        <button id="capture-btn" class="tool-btn"><i data-lucide="camera"></i> Снять</button>
        <button id="close-cam" class="tool-btn"><i data-lucide="x"></i> Закрыть</button>
      </div>
    `;
    document.body.appendChild(modal);
    const video = document.getElementById('cam-video');
    video.srcObject = stream;
    document.getElementById('capture-btn').onclick = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      selectedImageBase64 = canvas.toDataURL('image/jpeg', 0.7);
      previewImg.src = selectedImageBase64;
      previewDiv.style.display = 'block';
      askInput.placeholder = translations[currentUILang].photoPlaceholder;
      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    };
    document.getElementById('close-cam').onclick = () => {
      stream.getTracks().forEach(t => t.stop());
      modal.remove();
    };
    lucide.createIcons();
  } catch (err) {
    addMessage('Нет доступа к камере', 'ai');
  }
});

// ============================================================
//   ЗАГРУЗКА ФАЙЛОВ (PDF/TXT)
// ============================================================
fileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type === 'application/pdf') {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const typedarray = new Uint8Array(ev.target.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      askInput.value = text.substring(0, 2000);
      addMessage(`📄 Текст из PDF загружен (первые 2000 символов)`, 'ai');
    };
    reader.readAsArrayBuffer(file);
  } else if (file.type === 'text/plain') {
    const reader = new FileReader();
    reader.onload = (ev) => {
      askInput.value = ev.target.result.substring(0, 2000);
    };
    reader.readAsText(file);
  }
});

// ============================================================
//   ЭКСПОРТ ИСТОРИИ
// ============================================================
exportBtn.addEventListener('click', () => {
  const messages = [];
  chatHistory.querySelectorAll('.message').forEach(m => {
    const isUser = m.classList.contains('user-message');
    const text = m.querySelector('.bubble').innerText;
    messages.push((isUser ? 'Вы' : 'AI') + ': ' + text);
  });
  const blob = new Blob([messages.join('\n\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sasholom-chat.txt';
  a.click();
});

// ============================================================
//   ПОИСК ПО ИСТОРИИ
// ============================================================
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.message').forEach(msg => {
    const text = msg.querySelector('.bubble').innerText.toLowerCase();
    msg.style.display = text.includes(term) ? 'flex' : 'none';
  });
});

// ============================================================
//   ЗАМЕТКИ
// ============================================================
notesBtn.addEventListener('click', () => {
  notesPanel.style.display = notesPanel.style.display === 'none' ? 'block' : 'none';
});

saveNotesBtn.addEventListener('click', () => {
  const notes = { name: noteName.value, prefs: notePrefs.value };
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  notesPanel.style.display = 'none';
  addMessage('Заметки сохранены!', 'ai');
});

const savedNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
if (noteName) noteName.value = savedNotes.name || '';
if (notePrefs) notePrefs.value = savedNotes.prefs || '';

function getNotesPrompt() {
  const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
  if (notes.name || notes.prefs) {
    return `[Информация о пользователе] Имя: ${notes.name || 'неизвестно'}. Предпочтения: ${notes.prefs || 'нет'}.`;
  }
  return '';
}

// ============================================================
//   MARKDOWN И ПОДСВЕТКА
// ============================================================
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  return marked.parse(text, { breaks: true, html: false });
}
function highlightCode(element) {
  if (typeof hljs === 'undefined') return;
  element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
}

// ============================================================
//   ЭФФЕКТ ПЕЧАТИ
// ============================================================
function typewriterEffect(bubble, fullText, speed = 30, onComplete) {
  const words = fullText.split(/(\s+)/);
  let i = 0;
  bubble.textContent = '';
  function typeNext() {
    if (i < words.length) {
      bubble.textContent += words[i];
      i++;
      chatHistory.scrollTop = chatHistory.scrollHeight;
      setTimeout(typeNext, speed);
    } else if (onComplete) onComplete();
  }
  typeNext();
}

// ============================================================
//   ИСТОРИЯ И КОНТЕКСТ
// ============================================================
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    chatHistory.innerHTML = '';
    JSON.parse(saved).forEach(msg => addMessage(msg.text, msg.sender, false));
  }
}
function saveHistory() {
  const messages = [];
  chatHistory.querySelectorAll('.message').forEach(m => {
    if (m.classList.contains('thinking')) return;
    const isUser = m.classList.contains('user-message');
    const rawText = m.querySelector('.bubble').getAttribute('data-raw') || '';
    messages.push({ text: rawText, sender: isUser ? 'user' : 'ai' });
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}
function getContext() {
  const saved = localStorage.getItem(CONTEXT_KEY);
  return saved ? JSON.parse(saved) : [];
}
function saveContext(context) {
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(context.slice(-10)));
}

// ============================================================
//   ДОБАВЛЕНИЕ СООБЩЕНИЯ
// ============================================================
function addMessage(text, sender, save = true) {
  const t = translations[currentUILang];
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (sender === 'ai') bubble.innerHTML = renderMarkdown(text);
  else bubble.textContent = text;
  bubble.setAttribute('data-raw', text);

  message.innerHTML = '';
  message.appendChild(document.createElement('span')).className = 'avatar';
  message.querySelector('.avatar').textContent = avatar;
  message.appendChild(bubble);

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  if (sender === 'ai') {
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '<i data-lucide="clipboard"></i>';
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const raw = bubble.getAttribute('data-raw') || '';
      try {
        await navigator.clipboard.writeText(raw);
        copyBtn.innerHTML = '<i data-lucide="check"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i data-lucide="clipboard"></i>'; refreshIcons(); }, 2000);
        refreshIcons();
      } catch (err) {
        copyBtn.innerHTML = '<i data-lucide="x"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i data-lucide="clipboard"></i>'; refreshIcons(); }, 2000);
      }
    });
    actions.appendChild(copyBtn);

    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '<i data-lucide="share-2"></i>';
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (navigator.share) {
        try { await navigator.share({ text }); } catch (err) {}
      } else {
        addMessage('Поделиться можно только на мобильных устройствах или через копирование ссылки.', 'ai');
      }
    });
    actions.appendChild(shareBtn);

    const speakBtn = document.createElement('button');
    speakBtn.innerHTML = '<i data-lucide="volume-2"></i>';
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      speechSynthesis.speak(utterance);
    });
    actions.appendChild(speakBtn);
  }
  message.appendChild(actions);
  chatHistory.appendChild(message);
  if (sender === 'ai') highlightCode(message);
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  refreshIcons();
  return message;
}

// ============================================================
//   ОТПРАВКА ВОПРОСА
// ============================================================
async function askAI() {
  const t = translations[currentUILang];
  const question = askInput.value.trim();
  if (!question && !selectedImageBase64) return;
  if (question && question.length > 2000) {
    addMessage(t.longMsg, 'ai');
    return;
  }

  if (selectedImageBase64 && !question) addMessage('📷 Посмотри фото и скажи, какое благословение нужно произнести', 'user');
  else if (selectedImageBase64 && question) addMessage(question + ' (с фото)', 'user');
  else addMessage(question, 'user');
  askInput.value = '';

  const thinking = addMessage(t.thinking, 'ai', false);
  thinking.classList.add('thinking');
  askBtn.disabled = true;

  const context = getContext();
  const notesPrompt = getNotesPrompt();
  const basePrompt = currentCharacter ? currentCharacter.prompt : 'Ты — дружелюбный помощник SaSholom AI. Отвечай кратко, с юмором.';
  const systemPrompt = [basePrompt, notesPrompt].filter(Boolean).join(' ');

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question || undefined,
        history: context,
        systemPrompt,
        provider: currentProvider,
        image: selectedImageBase64 || undefined
      })
    });

    const data = await res.json();
    thinking.remove();
    resetImageState();

    const answer = data.answer || data.error || '🤷 Извини, что-то пошло не так. Попробуй ещё раз.';
    const aiMsg = addMessage('', 'ai', false);
    const bubble = aiMsg.querySelector('.bubble');
    bubble.innerHTML = ''; bubble.textContent = '';

    typewriterEffect(bubble, answer, 30, () => {
      bubble.innerHTML = renderMarkdown(answer);
      bubble.setAttribute('data-raw', answer);
      highlightCode(aiMsg);
      context.push({ role: 'user', content: question || '📷 Фото' });
      context.push({ role: 'assistant', content: answer });
      saveContext(context);
      saveHistory();
      queryCount++;
      localStorage.setItem(QUERY_COUNT_KEY, queryCount);
      if (counterSpan) counterSpan.textContent = `Запросов: ${queryCount}`;
    });
  } catch (err) {
    thinking.remove();
    resetImageState();
    addMessage(t.serverError, 'ai');
  } finally {
    askBtn.disabled = false;
    refreshIcons();
  }
}

// ============================================================
//   ОЧИСТКА ЧАТА
// ============================================================
function clearChat() {
  const t = translations[currentUILang];
  if (!confirm(t.clearConfirm)) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  chatHistory.innerHTML = '';
  addMessage(t.welcome, 'ai');
}

// ============================================================
//   ТЕМА
// ============================================================
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sasholom_theme', theme);
  if (themeToggle) themeToggle.textContent = theme === 'light' ? '☀️' : '🌓';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

// ============================================================
//   ГОЛОСОВОЙ ВВОД
// ============================================================
const voiceLangs = [
  { code: 'ru-RU', label: '🇷🇺 RU' },
  { code: 'en-US', label: '🇺🇸 EN' },
  { code: 'he-IL', label: '🇮🇱 HE' }
];
let currentVoiceLang = 0;

function updateLangButton() {
  if (langBtn) langBtn.textContent = voiceLangs[currentVoiceLang].label;
}
function switchLanguage() {
  currentVoiceLang = (currentVoiceLang + 1) % voiceLangs.length;
  updateLangButton();
  if (isListening) { stopListening(); startListening(); }
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    askInput.value = event.results[0][0].transcript;
    stopListening();
    askAI();
  };
  recognition.onerror = () => {
    stopListening();
    addMessage(translations[currentUILang].voiceError, 'ai');
  };
  recognition.onend = stopListening;
}

function startListening() {
  if (!recognition) {
    addMessage(translations[currentUILang].voiceUnsupported, 'ai');
    return;
  }
  recognition.lang = voiceLangs[currentVoiceLang].code;
  recognition.start();
  isListening = true;
  voiceBtn.classList.add('listening');
  voiceBtn.innerHTML = '<i data-lucide="mic-off"></i>';
  refreshIcons();
}
function stopListening() {
  isListening = false;
  voiceBtn.classList.remove('listening');
  voiceBtn.innerHTML = '<i data-lucide="mic"></i>';
  if (recognition) recognition.stop();
  refreshIcons();
}

// ============================================================
//   ПОДПИСКА НА СОБЫТИЯ
// ============================================================
askBtn.addEventListener('click', askAI);
clearBtn.addEventListener('click', clearChat);
themeToggle.addEventListener('click', toggleTheme);
langToggle.addEventListener('click', () => {
  const langs = ['ru', 'en', 'he'];
  const idx = langs.indexOf(currentUILang);
  applyLanguage(langs[(idx + 1) % langs.length]);
});
voiceBtn.addEventListener('click', () => isListening ? stopListening() : startListening());
langBtn.addEventListener('click', switchLanguage);
askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(); }
});
document.querySelectorAll('.provider-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentProvider = btn.dataset.provider;
    document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    localStorage.setItem('sasholom_provider', currentProvider);
  });
});
categorySelect.addEventListener('change', updateCharacterList);
characterSelect.addEventListener('change', (e) => selectCharacter(e.target.value));

// ============================================================
//   ИНИЦИАЛИЗАЦИЯ
// ============================================================
setTheme(localStorage.getItem('sasholom_theme') || 'dark');
currentProvider = localStorage.getItem('sasholom_provider') || 'chadgpt';
document.querySelectorAll('.provider-btn').forEach(b => {
  b.classList.toggle('active', b.dataset.provider === currentProvider);
});
const savedLang = localStorage.getItem(UI_LANG_KEY) || 'ru';
applyLanguage(savedLang);
const savedChar = localStorage.getItem(CHARACTER_KEY);
if (savedChar && savedChar !== 'default') {
  selectCharacter(savedChar);
  characterSelect.value = savedChar;
}
updateLangButton();
counterSpan.textContent = `Запросов: ${queryCount}`;
loadHistory();
refreshIcons();