"use client";

type Props = {
  value: "editor" | "preview";
  onChange: (value: "editor" | "preview") => void;
};

export function EditorPreviewSwitch({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full border border-slate-700 bg-slate-950/40 p-1 gap-1"
      role="tablist"
      aria-label="Editor and preview switch"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "editor"}
        className={[
          "rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80",
          value === "editor" ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:text-slate-100",
        ].join(" ")}
        onClick={() => onChange("editor")}
      >
        Editor
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "preview"}
        className={[
          "rounded-full px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80",
          value === "preview" ? "bg-slate-800 text-slate-100" : "text-slate-300 hover:text-slate-100",
        ].join(" ")}
        onClick={() => onChange("preview")}
      >
        Preview
      </button>
    </div>
  );
}

