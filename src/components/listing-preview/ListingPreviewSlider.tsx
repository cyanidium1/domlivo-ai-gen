"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppLanguage, type AppLanguage } from "@/contexts/language-context";

type ImageItem = { key: string; label: string; url: string };

type Props = {
  images: ImageItem[];
  activeKey?: string | null;
  onActiveChange?: (key: string) => void;
};

const SLIDER_UI: Record<string, Record<AppLanguage, string>> = {
  noPhotos: { en: "No photos uploaded", ru: "Фото не загружены", uk: "Фото не завантажено", sq: "Nuk ka foto të ngarkuara", it: "Nessuna foto caricata" },
  photo: { en: "Photo", ru: "Фото", uk: "Фото", sq: "Foto", it: "Foto" },
  prev: { en: "Prev", ru: "Назад", uk: "Назад", sq: "Para", it: "Prec" },
  next: { en: "Next", ru: "Вперёд", uk: "Вперед", sq: "Tjetra", it: "Succ" },
};

export function ListingPreviewSlider({ images, activeKey, onActiveChange }: Props) {
  const { appLanguage } = useAppLanguage();
  const safeImages = useMemo(() => images ?? [], [images]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!activeKey) return;
    const found = safeImages.findIndex((img) => img.key === activeKey);
    if (found >= 0) setIdx(found);
  }, [activeKey, safeImages]);
  useEffect(() => {
    if (idx > safeImages.length - 1) {
      setIdx(0);
    }
  }, [idx, safeImages.length]);

  const current = safeImages[idx];

  const prev = () => setIdx((v) => (v - 1 + safeImages.length) % safeImages.length);
  const next = () => setIdx((v) => (v + 1) % safeImages.length);
  useEffect(() => {
    if (current?.key) onActiveChange?.(current.key);
  }, [current?.key, onActiveChange]);

  if (!safeImages.length) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4 text-sm text-slate-400">
        {SLIDER_UI.noPhotos[appLanguage]}
      </div>
    );
  }

  return (
    <div className="grid gap-2.5">
      <div className="relative h-[200px] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/40">
        <img
          src={current?.url}
          alt={current?.label ?? `${SLIDER_UI.photo[appLanguage]} ${idx + 1}`}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-3">
          <div className="text-sm font-semibold text-slate-100">
            {SLIDER_UI.photo[appLanguage]} {idx + 1}
          </div>
          <div className="text-xs text-slate-400">{current?.label}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          className="rounded-lg border border-slate-700 bg-transparent px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
          type="button"
          onClick={prev}
        >
          {SLIDER_UI.prev[appLanguage]}
        </button>
        <div className="text-xs text-slate-400">
          {idx + 1} / {safeImages.length}
        </div>
        <button
          className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80"
          type="button"
          onClick={next}
        >
          {SLIDER_UI.next[appLanguage]}
        </button>
      </div>
    </div>
  );
}

