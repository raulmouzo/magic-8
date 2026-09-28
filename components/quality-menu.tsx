"use client";

import { useId } from "react";
import type { QualityLevel, QualityPreference } from "./graphics-quality";

const LEVEL_NAMES: Record<QualityLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const OPTIONS: { value: QualityPreference; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Adapts to your device" },
  { value: "high", label: "High", hint: "Every effect, full resolution" },
  { value: "medium", label: "Medium", hint: "Lighter, nearly the same look" },
  { value: "low", label: "Low", hint: "Smoothest on older phones" },
];

type Props = {
  preference: QualityPreference;
  /** The level "auto" is using, shown next to it. */
  autoLevel: QualityLevel;
  onChange: (preference: QualityPreference) => void;
  className?: string;
};

/**
 * A gear button with the graphics options. A native popover: it closes on
 * Escape or a click outside with no script of its own.
 */
export function QualityMenu({ preference, autoLevel, onChange, className = "" }: Props) {
  const id = useId();
  const popoverId = `${id}-popover`;
  const titleId = `${id}-title`;

  return (
    <div className={className}>
      <button
        type="button"
        popoverTarget={popoverId}
        aria-label="Graphics settings"
        className="flex size-8 items-center justify-center rounded-full border border-violet-200/15 bg-violet-950/30 text-violet-200/50 backdrop-blur-md transition hover:border-violet-200/30 hover:text-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
      >
        {/* Heroicons "cog-6-tooth" (outline), MIT. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {/* Top layer, so it's placed against the viewport, above the button. */}
      <div
        id={popoverId}
        popover="auto"
        role="dialog"
        aria-labelledby={titleId}
        className="fixed inset-auto bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+2.75rem)] left-[max(1rem,env(safe-area-inset-left))] m-0 w-64 rounded-3xl border border-violet-200/15 bg-violet-950/70 p-4 text-violet-50 shadow-[0_0_60px_-12px_#A855F7] backdrop-blur-md"
      >
        <fieldset>
          <legend
            id={titleId}
            className="mb-3 text-[11px] font-semibold tracking-[0.25em] text-violet-100 uppercase"
          >
            Graphics
          </legend>
          <div className="flex flex-col gap-1">
            {OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-violet-200/5 has-checked:bg-violet-200/10 has-focus-visible:outline-2 has-focus-visible:outline-violet-300"
              >
                <input
                  type="radio"
                  name={`${id}-quality`}
                  value={option.value}
                  checked={preference === option.value}
                  onChange={() => onChange(option.value)}
                  className="size-3.5 cursor-pointer accent-violet-400 outline-none"
                />
                <span className="flex flex-col">
                  <span className="text-sm">
                    {option.label}
                    {option.value === "auto" && (
                      <span className="text-violet-200/50"> · {LEVEL_NAMES[autoLevel]}</span>
                    )}
                  </span>
                  <span className="text-xs text-violet-200/50">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
