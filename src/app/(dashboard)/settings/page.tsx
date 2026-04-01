"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { AppLanguage } from "@/lib/i18n/messages";
import type { AppTheme } from "@/lib/settings/model";
import { SUPPORTED_LANGUAGES, getLanguageLabel } from "@/lib/i18n/messages";
import { useSettings } from "@/contexts/settings-context";
import styles from "@/components/dashboard/dashboard.module.css";

function SettingsSection(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className={styles.settingsSectionCard}>
      <div className={styles.settingsSectionHeader}>
        <h2 className={styles.cardTitle}>{props.title}</h2>
        {props.description ? <p className={styles.muted}>{props.description}</p> : null}
      </div>
      <div className={styles.settingsRows}>{props.children}</div>
    </section>
  );
}

function SettingsRow(props: {
  label: string;
  hint: string;
  control: ReactNode;
}) {
  return (
    <div className={styles.settingsRow}>
      <div className={styles.settingsRowInfo}>
        <div className={styles.settingsRowLabel}>{props.label}</div>
        <div className={styles.settingsRowHint}>{props.hint}</div>
      </div>
      <div className={styles.settingsRowControl}>{props.control}</div>
    </div>
  );
}

function SegmentedTheme(props: {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  labels: { light: string; dark: string };
}) {
  return (
    <div className={styles.settingsSegmented} role="radiogroup" aria-label="theme">
      {(["light", "dark"] as const).map((opt) => {
        const active = props.value === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            className={[styles.settingsSegmentedItem, active ? styles.settingsSegmentedItemActive : ""].join(" ")}
            onClick={() => props.onChange(opt)}
          >
            {opt === "light" ? props.labels.light : props.labels.dark}
          </button>
        );
      })}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function DescriptionExampleEditor(props: {
  labels: {
    label: string;
    hint: string;
    save: string;
    saving: string;
    saved: string;
  };
}) {
  const [value, setValue] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current value from API on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/operator-settings")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (data && typeof data === "object" && "descriptionExample" in data) {
          const ex = (data as { descriptionExample: unknown }).descriptionExample;
          setValue(typeof ex === "string" ? ex : "");
        }
      })
      .catch(() => {
        // Non-fatal — user can still type and save
      });
    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setSaveState("saving");
    try {
      const res = await fetch("/api/operator-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptionExample: value.trim() || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveState("saved");
      saveTimerRef.current = setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      saveTimerRef.current = setTimeout(() => setSaveState("idle"), 3000);
    }
  }, [value]);

  // Reset "saved" badge when user edits the text again
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (saveState === "saved") setSaveState("idle");
  }, [saveState]);

  const buttonLabel =
    saveState === "saving"
      ? props.labels.saving
      : saveState === "saved"
        ? props.labels.saved
        : props.labels.save;

  return (
    <div className={styles.settingsRows}>
      <div className={styles.settingsRow} style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
        <div className={styles.settingsRowInfo}>
          <div className={styles.settingsRowLabel}>{props.labels.label}</div>
          <div className={styles.settingsRowHint}>{props.labels.hint}</div>
        </div>
        <textarea
          className={styles.textarea}
          rows={6}
          value={value}
          onChange={handleChange}
          placeholder=""
          disabled={saveState === "saving"}
          style={{ resize: "vertical", width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.button}
            onClick={handleSave}
            disabled={saveState === "saving"}
            aria-busy={saveState === "saving"}
          >
            {buttonLabel}
          </button>
        </div>
        {saveState === "error" && (
          <p className={styles.muted} style={{ color: "var(--color-danger, #c00)", marginTop: "0.25rem" }}>
            Save failed. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { language, setLanguage, theme, setTheme, t } = useSettings();

  return (
    <div className={styles.settingsPage}>
      <SettingsSection title={t.settings.title} description={t.settings.subtitle}>
        <SettingsRow
          label={t.common.interfaceLanguage}
          hint={t.settings.languageHelp}
          control={
            <select
              id="settings-language"
              className={styles.settingsCompactSelect}
              value={language}
              onChange={(e) => setLanguage(e.target.value as AppLanguage)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {getLanguageLabel(lang)}
                </option>
              ))}
            </select>
          }
        />
      </SettingsSection>

      <SettingsSection title={t.settings.appearance}>
        <SettingsRow
          label={t.common.platformTheme}
          hint={t.settings.themeHelp}
          control={
            <SegmentedTheme
              value={theme}
              onChange={setTheme}
              labels={{ light: t.common.light, dark: t.common.dark }}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t.settings.aiGeneration}>
        <DescriptionExampleEditor
          labels={{
            label: t.settings.descriptionExample,
            hint: t.settings.descriptionExampleHelp,
            save: t.settings.descriptionExampleSave,
            saving: t.settings.descriptionExampleSaving,
            saved: t.settings.descriptionExampleSaved,
          }}
        />
      </SettingsSection>

      <section className={styles.settingsFooterNote}>
        <div className={styles.noticeTitle}>{t.common.general}</div>
        <p className={styles.noticeBody}>{t.settings.futureNote}</p>
      </section>
    </div>
  );
}
