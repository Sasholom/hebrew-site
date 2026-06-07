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

const STORAGE_KEY = 'sasholom_chat_history';
const CONTEXT_KEY = 'sasholom_context';
const UI_LANG_KEY = 'sasholom_ui_lang';
const NOTES_KEY = 'sasholom_notes';
const QUERY_COUNT_KEY = 'sasholom_query_count';

let currentUILang = 'ru';
let currentRole = 'default';
let currentProvider = 'chadgpt';
let selectedImageBase64 = null;
let isListening = false;
let recognition = null;
let queryCount = parseInt(localStorage.getItem(QUERY_COUNT_KEY) || '0');

// ===== ЛОКАЛИЗАЦИЯ =====
const translations = {
  ru: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Задай любой вопрос...',
    photoPlaceholder: '📷 Фото загружено. Задай вопрос или нажми "Спросить"',
    askBtn: 'Спросить 💬',
    clearBtn: '🗑️ Очистить чат',
    welcome: 'Привет! Задай мне любой вопрос 😎',
    thinking: 'Думаю...',
    copyBtn: 'Копировать',
    copied: 'Скопировано ✓',
    error: 'Ошибка',
    longMsg: '⚠️ Сообщение слишком длинное (макс. 2000 символов)',
    serverError: '❌ Не могу соединиться с сервером. Проверь интернет и попробуй снова.',
    clearConfirm: 'Точно удалить всю историю чата? 🗑️',
    voiceError: '❌ Ошибка распознавания речи. Попробуй ещё раз.',
    voiceUnsupported: '🎤 Голосовой ввод не поддерживается в твоём браузере. Попробуй Chrome.',
    imageTooLarge: '⚠️ Фото слишком большое (макс 4MB)',
    imageReadError: '❌ Ошибка чтения файла',
    roleLabels: {
      default: '💬 Обычный',
      translator: '🌐 Переводчик',
      poet: '🎭 Поэт',
      coder: '💻 Кодер'
    },
    footer: 'Made with 💚 by S.K.'
  },
  en: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'Ask any question...',
    photoPlaceholder: '📷 Photo uploaded. Ask a question or press "Ask"',
    askBtn: 'Ask 💬',
    clearBtn: '🗑️ Clear chat',
    welcome: 'Hello! Ask me anything 😎',
    thinking: 'Thinking...',
    copyBtn: 'Copy',
    copied: 'Copied ✓',
    error: 'Error',
    longMsg: '⚠️ Message too long (max 2000 chars)',
    serverError: '❌ Cannot connect to server. Check internet and try again.',
    clearConfirm: 'Really delete entire chat history? 🗑️',
    voiceError: '❌ Speech recognition error. Please try again.',
    voiceUnsupported: '🎤 Voice input not supported in your browser. Try Chrome.',
    imageTooLarge: '⚠️ Image too large (max 4MB)',
    imageReadError: '❌ File read error',
    roleLabels: {
      default: '💬 Default',
      translator: '🌐 Translator',
      poet: '🎭 Poet',
      coder: '💻 Coder'
    },
    footer: 'Made with 💚 by S.K.'
  },
  he: {
    title: '🚀 SaSholom',
    cardTitle: '🧠 Hebrew AI',
    placeholder: 'שאל כל שאלה...',
    photoPlaceholder: '📷 תמונה הועלתה. שאל שאלה או לחץ "שאל"',
    askBtn: 'שאל 💬',
    clearBtn: '🗑️ נקה צ\'אט',
    welcome: 'שלום! שאל אותי כל דבר 😎',
    thinking: 'חושב...',
    copyBtn: 'העתק',
    copied: 'הועתק ✓',
    error: 'שגיאה',
    longMsg: '⚠️ הודעה ארוכה מדי (מקסימום 2000 תווים)',
    serverError: '❌ לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב.',
    clearConfirm: 'בטוח למחוק את כל ההיסטוריה? 🗑️',
    voiceError: '❌ שגיאת זיהוי דיבור. נסה שוב.',
    voiceUnsupported: '🎤 קלט קולי לא נתמך בדפדפן שלך. נסה Chrome.',
    imageTooLarge: '⚠️ תמונה גדולה מדי (מקסימום 4MB)',
    imageReadError: '❌ שגיאת קריאת קובץ',
    roleLabels: {
      default: '💬 רגיל',
      translator: '🌐 מתרגם',
      poet: '🎭 משורר',
      coder: '💻 מתכנת'
    },
    footer: 'Made with 💚 by S.K.'
  }
};

// ===== ИНИЦИАЛИЗАЦИЯ UI =====
function applyLanguage(lang) {
  currentUILang = lang;
  const t = translations[lang];

  document.title = t.title;
  document.querySelector('h1').textContent = t.title;
  document.querySelector('.card h2').textContent = t.cardTitle;
  if (!selectedImageBase64) {
    askInput.placeholder = t.placeholder;
  } else {
    askInput.placeholder = t.photoPlaceholder;
  }
  askBtn.textContent = t.askBtn;
  clearBtn.textContent = t.clearBtn;
  document.querySelector('footer').innerHTML = t.footer.replace('💚', '<span>💚</span>');

  document.querySelectorAll('.preset-btn').forEach(btn => {
    const role = btn.dataset.role;
    if (role && t.roleLabels[role]) {
      btn.textContent = t.roleLabels[role];
    }
  });

  document.querySelectorAll('.ai-message .copy-btn').forEach(btn => {
    if (btn.textContent === 'Копировать' || btn.textContent === 'Copy' || btn.textContent === 'העתק') {
      btn.textContent = t.copyBtn;
    }
  });

  const langLabels = { ru: '🇷🇺 RU', en: '🇺🇸 EN', he: '🇮🇱 HE' };
  if (langToggle) langToggle.textContent = langLabels[lang];

  localStorage.setItem(UI_LANG_KEY, lang);
  refreshIcons();
}

// ===== ПРЕСЕТЫ-РОЛИ =====
const rolePrompts = {
  translator: 'Ты — профессиональный переводчик. Переведи следующее сообщение на русский язык, сохраняя смысл и стиль. Если сообщение уже на русском, переведи его на английский. Отвечай только переводом.',
  poet: 'Ты — талантливый поэт. Отвечай на любое сообщение стихами, с рифмой и ритмом. Используй красивые образы и метафоры.',
  coder: 'Ты — эксперт-программист. Отвечай как senior-разработчик: давай чистый, рабочий код с краткими пояснениями. Используй Markdown-блоки для кода.',
  default: 'Ты — дружелюбный и умный помощник по имени SaSholom AI. Отвечай кратко, по делу, с лёгким юмором. Отвечай на том же языке, что и пользователь. Используй эмодзи там, где уместно. 😊'
};

function setRole(role) {
  currentRole = role;
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });
  localStorage.setItem('sasholom_role', role);
}

// ===== ВЫБОР ПРОВАЙДЕРА =====
function setProvider(provider) {
  currentProvider = provider;
  document.querySelectorAll('.provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === provider);
  });
  localStorage.setItem('sasholom_provider', provider);
}

// ===== РАБОТА С ФОТО =====
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
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

// ===== КАМЕРА =====
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

// ===== ЗАГРУЗКА ФАЙЛОВ (PDF/TXT) =====
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

// ===== РЕНДЕРИНГ MARKDOWN =====
function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text;
  return marked.parse(text, { breaks: true, html: false });
}

// ===== ПОДСВЕТКА КОДА =====
function highlightCode(element) {
  if (typeof hljs === 'undefined') return;
  element.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
}

// ===== ЭФФЕКТ ПЕЧАТИ =====
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
    } else {
      if (onComplete) onComplete();
    }
  }
  typeNext();
}

// ===== ИСТОРИЯ ЧАТА =====
function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const messages = JSON.parse(saved);
    chatHistory.innerHTML = '';
    messages.forEach(msg => addMessage(msg.text, msg.sender, false));
  }
}

function saveHistory() {
  const messages = [];
  chatHistory.querySelectorAll('.message').forEach(m => {
    const isUser = m.classList.contains('user-message');
    const rawText = m.querySelector('.bubble').getAttribute('data-raw') || '';
    if (!m.classList.contains('thinking')) {
      messages.push({ text: rawText, sender: isUser ? 'user' : 'ai' });
    }
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

// ===== КОНТЕКСТ ДЛЯ ИИ =====
function getContext() {
  const saved = localStorage.getItem(CONTEXT_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveContext(context) {
  const trimmed = context.slice(-10);
  localStorage.setItem(CONTEXT_KEY, JSON.stringify(trimmed));
}

// ===== ЗАМЕТКИ =====
function getNotesPrompt() {
  const notes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
  if (notes.name || notes.prefs) {
    return `[Информация о пользователе] Имя: ${notes.name || 'неизвестно'}. Предпочтения: ${notes.prefs || 'нет'}.`;
  }
  return '';
}

notesBtn.addEventListener('click', () => {
  notesPanel.style.display = notesPanel.style.display === 'none' ? 'block' : 'none';
});

saveNotesBtn.addEventListener('click', () => {
  const notes = { name: noteName.value, prefs: notePrefs.value };
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  notesPanel.style.display = 'none';
  addMessage('Заметки сохранены!', 'ai');
});

// Загрузка заметок при старте
const savedNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
if (noteName) noteName.value = savedNotes.name || '';
if (notePrefs) notePrefs.value = savedNotes.prefs || '';

// ===== ЭКСПОРТ ИСТОРИИ =====
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

// ===== ПОИСК =====
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.message').forEach(msg => {
    const text = msg.querySelector('.bubble').innerText.toLowerCase();
    msg.style.display = text.includes(term) ? 'flex' : 'none';
  });
});

// ===== СЧЁТЧИК =====
function incrementCounter() {
  queryCount++;
  localStorage.setItem(QUERY_COUNT_KEY, queryCount);
  if (counterSpan) counterSpan.textContent = `Запросов: ${queryCount}`;
}

// ===== ДОБАВЛЕНИЕ СООБЩЕНИЯ (обновлённое) =====
function addMessage(text, sender, save = true) {
  const t = translations[currentUILang];
  const message = document.createElement('div');
  message.className = `message ${sender}-message`;
  const avatar = sender === 'user' ? '👤' : '🧠';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (sender === 'ai') {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  bubble.setAttribute('data-raw', text);

  message.innerHTML = '';
  message.appendChild(document.createElement('span')).className = 'avatar';
  message.querySelector('.avatar').textContent = avatar;
  message.appendChild(bubble);

  // Блок действий
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  if (sender === 'ai') {
    // Копировать
    const copyBtn = document.createElement('button');
    copyBtn.innerHTML = '<i data-lucide="clipboard"></i>';
    copyBtn.title = t.copyBtn;
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const rawText = bubble.getAttribute('data-raw') || '';
      try {
        await navigator.clipboard.writeText(rawText);
        copyBtn.innerHTML = '<i data-lucide="check"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i data-lucide="clipboard"></i>'; refreshIcons(); }, 2000);
        refreshIcons();
      } catch (err) {
        copyBtn.innerHTML = '<i data-lucide="x"></i>';
        setTimeout(() => { copyBtn.innerHTML = '<i data-lucide="clipboard"></i>'; refreshIcons(); }, 2000);
      }
    });
    actions.appendChild(copyBtn);

    // Поделиться
    const shareBtn = document.createElement('button');
    shareBtn.innerHTML = '<i data-lucide="share-2"></i>';
    shareBtn.title = 'Поделиться';
    shareBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (navigator.share) {
        try {
          await navigator.share({ text: text });
        } catch (err) { /* отмена */ }
      } else {
        addMessage('Поделиться можно только на мобильных устройствах или через копирование ссылки.', 'ai');
      }
    });
    actions.appendChild(shareBtn);

    // Озвучить
    const speakBtn = document.createElement('button');
    speakBtn.innerHTML = '<i data-lucide="volume-2"></i>';
    speakBtn.title = 'Озвучить';
    speakBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speechSynthesis.cancel(); // остановить предыдущее
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU'; // можно динамически менять
      speechSynthesis.speak(utterance);
    });
    actions.appendChild(speakBtn);
  }
  message.appendChild(actions);
  chatHistory.appendChild(message);

  if (sender === 'ai') {
    highlightCode(message);
  }
  chatHistory.scrollTop = chatHistory.scrollHeight;
  if (save) saveHistory();
  refreshIcons();
  return message;
}

// ===== ОТПРАВКА ВОПРОСА =====
async function askAI() {
  const t = translations[currentUILang];
  const question = askInput.value.trim();
  if (!question && !selectedImageBase64) return;
  if (question && question.length > 2000) {
    addMessage(t.longMsg, 'ai');
    return;
  }

  // Сообщение пользователя
  if (selectedImageBase64 && !question) {
    addMessage('📷 Посмотри фото и скажи, какое благословение нужно произнести', 'user');
  } else if (selectedImageBase64 && question) {
    addMessage(question + ' (с фото)', 'user');
  } else {
    addMessage(question, 'user');
  }
  askInput.value = '';

  const thinking = addMessage(t.thinking, 'ai', false);
  thinking.classList.add('thinking');
  askBtn.disabled = true;

  const context = getContext();
  const notesPrompt = getNotesPrompt();
  const systemPrompt = (rolePrompts[currentRole] || rolePrompts.default) + (notesPrompt ? ' ' + notesPrompt : '');

  try {
    const res = await fetch('/api/ask-deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question || undefined,
        history: context,
        systemPrompt: systemPrompt,
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
    bubble.innerHTML = '';
    bubble.textContent = '';

    typewriterEffect(bubble, answer, 30, () => {
      bubble.innerHTML = renderMarkdown(answer);
      bubble.setAttribute('data-raw', answer);
      highlightCode(aiMsg);
      context.push({ role: 'user', content: question || '📷 Фото' });
      context.push({ role: 'assistant', content: answer });
      saveContext(context);
      saveHistory();
      incrementCounter();
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

// ===== ОЧИСТКА ЧАТА =====
function clearChat() {
  const t = translations[currentUILang];
  if (!confirm(t.clearConfirm)) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CONTEXT_KEY);
  chatHistory.innerHTML = '';
  addMessage(t.welcome, 'ai');
}

// ===== ТЕМА =====
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sasholom_theme', theme);
  if (themeToggle) {
    themeToggle.textContent = theme === 'light' ? '☀️' : '🌓';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

// ===== ГОЛОСОВОЙ ВВОД =====
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
  if (isListening) {
    stopListening();
    startListening();
  }
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    askInput.value = transcript;
    stopListening();
    askAI();
  };

  recognition.onerror = (event) => {
    stopListening();
    addMessage(translations[currentUILang].voiceError, 'ai');
  };

  recognition.onend = () => stopListening();
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
  if (recognition) {
    recognition.stop();
  }
  refreshIcons();
}

// ===== ИКОНКИ =====
function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
askBtn.addEventListener('click', askAI);
clearBtn.addEventListener('click', clearChat);
themeToggle.addEventListener('click', toggleTheme);
langToggle.addEventListener('click', () => {
  const langs = ['ru', 'en', 'he'];
  const idx = langs.indexOf(currentUILang);
  const next = langs[(idx + 1) % langs.length];
  applyLanguage(next);
});
voiceBtn.addEventListener('click', () => isListening ? stopListening() : startListening());
langBtn.addEventListener('click', switchLanguage);

askInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    askAI();
  }
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => setRole(btn.dataset.role));
});

document.querySelectorAll('.provider-btn').forEach(btn => {
  btn.addEventListener('click', () => setProvider(btn.dataset.provider));
});

// ===== СТАРТ =====
const savedTheme = localStorage.getItem('sasholom_theme') || 'dark';
setTheme(savedTheme);

const savedRole = localStorage.getItem('sasholom_role') || 'default';
setRole(savedRole);

const savedUILang = localStorage.getItem(UI_LANG_KEY) || 'ru';
applyLanguage(savedUILang);

const savedProvider = localStorage.getItem('sasholom_provider') || 'chadgpt';
setProvider(savedProvider);

counterSpan.textContent = `Запросов: ${queryCount}`;
updateLangButton();
loadHistory();
refreshIcons();