"use client";

import { useEffect, useMemo, useState } from "react";

import { ListingPreviewAdvantages } from "@/components/listing-preview/ListingPreviewAdvantages";
import { ListingPreviewLocaleTabs } from "@/components/listing-preview/ListingPreviewLocaleTabs";
import { ListingPreviewSlider } from "@/components/listing-preview/ListingPreviewSlider";
import type { ListingSessionResponse } from "@/lib/listing-session/client";
import {
  mapSessionToFullPreview,
  previewHeroTitle,
  PREVIEW_MISSING,
  type PreviewLocale,
} from "@/lib/listing-session/preview-mapper";
import { evaluatePublishReadiness } from "@/lib/listing-session/readiness";
import type { ListingDraft } from "@/lib/validation/listing-session";
import { withEnglishFallback } from "@/lib/validation/property-i18n";
import { useAppLanguage, type AppLanguage } from "@/contexts/language-context";

type Props = {
  session: ListingSessionResponse | null;
  /** Effective edited draft (form + hydration); mirrors right-hand schema shape. */
  previewDraft: ListingDraft | null;
  pendingImages?: Array<{ key: string; label: string; url: string }>;
  activeImageKey?: string | null;
  onActiveImageChange?: (key: string) => void;
  onRemovePendingImage?: (key: string) => void;
  onRemoveUploadedImage?: (assetId: string) => Promise<void>;
};

const PREVIEW_UI: Record<
  string,
  Record<AppLanguage, string>
> = {
  schemaPreview: { en: "Schema preview", ru: "Предпросмотр схемы", uk: "Попередній перегляд схеми", sq: "Parapamje e skemës", it: "Anteprima schema" },
  schemaSubtitle: {
    en: "Draft schema — no placeholder substitutions.",
    ru: "Схема черновика — без placeholder-подстановок.",
    uk: "Схема чернетки — без підстановок placeholder.",
    sq: "Skema e draftit — pa zëvendësime placeholder.",
    it: "Schema bozza — senza sostituzioni placeholder.",
  },
  ready: { en: "Ready", ru: "Готово", uk: "Готово", sq: "Gati", it: "Pronto" },
  notReady: { en: "Not ready", ru: "Не готово", uk: "Не готово", sq: "Jo gati", it: "Non pronto" },
  listingSchema: { en: "Listing (schema)", ru: "Листинг (схема)", uk: "Лістинг (схема)", sq: "Listimi (skemë)", it: "Listing (schema)" },
  fallbackNotice: {
    en: "No text for {locale} — EN fallback is shown below.",
    ru: "Нет текста для {locale} — ниже показан fallback из EN.",
    uk: "Немає тексту для {locale} — нижче показано fallback з EN.",
    sq: "Nuk ka tekst për {locale} — më poshtë shfaqet fallback nga EN.",
    it: "Nessun testo per {locale} — sotto viene mostrato il fallback EN.",
  },
  gallery: { en: "Gallery", ru: "Галерея", uk: "Галерея", sq: "Galeri", it: "Galleria" },
  removePhoto: { en: "Remove photo", ru: "Удалить фото", uk: "Видалити фото", sq: "Hiq foton", it: "Rimuovi foto" },
  galleryEmpty: {
    en: "Gallery is empty — upload at least one photo.",
    ru: "Галерея пуста — загрузите хотя бы одно фото.",
    uk: "Галерея порожня — завантажте хоча б одне фото.",
    sq: "Galeria është bosh — ngarkoni të paktën një foto.",
    it: "Galleria vuota — carica almeno una foto.",
  },
};

export function ListingPreviewPanel({
  session,
  previewDraft,
  pendingImages = [],
  activeImageKey,
  onActiveImageChange,
  onRemovePendingImage,
  onRemoveUploadedImage,
}: Props) {
  const { appLanguage } = useAppLanguage();
  const [locale, setLocale] = useState<PreviewLocale>("EN");
  const localeKey = locale.toLowerCase() as "en" | "uk" | "ru" | "sq" | "it";

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const d = previewDraft;
    console.log("[preview-panel] PREVIEW DRAFT", d);
    if (!d) return;
    console.log("[preview-panel] Object.keys title", Object.keys(d.title ?? {}));
    console.log("[preview-panel] Object.keys shortDescription", Object.keys(d.shortDescription ?? {}));
    console.log("[preview-panel] Object.keys description", Object.keys(d.description ?? {}));
  }, [previewDraft]);

  const full = useMemo(
    () => mapSessionToFullPreview({ session, draft: previewDraft, locale, pendingImages }),
    [session, previewDraft, locale, pendingImages],
  );

  const readiness = useMemo(() => evaluatePublishReadiness(session, previewDraft), [session, previewDraft]);

  const sliderImages = useMemo(
    () => full.images.map((img) => ({ key: img.key, label: img.label, url: img.url })),
    [full.images],
  );

  const heroTitle = previewHeroTitle(previewDraft, locale);
  const heroShort = withEnglishFallback(previewDraft?.shortDescription, localeKey).trim() || PREVIEW_MISSING;
  const heroDescription = withEnglishFallback(previewDraft?.description, localeKey).trim() || PREVIEW_MISSING;
  const heroAddress = withEnglishFallback(previewDraft?.address?.displayAddress, localeKey).trim() || PREVIEW_MISSING;

  return (
    <div className="grid gap-3 min-w-0">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--app-fg)]">{PREVIEW_UI.schemaPreview[appLanguage]}</div>
            <div className="mt-0.5 text-xs text-[var(--muted-fg)]">{PREVIEW_UI.schemaSubtitle[appLanguage]}</div>
          </div>
          <span
            className={`flex-shrink-0 inline-flex rounded-full border px-2 py-1 text-[11px] whitespace-nowrap ${
              readiness.isReady
                ? "border-emerald-700/60 text-emerald-200 bg-emerald-950/20"
                : "border-amber-700/60 text-amber-200 bg-amber-950/20"
            }`}
          >
            {readiness.isReady ? PREVIEW_UI.ready[appLanguage] : PREVIEW_UI.notReady[appLanguage]}
          </span>
        </div>
        <ListingPreviewLocaleTabs value={locale} onChange={setLocale} />
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--panel-bg)]/70 p-4">
        <div className="mb-3 text-sm font-semibold text-[var(--app-fg)]">{PREVIEW_UI.listingSchema[appLanguage]}</div>
        {full.isLocaleFallback ? (
          <div className="mb-3 inline-flex rounded-full border border-[var(--app-border)] bg-[var(--content-bg)] px-2 py-1 text-[11px] text-[var(--muted-fg)]">
            {PREVIEW_UI.fallbackNotice[appLanguage].replace("{locale}", locale)}
          </div>
        ) : null}

        <ListingPreviewSlider images={sliderImages} activeKey={activeImageKey} onActiveChange={onActiveImageChange} />

        {full.images.length ? (
          <div className="mt-3 min-w-0">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-[var(--muted-fg)]">{PREVIEW_UI.gallery[appLanguage]}</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {full.images.map((img) => (
                <div
                  key={img.key}
                  className={[
                    "relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg border",
                    activeImageKey === img.key ? "border-sky-500" : "border-slate-700/80",
                  ].join(" ")}
                >
                  <button type="button" className="h-full w-full" onClick={() => onActiveImageChange?.(img.key)}>
                    <img src={img.url} alt={img.label} className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-slate-900"
                    onClick={() => {
                      if (img.kind === "pending") {
                        onRemovePendingImage?.(img.key);
                      } else {
                        void onRemoveUploadedImage?.(img.assetId);
                      }
                    }}
                    aria-label={PREVIEW_UI.removePhoto[appLanguage]}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <ul className="mt-2 grid gap-1 text-[11px] text-slate-400">
              {full.galleryRows.map((row) => (
                <li key={row.ref} className={`break-all ${row.altMissing ? "text-amber-300" : "text-slate-400"}`}>
                  <span className="font-mono text-[10px] text-slate-500 break-all">{row.ref}</span>
                  {` — alt: ${row.altEn}`}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted-fg)]">{PREVIEW_UI.galleryEmpty[appLanguage]}</p>
        )}

        <div className="mt-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Title (локализовано)</div>
          <ul className="text-sm text-slate-200">
            {full.titleRows.map((row) => (
              <li key={row.locale} className={row.isMissing ? "text-amber-300" : ""}>
                <span className="text-slate-500">{row.locale}:</span> {row.value}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-100 break-words">{heroTitle}</div>
            <div className="mt-1 text-sm text-slate-400 break-words">
              {full.factsRows.find((f) => f.key === "propertyType" && !f.missing)?.value ?? PREVIEW_MISSING} ·{" "}
              {full.dealStatusLine} ·{" "}
              {[previewDraft?.address?.district, previewDraft?.address?.city].filter(Boolean).join(", ") || PREVIEW_MISSING}
            </div>
          </div>
          <div className="flex-shrink-0 text-right text-base font-semibold text-slate-100">
            {full.priceMissing ? (
              <span className="text-amber-300">{PREVIEW_MISSING}</span>
            ) : (
              <>
                {full.priceCurrency} {full.priceAmount}
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Price</div>
          <p className={`mt-1 text-sm ${full.priceMissing ? "text-amber-300" : "text-slate-200"}`}>
            EUR {full.priceAmount} (schema: scalar EUR only)
          </p>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">facts (все ключи схемы)</div>
          <dl className="mt-2 grid gap-1 text-sm">
            {full.factsRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 min-w-0">
                <dt className="text-slate-500">{row.key}</dt>
                <dd className={`break-words min-w-0 ${row.missing ? "text-amber-300" : "text-slate-200"}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">address</div>
          <dl className="mt-2 grid gap-1 text-sm">
            {full.addressStructure.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 min-w-0">
                <dt className="text-slate-500">{row.key}</dt>
                <dd className={`whitespace-pre-wrap break-words min-w-0 ${row.missing ? "text-amber-300" : "text-slate-200"}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Short description ({locale})</div>
          <p className={`mt-1 text-sm leading-relaxed ${heroShort === PREVIEW_MISSING ? "text-amber-300" : "text-slate-200"}`}>
            {heroShort}
          </p>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description ({locale})</div>
          <p
            className={`mt-1 text-sm leading-relaxed ${heroDescription === PREVIEW_MISSING ? "text-amber-300" : "text-slate-200"}`}
          >
            {heroDescription}
          </p>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">displayAddress ({locale})</div>
          <p className={`mt-1 text-sm ${heroAddress === PREVIEW_MISSING ? "text-amber-300" : "text-slate-200"}`}>{heroAddress}</p>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">propertyOffers</div>
          {full.propertyOfferRows.length ? (
            <ul className="mt-2 grid gap-2">
              {full.propertyOfferRows.map((rows, i) => (
                <li key={i} className="rounded-lg border border-slate-800 p-2">
                  <ul className="text-xs text-slate-300">
                    {rows.map((r) => (
                      <li key={r.locale} className={r.isMissing ? "text-slate-600" : ""}>
                        {r.locale}: {r.value}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Нет элементов (пустой массив).</p>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">SEO</div>
          <dl className="mt-2 grid gap-1 text-sm">
            {full.seoRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 min-w-0">
                <dt className="text-slate-500">{row.key}</dt>
                <dd className={`break-words min-w-0 ${row.missing ? "text-amber-300" : "text-slate-200"}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {previewDraft?.amenities?.length ? (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">amenities (refs)</div>
            <ListingPreviewAdvantages items={(previewDraft.amenities ?? []).map((a) => a._ref)} />
          </div>
        ) : (
          <div className="mt-4 text-sm text-slate-500">amenities: пусто</div>
        )}

        {previewDraft?.coverImage?.asset?._ref ? (
          <div className="mt-2 text-xs text-slate-400 break-all min-w-0">
            coverImage.ref: <span className="font-mono text-slate-300 break-all">{previewDraft.coverImage.asset._ref}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-amber-300">coverImage: не выбран</div>
        )}
      </section>
    </div>
  );
}
