"use client";

import { Mic, Pause, Play, Plus, Send, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ListingPreviewPanel } from "@/components/listing-preview/ListingPreviewPanel";
import {
  conversationalEdit,
  generateSession,
  getSession,
  isPublishGateErrors,
  patchSession,
  publishDraftSession,
  publishSession,
  removePhoto,
  runIntake,
  transcribeAudio,
  uploadPhotos,
  type ApiErrorWithDetails,
  type IntakeAnalysisResponse,
  type ListingSessionResponse,
} from "@/lib/listing-session/client";
import { detectInputLanguage } from "@/lib/detection/language-detector";
import {
  createBaseDraftFromFacts,
  emptyDraftForm,
  toDraftForm,
  toListingDraft,
  type DraftForm,
} from "@/lib/listing-session/draft-mapper";
import {
  CRITICAL_CONFIRMATION_FIELDS,
  getConfirmation,
  getCriticalFieldStatus,
  type CriticalConfirmationField,
} from "@/lib/listing-session/confirmation";
import { buildPublishPayload } from "@/lib/listing-session/publish-payload";
import type { PublishGateErrors } from "@/lib/listing-session/publish-payload";
import type { RequiredFactKey } from "@/lib/listing-session/intake";
import type { ListingDraft } from "@/lib/validation/listing-session";
import { createEmptyLocalizedString } from "@/lib/validation/property-i18n";
import { useAppLanguage, type AppLanguage } from "@/contexts/language-context";
import { toast } from "sonner";
import { actionButtonClass, canPublishDraft, canPublishProperty } from "@/lib/listing-session/publish-eligibility";
import { canSendMessage } from "@/lib/listing-session/composer-logic";
import { listingDraftSchema } from "@/lib/validation/listing-session";

type FormProps = {
  sessionId: string;
};

type IntakeMsgKey = "ready" | "textReady" | "missingPrefix" | "referencePrefix" | "draftGenerated" | "earlyDraftGenerated" | "fallback";
const INTAKE_MESSAGES: Record<IntakeMsgKey, Record<AppLanguage, string>> = {
  ready: {
    en: "Got it. All required fields are filled — you can generate the full listing.",
    ru: "Данные получены. Обязательные поля заполнены — можно генерировать листинг.",
    uk: "Дані отримано. Обов'язкові поля заповнені — можна генерувати лістинг.",
    sq: "Kuptova. Të gjitha fushat janë plotësuar — mund të gjeneroni listimin.",
    it: "Capito. Tutti i campi sono compilati — puoi generare l'annuncio.",
  },
  textReady: {
    en: "Description data looks complete. Generating draft text now — add a photo to finalize the listing.",
    ru: "Основные данные готовы. Генерирую черновик — добавьте фото для завершения листинга.",
    uk: "Основні дані готові. Генерую чернетку — додайте фото для завершення лістингу.",
    sq: "Të dhënat e përshkrimit janë gati. Po gjeneroj draftin — shtoni një foto për të finalizuar listimin.",
    it: "I dati di descrizione sembrano completi. Genero la bozza — aggiungi una foto per finalizzare l'annuncio.",
  },
  missingPrefix: {
    en: "Still missing:",
    ru: "Не хватает:",
    uk: "Не вистачає:",
    sq: "Mungon ende:",
    it: "Mancano ancora:",
  },
  referencePrefix: {
    en: "Catalog notes:",
    ru: "Справочники:",
    uk: "Довідники:",
    sq: "Shënime katalogu:",
    it: "Note catalogo:",
  },
  draftGenerated: {
    en: "All required fields complete. Full draft generated — review the preview on the right, edit via Advanced Edit, confirm critical fields, then Publish.",
    ru: "Обязательные поля заполнены: черновик сгенерирован. Проверьте предпросмотр справа, уточните поля в Advanced Edit, подтвердьте критичные поля, затем Publish.",
    uk: "Обов'язкові поля заповнені: чернетку згенеровано. Перевірте попередній перегляд праворуч, відредагуйте у Advanced Edit, підтвердьте критичні поля, потім Publish.",
    sq: "Fushat e detyrueshme janë plotësuar: drafti u gjenerua. Kontrolloni pamjen paraprake, ndryshoni nëpërmjet Advanced Edit, konfirmoni fushat kritike, pastaj Publiko.",
    it: "Campi obbligatori completati: bozza generata. Controlla l'anteprima a destra, modifica in Advanced Edit, conferma i campi critici, poi Pubblica.",
  },
  earlyDraftGenerated: {
    en: "Draft text generated from your description. Upload photos to enrich the listing, then Publish.",
    ru: "Черновик сгенерирован по вашему описанию. Загрузите фото для обогащения листинга, затем Publish.",
    uk: "Чернетку згенеровано за вашим описом. Завантажте фото для збагачення лістингу, потім Publish.",
    sq: "Drafti i tekstit u gjenerua nga përshkrimi juaj. Ngarkoni foto për të pasuruar listimin, pastaj Publiko.",
    it: "Bozza del testo generata dalla tua descrizione. Carica le foto per arricchire l'annuncio, poi Pubblica.",
  },
  fallback: {
    en: "Clarify the missing property details.",
    ru: "Уточните недостающие детали по объекту.",
    uk: "Уточніть відсутні дані про об'єкт.",
    sq: "Sqaroni detajet që mungojnë.",
    it: "Chiarisci i dettagli mancanti.",
  },
};

const TOAST_MESSAGES = {
  analysisStarted: { en: "Analyzing…", ru: "Анализ начался…", uk: "Аналіз розпочався…", sq: "Analizoj…", it: "Analisi in corso…" },
  analysisComplete: { en: "Done", ru: "Готово", uk: "Готово", sq: "Gati", it: "Fatto" },
  photoOnly: {
    en: "Photos uploaded. Type a message to run analysis and generate the listing.",
    ru: "Фото загружены. Напишите сообщение для анализа и генерации листинга.",
    uk: "Фото завантажено. Напишіть повідомлення для аналізу та генерації лістингу.",
    sq: "Fotot u ngarkuan. Shkruani një mesazh për të analizuar dhe gjeneruar listimin.",
    it: "Foto caricate. Scrivi un messaggio per analizzare e generare l'annuncio.",
  },
  draftSaving: { en: "Saving draft…", ru: "Сохранение черновика…", uk: "Збереження чернетки…", sq: "Po ruaj draftin…", it: "Salvataggio bozza…" },
  draftSavedSanity: { en: "Draft saved to Sanity", ru: "Черновик опубликован в Sanity", uk: "Чернетку збережено в Sanity", sq: "Drafti u ruajt në Sanity", it: "Bozza salvata in Sanity" },
  draftSavedLocal: { en: "Draft saved locally (complete listing to publish to Sanity)", ru: "Черновик сохранён локально (заполните листинг для публикации в Sanity)", uk: "Чернетку збережено локально (заповніть лістинг для публікації в Sanity)", sq: "Drafti u ruajt lokalisht (plotësoni listimin për ta publikuar në Sanity)", it: "Bozza salvata localmente (completa l'annuncio per pubblicare in Sanity)" },
  publishingProperty: { en: "Publishing…", ru: "Публикация объекта…", uk: "Публікація об'єкта…", sq: "Po publikoj…", it: "Pubblicazione in corso…" },
  publishedProperty: { en: "Published", ru: "Объект опубликован", uk: "Об'єкт опубліковано", sq: "U publikua", it: "Pubblicato" },
  genStarted: { en: "Generating…", ru: "Генерация началась…", uk: "Генерація розпочалась…", sq: "Po gjeneroj…", it: "Generazione in corso…" },
  genComplete: { en: "Generated", ru: "Генерация завершена", uk: "Генерацію завершено", sq: "U gjenerua", it: "Generato" },
  editApplied: { en: "Edit applied", ru: "Изменение применено", uk: "Зміну застосовано", sq: "Ndryshimi u aplikua", it: "Modifica applicata" },
} satisfies Record<string, Record<AppLanguage, string>>;

const UI_TEXT = {
  loadingAnalyzing: {
    en: "Analyzing listing...",
    ru: "Анализ листинга...",
    uk: "Аналіз лістингу...",
    sq: "Po analizoj listimin...",
    it: "Analisi annuncio...",
  },
  loadingGeneratingFull: {
    en: "Generating full listing...",
    ru: "Генерация полного листинга...",
    uk: "Генерація повного лістингу...",
    sq: "Po gjeneroj listimin e plotë...",
    it: "Generazione annuncio completo...",
  },
  loadingUpdatingPhotos: {
    en: "Updating draft with photos...",
    ru: "Обновление черновика с фото...",
    uk: "Оновлення чернетки з фото...",
    sq: "Po përditësoj draftin me foto...",
    it: "Aggiornamento bozza con foto...",
  },
  loadingApplyingEdit: {
    en: "Applying edit...",
    ru: "Применение правок...",
    uk: "Застосування змін...",
    sq: "Po aplikoj ndryshimet...",
    it: "Applicazione modifiche...",
  },
  loadingGeneratingDraft: {
    en: "Generating draft...",
    ru: "Генерация черновика...",
    uk: "Генерація чернетки...",
    sq: "Po gjeneroj draftin...",
    it: "Generazione bozza...",
  },
  chatTitle: {
    en: "AI Agent Intake Chat",
    ru: "Чат AI Agent Intake",
    uk: "Чат AI Agent Intake",
    sq: "Biseda AI Agent Intake",
    it: "Chat Intake AI Agent",
  },
  remove: { en: "Remove", ru: "Удалить", uk: "Видалити", sq: "Hiq", it: "Rimuovi" },
  attachPhotos: { en: "Attach photos", ru: "Прикрепить фото", uk: "Додати фото", sq: "Shto foto", it: "Allega foto" },
  messagePlaceholder: {
    en: "Message Domlivo AI Agent…",
    ru: "Сообщение Domlivo AI Agent…",
    uk: "Повідомлення Domlivo AI Agent…",
    sq: "Mesazh për Domlivo AI Agent…",
    it: "Messaggio a Domlivo AI Agent…",
  },
  resumeRecording: { en: "Resume recording", ru: "Продолжить запись", uk: "Продовжити запис", sq: "Vazhdo regjistrimin", it: "Riprendi registrazione" },
  pauseRecording: { en: "Pause recording", ru: "Пауза записи", uk: "Пауза запису", sq: "Ndalo përkohësisht", it: "Metti in pausa" },
  stopRecording: { en: "Stop recording", ru: "Остановить запись", uk: "Зупинити запис", sq: "Ndalo regjistrimin", it: "Ferma registrazione" },
  voiceInput: { en: "Voice input", ru: "Голосовой ввод", uk: "Голосовий ввід", sq: "Hyrje zanore", it: "Input vocale" },
  send: { en: "Send", ru: "Отправить", uk: "Надіслати", sq: "Dërgo", it: "Invia" },
  transcribing: { en: "Transcribing voice...", ru: "Расшифровка голоса...", uk: "Транскрипція голосу...", sq: "Po transkriptoj zërin...", it: "Trascrizione voce..." },
  recording: { en: "Recording", ru: "Запись", uk: "Запис", sq: "Regjistrim", it: "Registrazione" },
  paused: { en: "(paused)", ru: "(пауза)", uk: "(пауза)", sq: "(pauzë)", it: "(pausa)" },
  advancedEdit: { en: "Advanced Edit", ru: "Расширенное редактирование", uk: "Розширене редагування", sq: "Ndryshim i avancuar", it: "Modifica avanzata" },
} satisfies Record<string, Record<AppLanguage, string>>;

const FIELD_LABELS: Record<string, Record<AppLanguage, string>> = {
  price: { en: "price (EUR)", ru: "цена (EUR)", uk: "ціна (EUR)", sq: "çmim (EUR)", it: "prezzo (EUR)" },
  city: { en: "city", ru: "город", uk: "місто", sq: "qytet", it: "città" },
  propertyType: { en: "property type", ru: "тип недвижимости", uk: "тип нерухомості", sq: "lloj prone", it: "tipo proprietà" },
  dealStatus: { en: "deal type (sale/rent/short-term)", ru: "тип сделки", uk: "тип угоди", sq: "lloj transaksioni", it: "tipo transazione" },
  area: { en: "area (m²)", ru: "площадь (м²)", uk: "площа (м²)", sq: "sipërfaqe (m²)", it: "superficie (m²)" },
  photo: { en: "photo", ru: "фото", uk: "фото", sq: "foto", it: "foto" },
};

/** Localized question text for each required fact key. */
const QUESTION_MESSAGES: Record<RequiredFactKey, Record<AppLanguage, string>> = {
  price: {
    en: "What is the listing price in EUR?",
    ru: "Какова цена листинга в EUR?",
    uk: "Яка ціна об'єкта в EUR?",
    sq: "Cili është çmimi i listimit në EUR?",
    it: "Qual è il prezzo dell'annuncio in EUR?",
  },
  city: {
    en: "Which city is this property in?",
    ru: "В каком городе находится объект?",
    uk: "У якому місті знаходиться об'єкт?",
    sq: "Në cilën qytet ndodhet kjo pronë?",
    it: "In quale città si trova questo immobile?",
  },
  propertyType: {
    en: "What is the property type?",
    ru: "Какой тип недвижимости?",
    uk: "Який тип нерухомості?",
    sq: "Cili është lloji i pronës?",
    it: "Qual è il tipo di proprietà?",
  },
  dealStatus: {
    en: "Is this for sale, rent, or short-term?",
    ru: "Это продажа, аренда или посуточно?",
    uk: "Це продаж, оренда чи подобова?",
    sq: "Kjo është për shitje, qira apo afatshkurtër?",
    it: "È in vendita, affitto o affitto breve?",
  },
  area: {
    en: "What is the living area in square meters (m²)?",
    ru: "Какова жилая площадь в квадратных метрах (м²)?",
    uk: "Яка житлова площа в квадратних метрах (м²)?",
    sq: "Cila është sipërfaqja e jetesës në metra katrorë (m²)?",
    it: "Qual è la superficie abitativa in metri quadri (m²)?",
  },
  photo: {
    en: "Please upload at least one property photo.",
    ru: "Пожалуйста, загрузите хотя бы одно фото объекта.",
    uk: "Будь ласка, завантажте хоча б одне фото об'єкта.",
    sq: "Ju lutemi ngarkoni të paktën një foto të pronës.",
    it: "Si prega di caricare almeno una foto dell'immobile.",
  },
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function hasUsableDraft(draft: ListingDraft | null | undefined) {
  const parsed = listingDraftSchema.safeParse(draft);
  if (!parsed.success) return false;
  const value = parsed.data;
  const locales = ["en", "ru", "uk", "sq", "it"] as const;
  const hasTitle = locales.some((locale) => (value.title?.[locale] ?? "").trim().length > 0);
  const hasShort = locales.some((locale) => (value.shortDescription?.[locale] ?? "").trim().length > 0);
  const hasDescription = locales.some((locale) => (value.description?.[locale] ?? "").trim().length > 0);
  // Partial intake drafts are schema-valid but content-empty; they must not trigger conversational edit mode.
  return hasTitle && (hasShort || hasDescription);
}

function localizedContentScore(draft: ListingDraft | null | undefined) {
  if (!draft) return 0;
  const locales = ["en", "ru", "uk", "sq", "it"] as const;
  let score = 0;
  for (const locale of locales) {
    if ((draft.title?.[locale] ?? "").trim()) score += 1;
    if ((draft.shortDescription?.[locale] ?? "").trim()) score += 1;
    if ((draft.description?.[locale] ?? "").trim()) score += 1;
  }
  return score;
}

function pickBestDraft(session: ListingSessionResponse | null | undefined, sessionId: string): ListingDraft | null {
  if (!session) return null;
  const edited = session.editedDraft;
  const generated = session.generatedDraft;
  if (edited && generated) {
    const editedScore = localizedContentScore(edited);
    const generatedScore = localizedContentScore(generated);
    if (generatedScore > editedScore) {
      console.info("[ui][draft] using generatedDraft for preview", {
        sessionId,
        editedScore,
        generatedScore,
      });
      return generated;
    }
    return edited;
  }
  return edited ?? generated ?? createBaseDraftFromFacts(sessionId, session.extractedFacts);
}

/**
 * Picks the draft with the richest multilingual title/shortDescription/description.
 * On ties, prefers generatedDraft (canonical AI output) over session edited, then base, then form-composed.
 */
function pickDraftWithMaxLocalizedContent(
  candidates: Array<{ draft: ListingDraft | null; tieBreak: number }>,
): ListingDraft | null {
  let best: ListingDraft | null = null;
  let bestScore = -1;
  let bestTie = 999;
  for (const { draft, tieBreak } of candidates) {
    if (!draft) continue;
    const s = localizedContentScore(draft);
    if (s > bestScore || (s === bestScore && tieBreak < bestTie)) {
      bestScore = s;
      best = draft;
      bestTie = tieBreak;
    }
  }
  return best;
}

function hasNoDraftError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const api = err as { code?: string };
  return api.code === "NO_DRAFT" || err.message.toLowerCase().includes("no valid draft to edit");
}

export function Form({ sessionId }: FormProps) {
  const { appLanguage } = useAppLanguage();

  const [session, setSession] = useState<ListingSessionResponse | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [composerText, setComposerText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<DraftForm>(emptyDraftForm);
  const [intake, setIntake] = useState<IntakeAnalysisResponse | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordPaused, setRecordPaused] = useState(false);
  const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
  const [publishErrors, setPublishErrors] = useState<PublishGateErrors | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const photoAssets = (session?.assets ?? []).filter((a) => a.storageKey.includes("/photo/"));
  const objectUrlByPendingKeyRef = useRef(new Map<string, string>());
  const pendingKeys = useMemo(
    () => pendingPhotos.map((f) => `pending-${f.name}-${f.size}-${f.lastModified}`),
    [pendingPhotos],
  );
  const pendingPreviewImages = useMemo(() => {
    const map = objectUrlByPendingKeyRef.current;
    const nextKeys = new Set(pendingKeys);
    for (const key of Array.from(map.keys())) {
      if (!nextKeys.has(key)) {
        const url = map.get(key);
        if (url) URL.revokeObjectURL(url);
        map.delete(key);
      }
    }

    const items = pendingPhotos.map((file) => {
      const key = `pending-${file.name}-${file.size}-${file.lastModified}`;
      let url = map.get(key);
      if (!url) {
        url = URL.createObjectURL(file);
        map.set(key, url);
      }
      return { key, label: file.name, url };
    });
    return items;
  }, [pendingKeys, pendingPhotos]);

  const hydrateGalleryFromAssets = (baseDraft: NonNullable<ListingSessionResponse["editedDraft"]>) => {
    const existingByRef = new Map(
      (baseDraft.gallery ?? []).map((item) => [item.image.asset._ref, item] as const),
    );
    const gallery = photoAssets.map((asset, index) => {
      const ref = `temp:${asset.storageKey}`;
      const existing = existingByRef.get(ref);
      return (
        existing ?? {
          image: {
            _type: "image" as const,
            asset: {
              _type: "reference" as const,
              _ref: ref,
            },
          },
          alt: "",
          sortOrder: index,
        }
      );
    });
    const coverStillExists =
      baseDraft.coverImage?.asset?._ref &&
      gallery.some((item) => item.image.asset._ref === baseDraft.coverImage?.asset?._ref);
    return {
      ...baseDraft,
      gallery,
      coverImage: coverStillExists
        ? baseDraft.coverImage
        : undefined,
    };
  };

  const baseForDraft = useMemo((): ListingDraft | null => {
    if (!session) return null;
    return pickBestDraft(session, sessionId);
  }, [session, sessionId]);

  const effectiveEditedDraft = useMemo((): ListingDraft | null => {
    if (!baseForDraft) return null;
    return hydrateGalleryFromAssets(toListingDraft(draft, baseForDraft));
  }, [draft, baseForDraft, photoAssets]);

  const previewDraft = useMemo((): ListingDraft | null => {
    if (!session && !effectiveEditedDraft) return null;
    const hydratedGen = session?.generatedDraft ? hydrateGalleryFromAssets(session.generatedDraft) : null;
    const hydratedSessionEdited = session?.editedDraft ? hydrateGalleryFromAssets(session.editedDraft) : null;
    const best = pickDraftWithMaxLocalizedContent([
      { draft: hydratedGen, tieBreak: 0 },
      { draft: hydratedSessionEdited, tieBreak: 1 },
      { draft: baseForDraft, tieBreak: 2 },
      { draft: effectiveEditedDraft, tieBreak: 3 },
    ]);
    if (!best) return effectiveEditedDraft;
    if (effectiveEditedDraft && best !== effectiveEditedDraft) {
      return {
        ...best,
        gallery: effectiveEditedDraft.gallery,
        coverImage: effectiveEditedDraft.coverImage ?? best.coverImage,
      };
    }
    return best;
  }, [session, baseForDraft, effectiveEditedDraft, photoAssets, draft]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const logKeys = (label: string, d: ListingDraft | null | undefined) => {
      if (!d) {
        console.log(`[preview-bind] ${label}: null`);
        return;
      }
      console.log(`[preview-bind] ${label} score=${localizedContentScore(d)}`, {
        title: Object.keys(d.title ?? {}),
        shortDescription: Object.keys(d.shortDescription ?? {}),
        description: Object.keys(d.description ?? {}),
      });
    };
    logKeys("session.generatedDraft", session?.generatedDraft ?? undefined);
    logKeys("session.editedDraft", session?.editedDraft ?? undefined);
    logKeys("baseForDraft", baseForDraft ?? undefined);
    logKeys("effectiveEditedDraft", effectiveEditedDraft ?? undefined);
    logKeys("previewDraft (passed to panel)", previewDraft ?? undefined);
  }, [session?.generatedDraft, session?.editedDraft, baseForDraft, effectiveEditedDraft, previewDraft]);

  const publishGate = useMemo(() => {
    if (!session || !effectiveEditedDraft) {
      return {
        ok: false as const,
        errors: { missing: ["session"], invalid: [], unconfirmed: [] as string[] },
      };
    }
    return buildPublishPayload({
      id: session.id,
      editedDraft: effectiveEditedDraft,
      confirmation: session.confirmation,
    });
  }, [session, effectiveEditedDraft]);

  const canDraftPublish = useMemo(() => {
    return canPublishDraft({
      sourceText,
      draft: effectiveEditedDraft,
      extractedFacts: session?.extractedFacts ?? null,
      assetsCount: (session?.assets ?? []).length + pendingPhotos.length,
    });
  }, [effectiveEditedDraft, pendingPhotos.length, session?.assets, session?.extractedFacts, sourceText]);

  const galleryAltIssues = useMemo(() => {
    const g = effectiveEditedDraft?.gallery ?? [];
    return g.filter((item) => {
      const a = item.alt;
      const s = typeof a === "string" ? a : a && typeof a === "object" && "en" in a ? (a as { en?: string }).en : "";
      return !String(s ?? "").trim();
    }).length;
  }, [effectiveEditedDraft]);

  const canPropertyPublish = useMemo(() => {
    if (!session) return false;
    return canPublishProperty({
      sessionId: session.id,
      editedDraft: effectiveEditedDraft,
      confirmation: session.confirmation,
      galleryAltIssues,
    });
  }, [effectiveEditedDraft, galleryAltIssues, session]);

  const appendMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const buildAssistantIntakeMessage = (nextIntake: IntakeAnalysisResponse) => {
    const lang = appLanguage;
    if (nextIntake.isReadyForDraft) {
      return INTAKE_MESSAGES.ready[lang];
    }
    // When all text facts are present but only photo is missing, show a softer message
    if (nextIntake.isReadyForTextDraft) {
      return INTAKE_MESSAGES.textReady[lang];
    }
    const refBlock =
      nextIntake.referenceMessages?.length > 0
        ? `${INTAKE_MESSAGES.referencePrefix[lang]}\n${nextIntake.referenceMessages.join("\n")}\n\n`
        : "";
    const missing = nextIntake.missingRequiredFacts
      .map((item) => (FIELD_LABELS[item]?.[lang] ?? item))
      .join(", ");

    // Build a localized question for the first missing required fact, with
    // allowed-value hints for city and propertyType when available.
    const firstMissing = nextIntake.missingRequiredFacts[0] as RequiredFactKey | undefined;
    let nextQuestion: string;
    if (firstMissing) {
      const base = QUESTION_MESSAGES[firstMissing]?.[lang] ?? INTAKE_MESSAGES.fallback[lang];
      if (firstMissing === "city" && nextIntake.cityNames?.length) {
        const hints = nextIntake.cityNames.slice(0, 10).join(", ");
        nextQuestion = `${base} (${hints})`;
      } else if (firstMissing === "propertyType" && nextIntake.propertyTypeNames?.length) {
        const hints = nextIntake.propertyTypeNames.slice(0, 10).join(", ");
        nextQuestion = `${base} (${hints})`;
      } else {
        nextQuestion = base;
      }
    } else {
      nextQuestion = INTAKE_MESSAGES.fallback[lang];
    }

    return `${refBlock}${INTAKE_MESSAGES.missingPrefix[lang]} ${missing}.\n\n${nextQuestion}`;
  };

  const loadSession = async () => {
    try {
      const data = await getSession(sessionId);
      setSession(data);
      setSourceText(data.sourceText ?? "");
      const base = data.editedDraft ?? data.generatedDraft ?? createBaseDraftFromFacts(data.id, data.extractedFacts);
      setDraft(toDraftForm(hydrateGalleryFromAssets(base)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  };

  useEffect(() => {
    void loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [composerText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loadingStep]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlByPendingKeyRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      objectUrlByPendingKeyRef.current.clear();
    };
  }, []);

  const uploadPendingPhotosIfAny = async () => {
    if (!pendingPhotos.length) return;
    setLoadingStep(`Uploading photos (${pendingPhotos.length})...`);
    await uploadPhotos(sessionId, pendingPhotos);
    // Fetch fresh session and batch ALL state updates together so there is no
    // render where pending images are cleared but uploaded images are not yet visible.
    const data = await getSession(sessionId);
    const base = data.editedDraft ?? data.generatedDraft ?? createBaseDraftFromFacts(data.id, data.extractedFacts);
    setSession(data);
    setSourceText(data.sourceText ?? "");
    setDraft(toDraftForm(hydrateGalleryFromAssets(base)));
    setPendingPhotos([]);   // batched with setSession — no blank image flash
  };

  const removePendingImage = (key: string) => {
    setPendingPhotos((prev) =>
      prev.filter((file) => `pending-${file.name}-${file.size}-${file.lastModified}` !== key),
    );
    if (activeImageKey === key) {
      setActiveImageKey(null);
    }
  };

  const removeUploadedImage = async (assetId: string) => {
    await removePhoto(sessionId, assetId);
    await loadSession();
    setActiveImageKey(null);
  };

  const generateFullListing = async () => {
    setLoading(true);
    setIsGenerating(true);
    setLoadingStep(UI_TEXT.loadingAnalyzing[appLanguage]);
    setError(null);
    toast.loading(TOAST_MESSAGES.genStarted[appLanguage], { id: `gen-${sessionId}` });
    try {
      await uploadPendingPhotosIfAny();
      await patchSession(sessionId, { sourceText });
      const stageA = await runIntake(sessionId);
      setSession(stageA.session);
      setIntake(stageA.intake);
      console.info("[ui][intake] runIntake result", {
        knownFacts: stageA.intake.knownFacts,
        missingRequiredFacts: stageA.intake.missingRequiredFacts,
        missingOptionalFacts: stageA.intake.missingOptionalFacts,
      });
      if (!stageA.intake.isReadyForDraft) {
        throw new Error("Complete required facts in AI questions before full draft generation.");
      }
      setLoadingStep(UI_TEXT.loadingGeneratingFull[appLanguage]);
      await generateSession(sessionId);
      await loadSession();
      appendMessage({
        id: makeId("assistant"),
        role: "assistant",
        content: INTAKE_MESSAGES.draftGenerated[appLanguage],
      });
      toast.success(TOAST_MESSAGES.genComplete[appLanguage], { id: `gen-${sessionId}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Full draft generation failed";
      setError(message);
      appendMessage({ id: makeId("system"), role: "system", content: message });
      toast.error(message, { id: `gen-${sessionId}` });
    } finally {
      setLoadingStep(null);
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const saveEditedDraft = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseDraft =
        session?.editedDraft ?? session?.generatedDraft ?? createBaseDraftFromFacts(sessionId, session?.extractedFacts);
      await patchSession(sessionId, { editedDraft: hydrateGalleryFromAssets(toListingDraft(draft, baseDraft)) });
      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const publishAsDraft = async () => {
    if (!canDraftPublish || loading || isGenerating || isPublishing) return;
    setIsPublishing(true);
    setLoading(true);
    setError(null);
    toast.loading(TOAST_MESSAGES.draftSaving[appLanguage], { id: `pub-draft-${sessionId}` });
    try {
      await saveEditedDraft();
      const result = await publishDraftSession(sessionId);
      await loadSession();
      if (result.persistedToSanity) {
        toast.success(TOAST_MESSAGES.draftSavedSanity[appLanguage], { id: `pub-draft-${sessionId}` });
      } else {
        toast.success(TOAST_MESSAGES.draftSavedLocal[appLanguage], {
          id: `pub-draft-${sessionId}`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Draft publish failed";
      setError(message);
      toast.error(message, { id: `pub-draft-${sessionId}` });
    } finally {
      setLoading(false);
      setIsPublishing(false);
    }
  };

  const publishAsProperty = async () => {
    if (!canPropertyPublish || loading || isGenerating || isPublishing) return;
    try {
      await saveEditedDraft();
    } catch {
      return;
    }
    setIsPublishing(true);
    setLoading(true);
    setError(null);
    toast.loading(TOAST_MESSAGES.publishingProperty[appLanguage], { id: `pub-prop-${sessionId}` });
    try {
      await publishSession(sessionId);
      await loadSession();
      toast.success(TOAST_MESSAGES.publishedProperty[appLanguage], { id: `pub-prop-${sessionId}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
      const details = (err as ApiErrorWithDetails | null)?.details;
      if (isPublishGateErrors(details)) {
        setPublishErrors(details);
      }
      const msg = err instanceof Error ? err.message : "Publish failed";
      toast.error(msg, { id: `pub-prop-${sessionId}` });
    } finally {
      setLoading(false);
      setIsPublishing(false);
    }
  };

  const stopMediaTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setError(null);
    setRecordSeconds(0);
    setRecordPaused(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setRecording(false);
        stopMediaTracks();
        if (!chunksRef.current.length) return;

        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        const ext = blob.type.includes("mpeg") ? "mp3" : blob.type.includes("wav") ? "wav" : "webm";
        const file = new File([blob], `chat-voice-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" });

        setTranscribing(true);
        try {
          const result = await transcribeAudio(sessionId, file);
          const transcript = result.transcript.trim();
          if (!transcript) return;
          setComposerText((prev) => (prev.trim() ? `${prev.trim()}\n${transcript}` : transcript));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
      stopMediaTracks();
    }
  };

  const togglePauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec || !recording) return;
    if (rec.state === "recording") {
      rec.pause();
      setRecordPaused(true);
    } else if (rec.state === "paused") {
      rec.resume();
      setRecordPaused(false);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    if (recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const sendMessage = async () => {
    const text = composerText.trim();
    const hasPhotos = pendingPhotos.length > 0;
    if ((!text && !hasPhotos) || loading || transcribing) return;

    appendMessage({
      id: makeId("user"),
      role: "user",
      content: text || `Attached photos (${pendingPhotos.length})`,
    });
    setComposerText("");
    setLoading(true);
    setIsGenerating(true);
    setError(null);
    setLoadingStep(null);
    toast.loading(TOAST_MESSAGES.analysisStarted[appLanguage], { id: `gen-${sessionId}` });

    try {
      await uploadPendingPhotosIfAny();

      // Photos only + draft already exists → re-generate to include new photos
      if (!text) {
        const hasDraft = hasUsableDraft(session?.editedDraft) || hasUsableDraft(session?.generatedDraft);
        if (hasDraft) {
          setLoadingStep(UI_TEXT.loadingUpdatingPhotos[appLanguage]);
          await generateSession(sessionId);
          await loadSession();
          appendMessage({
            id: makeId("assistant"),
            role: "assistant",
            content: INTAKE_MESSAGES.draftGenerated[appLanguage],
          });
        } else {
          await loadSession();
          appendMessage({
            id: makeId("assistant"),
            role: "assistant",
            content: TOAST_MESSAGES.photoOnly[appLanguage],
          });
        }
        toast.success(TOAST_MESSAGES.analysisComplete[appLanguage], { id: `gen-${sessionId}` });
        return;
      }

      // Conversational edit mode: only if a schema-valid draft exists.
      const hasDraft = hasUsableDraft(session?.editedDraft) || hasUsableDraft(session?.generatedDraft);
      if (hasDraft) {
        try {
          setLoadingStep(UI_TEXT.loadingApplyingEdit[appLanguage]);
          const detectedLang = detectInputLanguage(text);
          const editResult = await conversationalEdit(sessionId, text, detectedLang);
          await loadSession();
          appendMessage({
            id: makeId("assistant"),
            role: "assistant",
            content: editResult.changeSummary,
          });
          toast.success(TOAST_MESSAGES.editApplied[appLanguage], { id: `gen-${sessionId}` });
          return;
        } catch (err) {
          // Guardrail against client/server drift: continue intake instead of hard failing.
          if (!hasNoDraftError(err)) {
            throw err;
          }
          console.info("[ui][routing] conversational-edit returned NO_DRAFT, fallback to intake", { sessionId });
        }
      }

      // Initial intake mode: no draft yet
      const merged = sourceText ? `${sourceText}\n${text}` : text;
      setSourceText(merged);
      await patchSession(sessionId, { sourceText: merged });

      setLoadingStep(UI_TEXT.loadingAnalyzing[appLanguage]);
      const result = await runIntake(sessionId);
      // Batch session, draft form, and intake state together for consistent render.
      const newBase =
        result.session.editedDraft ??
        result.session.generatedDraft ??
        createBaseDraftFromFacts(result.session.id, result.session.extractedFacts);
      setSession(result.session);
      setDraft(toDraftForm(hydrateGalleryFromAssets(newBase)));
      setIntake(result.intake);
      console.info("[ui][intake] sendMessage result", {
        knownFacts: result.intake.knownFacts,
        missingRequiredFacts: result.intake.missingRequiredFacts,
        missingOptionalFacts: result.intake.missingOptionalFacts,
        isReadyForTextDraft: result.intake.isReadyForTextDraft,
        isReadyForDraft: result.intake.isReadyForDraft,
      });
      appendMessage({
        id: makeId("assistant"),
        role: "assistant",
        content: buildAssistantIntakeMessage(result.intake),
      });

      // Generate draft as soon as text facts are ready, even if photo is missing.
      const canGenerate = result.intake.isReadyForDraft || result.intake.isReadyForTextDraft;
      if (canGenerate && !result.session.generatedDraft) {
        setLoadingStep(UI_TEXT.loadingGeneratingDraft[appLanguage]);
        await generateSession(sessionId);
        await loadSession();
        const photoMissing = !result.intake.isReadyForDraft && result.intake.isReadyForTextDraft;
        appendMessage({
          id: makeId("assistant"),
          role: "assistant",
          content: photoMissing
            ? INTAKE_MESSAGES.earlyDraftGenerated[appLanguage]
            : INTAKE_MESSAGES.draftGenerated[appLanguage],
        });
      }
      toast.success(TOAST_MESSAGES.analysisComplete[appLanguage], { id: `gen-${sessionId}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      if (!hasNoDraftError(err)) {
        appendMessage({ id: makeId("system"), role: "system", content: message });
      }
      toast.error(message, { id: `gen-${sessionId}` });
    } finally {
      setLoadingStep(null);
      setLoading(false);
      setIsGenerating(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const canSend = useMemo(() => {
    return canSendMessage({ text: composerText, photoCount: pendingPhotos.length, recording });
  }, [composerText, pendingPhotos.length, recording]);

  const onPickPhotos = () => {
    if (loading || transcribing || recording) return;
    photoInputRef.current?.click();
  };

  const onPhotoFilesSelected = (files: FileList | null) => {
    const next = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!next.length) return;
    setPendingPhotos((prev) => [...prev, ...next]);
  };

  const toggleConfirmField = async (field: CriticalConfirmationField, checked: boolean) => {
    setLoading(true);
    setError(null);
    try {
      await patchSession(sessionId, {
        ...(checked ? { confirmationSet: [field] } : { confirmationUnset: [field] }),
      });
      await loadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update confirmation");
    } finally {
      setLoading(false);
    }
  };

  const updateImageAlt = async (assetRef: string, value: string) => {
    const baseDraft =
      session?.editedDraft ?? session?.generatedDraft ?? createBaseDraftFromFacts(sessionId, session?.extractedFacts);
    const hydrated = hydrateGalleryFromAssets(toListingDraft(draft, baseDraft));
    const nextDraft = {
      ...hydrated,
      gallery: (hydrated.gallery ?? []).map((item) =>
        item.image.asset._ref === assetRef
          ? {
              ...item,
              alt: value,
            }
          : item,
      ),
    };
    await patchSession(sessionId, { editedDraft: nextDraft });
    await loadSession();
  };

  const selectCoverImage = async (assetRef: string) => {
    const baseDraft =
      session?.editedDraft ?? session?.generatedDraft ?? createBaseDraftFromFacts(sessionId, session?.extractedFacts);
    const hydrated = hydrateGalleryFromAssets(toListingDraft(draft, baseDraft));
    const selected = (hydrated.gallery ?? []).find((item) => item.image.asset._ref === assetRef);
    if (!selected) return;
    const nextDraft = {
      ...hydrated,
      coverImage: selected.image,
    };
    await patchSession(sessionId, { editedDraft: nextDraft });
    await loadSession();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-2xl border border-[var(--app-border)] bg-[var(--panel-bg)]/70 p-4 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--app-fg)]">{UI_TEXT.chatTitle[appLanguage]}</h3>
          <div className="flex items-center gap-2">
            {loadingStep ? <span className="text-xs text-[var(--muted-fg)]">{loadingStep}</span> : null}
          </div>
        </div>

        <div className="h-[42vh] min-h-[280px] max-h-[480px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/35 p-3">
          <div className="grid gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={[
                  "max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "ml-auto border border-sky-700/60 bg-sky-950/30 text-sky-100"
                    : message.role === "assistant"
                      ? "mr-auto border border-slate-700 bg-slate-900/60 text-slate-100"
                      : "mr-auto border border-amber-700/50 bg-amber-950/20 text-amber-100",
                ].join(" ")}
              >
                {message.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/25 p-3">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onPhotoFilesSelected(e.target.files);
              e.currentTarget.value = "";
            }}
            disabled={loading || transcribing || recording}
          />

          {pendingPreviewImages.length ? (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {pendingPreviewImages.map((img) => (
                <div key={img.key} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-700">
                  <img src={img.url} alt={img.label} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePendingImage(img.key)}
                    className="absolute right-1 top-1 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-[10px] text-slate-100 cursor-pointer"
                    title={UI_TEXT.remove[appLanguage]}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-2xl bg-slate-900/45 px-3 py-2 shadow-sm ring-1 ring-transparent focus-within:ring-slate-600/40">
            <button
              type="button"
              onClick={onPickPhotos}
              disabled={loading || transcribing || recording}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/40 text-slate-100 hover:bg-slate-800/70 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              title={UI_TEXT.attachPhotos[appLanguage]}
            >
              <Plus size={19} />
            </button>

            <textarea
              ref={composerRef}
              className="min-h-[44px] max-h-[180px] w-full resize-none overflow-y-auto rounded-xl bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={UI_TEXT.messagePlaceholder[appLanguage]}
              rows={1}
            />

            <div className="flex items-center gap-2">
              {recording ? (
                <button
                  type="button"
                  onClick={togglePauseRecording}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/40 text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  title={recordPaused ? UI_TEXT.resumeRecording[appLanguage] : UI_TEXT.pauseRecording[appLanguage]}
                >
                  {recordPaused ? <Play size={19} /> : <Pause size={19} />}
                </button>
              ) : null}

              <button
                type="button"
                onClick={recording ? stopRecording : () => void startRecording()}
                disabled={loading || transcribing}
                className={[
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors",
                  recording
                    ? "bg-rose-950/30 hover:bg-rose-900/30"
                    : "bg-slate-800/40 hover:bg-slate-800/70",
                ].join(" ")}
                title={recording ? UI_TEXT.stopRecording[appLanguage] : UI_TEXT.voiceInput[appLanguage]}
              >
                {recording ? <Square size={19} /> : <Mic size={19} />}
              </button>

              <button
                type="button"
                onClick={() => (recording ? stopRecording() : void sendMessage())}
                disabled={!canSend || loading || transcribing}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/70 text-slate-100 hover:bg-slate-700/80 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                title={recording ? UI_TEXT.stopRecording[appLanguage] : UI_TEXT.send[appLanguage]}
              >
                <Send size={19} />
              </button>
            </div>
          </div>

          {transcribing ? <span className="mt-2 inline-block text-xs text-blue-300">{UI_TEXT.transcribing[appLanguage]}</span> : null}
          {recording ? (
            <span className="mt-2 inline-block text-xs text-rose-200">
              {UI_TEXT.recording[appLanguage]} {recordPaused ? UI_TEXT.paused[appLanguage] : "…"} {formatTime(recordSeconds)}
            </span>
          ) : null}
        </div>

        <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/25 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-100">{UI_TEXT.advancedEdit[appLanguage]}</summary>
          <div className="mt-3 grid gap-3">
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.internalRef}
              onChange={(e) => setDraft((prev) => ({ ...prev, internalRef: e.target.value }))}
              placeholder="Internal Ref"
            />
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.status}
              onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value as DraftForm["status"] }))}
            >
              <option value="draft">draft</option>
              <option value="in_review">in_review</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.slug}
              onChange={(e) => setDraft((prev) => ({ ...prev, slug: e.target.value }))}
              placeholder="Slug"
            />
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.titleEn}
              onChange={(e) => setDraft((prev) => ({ ...prev, titleEn: e.target.value }))}
              placeholder="Title (EN)"
            />
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.shortDescriptionEn}
              onChange={(e) => setDraft((prev) => ({ ...prev, shortDescriptionEn: e.target.value }))}
              placeholder="Short Description (EN)"
              rows={3}
            />
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.descriptionEn}
              onChange={(e) => setDraft((prev) => ({ ...prev, descriptionEn: e.target.value }))}
              placeholder="Description (EN)"
              rows={6}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                type="number"
                value={draft.priceAmount}
                onChange={(e) => setDraft((prev) => ({ ...prev, priceAmount: e.target.value }))}
                placeholder="Price (EUR)"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                value={draft.propertyType}
                onChange={(e) => setDraft((prev) => ({ ...prev, propertyType: e.target.value }))}
                placeholder="Property type (match Sanity propertyType)"
              />
              <select
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                value={draft.dealStatus}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, dealStatus: e.target.value as DraftForm["dealStatus"] }))
                }
              >
                <option value="sale">sale</option>
                <option value="rent">rent</option>
                <option value="short-term">short-term</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                type="number"
                value={draft.area}
                onChange={(e) => setDraft((prev) => ({ ...prev, area: e.target.value }))}
                placeholder="Area (m²)"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                type="number"
                value={draft.bedrooms}
                onChange={(e) => setDraft((prev) => ({ ...prev, bedrooms: e.target.value }))}
                placeholder="Bedrooms"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                type="number"
                value={draft.bathrooms}
                onChange={(e) => setDraft((prev) => ({ ...prev, bathrooms: e.target.value }))}
                placeholder="Bathrooms"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                value={draft.countryCode}
                onChange={(e) => setDraft((prev) => ({ ...prev, countryCode: e.target.value.toUpperCase() }))}
                placeholder="Country code"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                value={draft.city}
                onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="City"
              />
              <input
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                value={draft.district}
                onChange={(e) => setDraft((prev) => ({ ...prev, district: e.target.value }))}
                placeholder="District"
              />
            </div>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
              value={draft.displayAddressEn}
              onChange={(e) => setDraft((prev) => ({ ...prev, displayAddressEn: e.target.value }))}
              placeholder="Display address (EN) — публичная строка адреса"
            />
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Image Metadata</div>
              <div className="mt-2 grid gap-2">
                {photoAssets.length ? (
                  photoAssets.map((asset, index) => {
                    const draftModel =
                      session?.editedDraft ?? session?.generatedDraft ?? createBaseDraftFromFacts(sessionId, session?.extractedFacts);
                    const hydrated = hydrateGalleryFromAssets(draftModel);
                    const ref = `temp:${asset.storageKey}`;
                    const item = (hydrated.gallery ?? []).find((g) => g.image.asset._ref === ref);
                    const alt =
                      typeof item?.alt === "string"
                        ? item.alt
                        : item?.alt && typeof item.alt === "object" && "en" in item.alt
                          ? String((item.alt as { en?: string }).en ?? "")
                          : "";
                    const isCover = hydrated.coverImage?.asset?._ref === ref;
                    return (
                      <div key={asset.id} className="grid gap-2 rounded-lg border border-slate-800 p-2">
                        <div className="text-xs text-slate-300">{asset.fileName}</div>
                        <input
                          className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100"
                          value={alt}
                          onChange={(e) => void updateImageAlt(ref, e.target.value)}
                          placeholder="Alt text (required for publish; schema: non-localized string)"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="radio"
                            name="cover-image"
                            checked={isCover}
                            onChange={() => void selectCoverImage(ref)}
                          />
                          Use as cover image #{index + 1}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400">Upload photos to prepare gallery metadata.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Подтверждение критичных полей</div>
              <p className="mt-1 text-[11px] text-slate-500">
                Статусы: нет данных / заполнено, не подтверждено / подтверждено. Галерея без alt блокирует Publish.
              </p>
              <div className="mt-2 grid gap-1">
                {CRITICAL_CONFIRMATION_FIELDS.map((field) => {
                  const status = getCriticalFieldStatus(effectiveEditedDraft, field, getConfirmation(session));
                  const checked = status === "confirmed";
                  const statusLabel =
                    status === "missing" ? "нет данных" : status === "unconfirmed" ? "не подтверждено" : "подтверждено";
                  return (
                    <label
                      key={field}
                      className="inline-flex items-center justify-between gap-2 rounded-md border border-slate-800 px-2 py-1 text-xs"
                    >
                      <span
                        className={
                          status === "missing" ? "text-rose-300" : status === "unconfirmed" ? "text-amber-200" : "text-emerald-300"
                        }
                      >
                        {field}{" "}
                        <span className="text-slate-500">({statusLabel})</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => void toggleConfirmField(field, e.target.checked)}
                        disabled={loading || status === "missing"}
                        title={status === "missing" ? "Сначала заполните поле в черновике" : undefined}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={actionButtonClass({ disabled: loading, tone: "secondary" })}
                type="button"
                onClick={saveEditedDraft}
                disabled={loading}
              >
                Save Edited Draft
              </button>
              <button
                className={actionButtonClass({ disabled: loading, tone: "primary" })}
                type="button"
                onClick={generateFullListing}
                disabled={loading || isPublishing}
              >
                Generate Full Listing
              </button>
            </div>
          </div>
        </details>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      <aside className="min-w-0 overflow-hidden lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto lg:pr-1">
        <ListingPreviewPanel
          session={session}
          previewDraft={previewDraft}
          pendingImages={pendingPreviewImages}
          activeImageKey={activeImageKey}
          onActiveImageChange={setActiveImageKey}
          onRemovePendingImage={removePendingImage}
          onRemoveUploadedImage={removeUploadedImage}
        />
        <section className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/30 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Publish</h3>
          <p className="mt-1 text-xs text-slate-400">Draft: доступно если форма не пустая. Property: только при проходе реального publish gate + alt у всех фото.</p>

          {isGenerating ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-xs text-slate-200">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400/40 border-t-slate-100" />
              <span>{loadingStep ?? "AI is thinking..."}</span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={actionButtonClass({ disabled: !canDraftPublish || loading || isGenerating || isPublishing, tone: "secondary" })}
              type="button"
              onClick={() => void publishAsDraft()}
              disabled={!canDraftPublish || loading || isGenerating || isPublishing}
            >
              Publish as draft
            </button>
            <button
              className={actionButtonClass({ disabled: !canPropertyPublish || loading || isGenerating || isPublishing, tone: "primary" })}
              type="button"
              onClick={() => void publishAsProperty()}
              disabled={!canPropertyPublish || loading || isGenerating || isPublishing}
            >
              Publish as property
            </button>
          </div>
          {!publishGate.ok ? (
            <div className="mt-2 text-xs text-rose-300">
              {publishGate.errors.missing.length ? <p>Не хватает: {publishGate.errors.missing.join(", ")}</p> : null}
              {publishGate.errors.invalid.length ? <p>Некорректно: {publishGate.errors.invalid.join(", ")}</p> : null}
              {publishGate.errors.unconfirmed.length ? (
                <p>Не подтверждено: {publishGate.errors.unconfirmed.join(", ")}</p>
              ) : null}
            </div>
          ) : null}
          {galleryAltIssues > 0 ? (
            <p className="mt-2 text-xs text-amber-300">Заполните alt для всех фото в галерее ({galleryAltIssues} без текста).</p>
          ) : null}
          {publishErrors ? (
            <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 p-2 text-xs text-rose-200">
              <div className="font-semibold text-rose-100">Ответ сервера (публикация)</div>
              {publishErrors.missing.length ? (
                <p className="mt-1">Отсутствует: {publishErrors.missing.join(", ")}</p>
              ) : null}
              {publishErrors.invalid.length ? <p className="mt-1">Некорректно: {publishErrors.invalid.join(", ")}</p> : null}
              {publishErrors.unconfirmed.length ? (
                <p className="mt-1">Не подтверждено: {publishErrors.unconfirmed.join(", ")}</p>
              ) : null}
            </div>
          ) : null}
          {intake?.isReadyForDraft ? (
            <p className="mt-2 text-xs text-emerald-300">Intake: обязательные поля собраны, можно генерировать / редактировать.</p>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
