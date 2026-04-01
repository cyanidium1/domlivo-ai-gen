export const SUPPORTED_LANGUAGES = ["en", "ru", "uk", "sq", "it"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type Messages = {
  common: {
    dashboard: string;
    menu: string;
    settings: string;
    language: string;
    theme: string;
    light: string;
    dark: string;
    general: string;
    interfaceLanguage: string;
    platformTheme: string;
  };
  nav: {
    listingSessions: string;
    blogPosts: string;
    projectTypes: string;
    settings: string;
    workspace: string;
    utilities: string;
    openStudio: string;
    openFrontend: string;
    internalPreview: string;
    profile: string;
    loginLogout: string;
    operator: string;
  };
  pages: {
    listingSessions: string;
    blogPosts: string;
    projectTypes: string;
    settings: string;
  };
  settings: {
    title: string;
    subtitle: string;
    languageHelp: string;
    themeHelp: string;
    appearance: string;
    futureNote: string;
    aiGeneration: string;
    descriptionExample: string;
    descriptionExampleHelp: string;
    descriptionExampleSave: string;
    descriptionExampleSaved: string;
    descriptionExampleSaving: string;
  };
  dashboard: {
    welcomeTitle: string;
    welcomeBody: string;
    openListingSessions: string;
    quickLinks: string;
    studio: string;
    frontend: string;
    publishedObjects: string;
    listingEditorTitle: string;
    listingEditorSubtitle: string;
    sessionId: string;
    createSessionTitle: string;
    createSessionSubtitle: string;
    createSessionButton: string;
    creatingSession: string;
    createSessionError: string;
    blogPlaceholderTitle: string;
    blogPlaceholderDescription: string;
    projectTypesPlaceholderTitle: string;
    projectTypesPlaceholderDescription: string;
  };
};

export const UI_MESSAGES: Record<AppLanguage, Messages> = {
  en: {
    common: {
      dashboard: "Dashboard",
      menu: "Menu",
      settings: "Settings",
      language: "Language",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
      general: "General",
      interfaceLanguage: "Interface language",
      platformTheme: "Platform theme",
    },
    nav: {
      listingSessions: "Listing Sessions / Real Estate",
      blogPosts: "Blog Posts",
      projectTypes: "Other Project Types",
      settings: "Settings",
      workspace: "Workspace",
      utilities: "Utilities",
      openStudio: "Open Sanity Studio",
      openFrontend: "Open Domlivo Frontend",
      internalPreview: "Internal Preview (placeholder)",
      profile: "Profile",
      loginLogout: "Login / Logout",
      operator: "Operator (placeholder)",
    },
    pages: {
      listingSessions: "Listing Sessions",
      blogPosts: "Blog Posts",
      projectTypes: "Other Project Types",
      settings: "Settings",
    },
    settings: {
      title: "Settings",
      subtitle: "Manage platform preferences.",
      languageHelp: "Select the language used across the interface.",
      themeHelp: "Choose the visual theme for the whole platform.",
      appearance: "Appearance",
      futureNote: "Settings are structured for future options (notifications, AI preferences, etc.).",
      aiGeneration: "AI Generation",
      descriptionExample: "Description style example",
      descriptionExampleHelp: "Paste an example listing description. The AI will mimic its tone, formatting, and style — but will only use facts from each actual listing. Leave empty to use the default AI style.",
      descriptionExampleSave: "Save",
      descriptionExampleSaved: "Saved",
      descriptionExampleSaving: "Saving…",
    },
    dashboard: {
      welcomeTitle: "Welcome",
      welcomeBody: "Use the sidebar to navigate project sections. Start with a new listing session.",
      openListingSessions: "Open Listing Sessions",
      quickLinks: "Quick Links",
      studio: "Sanity Studio",
      frontend: "Domlivo Frontend",
      publishedObjects: "Published Objects (placeholder)",
      listingEditorTitle: "Listing Session Editor",
      listingEditorSubtitle: "Internal operator workspace for listing intake and publishing.",
      sessionId: "Session ID",
      createSessionTitle: "Create New Listing Session",
      createSessionSubtitle: "Start a new intake workspace for photos, audio, source notes, draft generation, and publish.",
      createSessionButton: "Create session",
      creatingSession: "Creating...",
      createSessionError: "Failed to create session",
      blogPlaceholderTitle: "Blog Posts",
      blogPlaceholderDescription: "This section is prepared for stage 3. CRUD for blog posts is not implemented yet.",
      projectTypesPlaceholderTitle: "Other Project Types",
      projectTypesPlaceholderDescription: "Placeholder workspace for future object types beyond real estate sessions.",
    },
  },
  ru: {
    common: {
      dashboard: "Панель",
      menu: "Меню",
      settings: "Настройки",
      language: "Язык",
      theme: "Тема",
      light: "Светлая",
      dark: "Тёмная",
      general: "Общие",
      interfaceLanguage: "Язык интерфейса",
      platformTheme: "Тема платформы",
    },
    nav: {
      listingSessions: "Сессии листинга / Недвижимость",
      blogPosts: "Блог",
      projectTypes: "Другие типы проектов",
      settings: "Настройки",
      workspace: "Рабочая область",
      utilities: "Утилиты",
      openStudio: "Открыть Sanity Studio",
      openFrontend: "Открыть Domlivo Frontend",
      internalPreview: "Внутренний превью (заглушка)",
      profile: "Профиль",
      loginLogout: "Вход / Выход",
      operator: "Оператор (заглушка)",
    },
    pages: {
      listingSessions: "Сессии листинга",
      blogPosts: "Блог",
      projectTypes: "Другие типы проектов",
      settings: "Настройки",
    },
    settings: {
      title: "Настройки",
      subtitle: "Управление параметрами платформы.",
      languageHelp: "Выберите язык интерфейса.",
      themeHelp: "Выберите визуальную тему для всей платформы.",
      appearance: "Оформление",
      futureNote: "Структура настроек подготовлена для будущих опций (уведомления, AI-предпочтения и т.д.).",
      aiGeneration: "AI-генерация",
      descriptionExample: "Пример стиля описания",
      descriptionExampleHelp: "Вставьте пример описания объявления. AI будет имитировать его тон, форматирование и стиль — но использует только факты из каждого конкретного объявления. Оставьте пустым для использования стиля AI по умолчанию.",
      descriptionExampleSave: "Сохранить",
      descriptionExampleSaved: "Сохранено",
      descriptionExampleSaving: "Сохранение…",
    },
    dashboard: {
      welcomeTitle: "Добро пожаловать",
      welcomeBody: "Используйте сайдбар для навигации по разделам. Начните с новой сессии листинга.",
      openListingSessions: "Открыть сессии листинга",
      quickLinks: "Быстрые ссылки",
      studio: "Sanity Studio",
      frontend: "Domlivo Frontend",
      publishedObjects: "Опубликованные объекты (заглушка)",
      listingEditorTitle: "Редактор сессии листинга",
      listingEditorSubtitle: "Внутренняя рабочая зона оператора для intake и публикации.",
      sessionId: "ID сессии",
      createSessionTitle: "Создать новую сессию листинга",
      createSessionSubtitle: "Запустите новую intake-сессию для фото, аудио, заметок, генерации черновика и публикации.",
      createSessionButton: "Создать сессию",
      creatingSession: "Создание...",
      createSessionError: "Не удалось создать сессию",
      blogPlaceholderTitle: "Блог",
      blogPlaceholderDescription: "Раздел подготовлен для этапа 3. CRUD для блог-постов пока не реализован.",
      projectTypesPlaceholderTitle: "Другие типы проектов",
      projectTypesPlaceholderDescription: "Заглушка для будущих типов объектов помимо недвижимости.",
    },
  },
  uk: {
    common: {
      dashboard: "Панель",
      menu: "Меню",
      settings: "Налаштування",
      language: "Мова",
      theme: "Тема",
      light: "Світла",
      dark: "Темна",
      general: "Загальні",
      interfaceLanguage: "Мова інтерфейсу",
      platformTheme: "Тема платформи",
    },
    nav: {
      listingSessions: "Сесії лістингу / Нерухомість",
      blogPosts: "Блог",
      projectTypes: "Інші типи проєктів",
      settings: "Налаштування",
      workspace: "Робочий простір",
      utilities: "Утиліти",
      openStudio: "Відкрити Sanity Studio",
      openFrontend: "Відкрити Domlivo Frontend",
      internalPreview: "Внутрішній прев'ю (заглушка)",
      profile: "Профіль",
      loginLogout: "Вхід / Вихід",
      operator: "Оператор (заглушка)",
    },
    pages: {
      listingSessions: "Сесії лістингу",
      blogPosts: "Блог",
      projectTypes: "Інші типи проєктів",
      settings: "Налаштування",
    },
    settings: {
      title: "Налаштування",
      subtitle: "Керуйте параметрами платформи.",
      languageHelp: "Оберіть мову інтерфейсу.",
      themeHelp: "Оберіть візуальну тему для всієї платформи.",
      appearance: "Оформлення",
      futureNote: "Структура налаштувань готова для майбутніх опцій (сповіщення, AI-параметри тощо).",
      aiGeneration: "AI-генерація",
      descriptionExample: "Приклад стилю опису",
      descriptionExampleHelp: "Вставте приклад опису об'єкта. AI імітуватиме його тон, форматування та стиль — але використовуватиме лише факти з кожного конкретного оголошення. Залиште порожнім для стилю AI за замовчуванням.",
      descriptionExampleSave: "Зберегти",
      descriptionExampleSaved: "Збережено",
      descriptionExampleSaving: "Збереження…",
    },
    dashboard: {
      welcomeTitle: "Ласкаво просимо",
      welcomeBody: "Використовуйте сайдбар для навігації розділами. Почніть із нової сесії лістингу.",
      openListingSessions: "Відкрити сесії лістингу",
      quickLinks: "Швидкі посилання",
      studio: "Sanity Studio",
      frontend: "Domlivo Frontend",
      publishedObjects: "Опубліковані об'єкти (заглушка)",
      listingEditorTitle: "Редактор сесії лістингу",
      listingEditorSubtitle: "Внутрішній робочий простір оператора для intake та публікації.",
      sessionId: "ID сесії",
      createSessionTitle: "Створити нову сесію лістингу",
      createSessionSubtitle: "Запустіть нову intake-сесію для фото, аудіо, нотаток, генерації чернетки та публікації.",
      createSessionButton: "Створити сесію",
      creatingSession: "Створення...",
      createSessionError: "Не вдалося створити сесію",
      blogPlaceholderTitle: "Блог",
      blogPlaceholderDescription: "Розділ підготовлено для етапу 3. CRUD для блог-постів ще не реалізовано.",
      projectTypesPlaceholderTitle: "Інші типи проєктів",
      projectTypesPlaceholderDescription: "Заглушка для майбутніх типів об'єктів, окрім нерухомості.",
    },
  },
  sq: {
    common: {
      dashboard: "Paneli",
      menu: "Menu",
      settings: "Cilësimet",
      language: "Gjuha",
      theme: "Tema",
      light: "E çelët",
      dark: "E errët",
      general: "Të përgjithshme",
      interfaceLanguage: "Gjuha e ndërfaqes",
      platformTheme: "Tema e platformës",
    },
    nav: {
      listingSessions: "Sesionet e listimit / Pasuri të paluajtshme",
      blogPosts: "Postime blogu",
      projectTypes: "Lloje të tjera projektesh",
      settings: "Cilësimet",
      workspace: "Hapësira e punës",
      utilities: "Vegla",
      openStudio: "Hap Sanity Studio",
      openFrontend: "Hap Domlivo Frontend",
      internalPreview: "Parapamje e brendshme (placeholder)",
      profile: "Profili",
      loginLogout: "Hyrje / Dalje",
      operator: "Operatori (placeholder)",
    },
    pages: {
      listingSessions: "Sesionet e listimit",
      blogPosts: "Postime blogu",
      projectTypes: "Lloje të tjera projektesh",
      settings: "Cilësimet",
    },
    settings: {
      title: "Cilësimet",
      subtitle: "Menaxhoni preferencat e platformës.",
      languageHelp: "Zgjidhni gjuhën e ndërfaqes.",
      themeHelp: "Zgjidhni temën vizuale për të gjithë platformën.",
      appearance: "Pamja",
      futureNote: "Cilësimet janë të strukturuara për opsione të ardhshme (njoftime, preferenca AI, etj.).",
      aiGeneration: "Gjenerimi AI",
      descriptionExample: "Shembull stili përshkrimi",
      descriptionExampleHelp: "Ngjisni një shembull përshkrimi listimi. AI do të imitojë tonin, formatimin dhe stilin e tij — por do të përdorë vetëm faktet nga çdo listim aktual. Lëreni bosh për të përdorur stilin e paracaktuar të AI.",
      descriptionExampleSave: "Ruaj",
      descriptionExampleSaved: "Ruajtur",
      descriptionExampleSaving: "Po ruhet…",
    },
    dashboard: {
      welcomeTitle: "Mirë se vini",
      welcomeBody: "Përdorni sidebar për të lundruar në seksione. Filloni me një sesion të ri listimi.",
      openListingSessions: "Hap sesionet e listimit",
      quickLinks: "Lidhje të shpejta",
      studio: "Sanity Studio",
      frontend: "Domlivo Frontend",
      publishedObjects: "Objekte të publikuara (placeholder)",
      listingEditorTitle: "Editor i sesionit të listimit",
      listingEditorSubtitle: "Hapësirë e brendshme pune për operatorin për intake dhe publikim.",
      sessionId: "ID e sesionit",
      createSessionTitle: "Krijo sesion të ri listimi",
      createSessionSubtitle: "Nisni një sesion të ri intake për foto, audio, shënime, gjenerim drafti dhe publikim.",
      createSessionButton: "Krijo sesion",
      creatingSession: "Po krijohet...",
      createSessionError: "Dështoi krijimi i sesionit",
      blogPlaceholderTitle: "Postime blogu",
      blogPlaceholderDescription: "Ky seksion është gati për fazën 3. CRUD për postimet e blogut nuk është implementuar ende.",
      projectTypesPlaceholderTitle: "Lloje të tjera projektesh",
      projectTypesPlaceholderDescription: "Hapësirë placeholder për lloje të ardhshme objektesh përtej pasurive të paluajtshme.",
    },
  },
  it: {
    common: {
      dashboard: "Dashboard",
      menu: "Menu",
      settings: "Impostazioni",
      language: "Lingua",
      theme: "Tema",
      light: "Chiaro",
      dark: "Scuro",
      general: "Generale",
      interfaceLanguage: "Lingua dell'interfaccia",
      platformTheme: "Tema della piattaforma",
    },
    nav: {
      listingSessions: "Sessioni di listing / Immobiliare",
      blogPosts: "Articoli blog",
      projectTypes: "Altri tipi di progetto",
      settings: "Impostazioni",
      workspace: "Workspace",
      utilities: "Utilità",
      openStudio: "Apri Sanity Studio",
      openFrontend: "Apri Domlivo Frontend",
      internalPreview: "Anteprima interna (placeholder)",
      profile: "Profilo",
      loginLogout: "Login / Logout",
      operator: "Operatore (placeholder)",
    },
    pages: {
      listingSessions: "Sessioni di listing",
      blogPosts: "Articoli blog",
      projectTypes: "Altri tipi di progetto",
      settings: "Impostazioni",
    },
    settings: {
      title: "Impostazioni",
      subtitle: "Gestisci le preferenze della piattaforma.",
      languageHelp: "Seleziona la lingua dell'interfaccia.",
      themeHelp: "Scegli il tema visivo per l'intera piattaforma.",
      appearance: "Aspetto",
      futureNote: "Le impostazioni sono strutturate per opzioni future (notifiche, preferenze AI, ecc.).",
      aiGeneration: "Generazione AI",
      descriptionExample: "Esempio di stile descrizione",
      descriptionExampleHelp: "Incolla un esempio di descrizione dell'annuncio. L'AI imiterà il suo tono, la formattazione e lo stile — ma utilizzerà solo i fatti di ogni annuncio reale. Lascia vuoto per usare lo stile AI predefinito.",
      descriptionExampleSave: "Salva",
      descriptionExampleSaved: "Salvato",
      descriptionExampleSaving: "Salvataggio…",
    },
    dashboard: {
      welcomeTitle: "Benvenuto",
      welcomeBody: "Usa la sidebar per navigare tra le sezioni. Inizia con una nuova sessione di listing.",
      openListingSessions: "Apri Sessioni di Listing",
      quickLinks: "Link rapidi",
      studio: "Sanity Studio",
      frontend: "Domlivo Frontend",
      publishedObjects: "Oggetti pubblicati (placeholder)",
      listingEditorTitle: "Editor sessione listing",
      listingEditorSubtitle: "Workspace interno operatore per intake e pubblicazione listing.",
      sessionId: "ID sessione",
      createSessionTitle: "Crea nuova sessione listing",
      createSessionSubtitle: "Avvia un nuovo workspace intake per foto, audio, note sorgente, generazione bozza e pubblicazione.",
      createSessionButton: "Crea sessione",
      creatingSession: "Creazione...",
      createSessionError: "Creazione sessione non riuscita",
      blogPlaceholderTitle: "Articoli blog",
      blogPlaceholderDescription: "Questa sezione è pronta per la fase 3. Il CRUD dei post blog non è ancora implementato.",
      projectTypesPlaceholderTitle: "Altri tipi di progetto",
      projectTypesPlaceholderDescription: "Workspace placeholder per futuri tipi di oggetti oltre alle sessioni immobiliari.",
    },
  },
};

export function getLanguageLabel(lang: AppLanguage): string {
  switch (lang) {
    case "en":
      return "English";
    case "ru":
      return "Русский";
    case "uk":
      return "Українська";
    case "sq":
      return "Shqip";
    case "it":
      return "Italiano";
  }
}

