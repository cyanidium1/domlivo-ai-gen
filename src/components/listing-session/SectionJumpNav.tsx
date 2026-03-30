"use client";

import { useEffect, useMemo, useState } from "react";

type SectionItem = {
  id: string;
  label: string;
};

type SectionJumpNavProps = {
  sections: SectionItem[];
};

export function SectionJumpNav({ sections }: SectionJumpNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  const ids = useMemo(() => sections.map((s) => s.id), [sections]);

  useEffect(() => {
    if (!ids.length) return;

    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        root: null,
        rootMargin: "-120px 0px -55% 0px",
        threshold: [0.1, 0.35, 0.7],
      },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label="Session sections" className="mt-3 flex flex-wrap gap-2">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={[
            "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium no-underline",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80",
            activeId === section.id
              ? "border-slate-500 bg-slate-800 text-slate-100"
              : "border-slate-700 bg-slate-950/40 text-slate-300 hover:text-slate-100",
          ].join(" ")}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

