"use client";

// A pared-down prompt bar: a growing text box and a send button.

import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const LINE_HEIGHT = 22;
const MAX_ROWS = 4;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Sending with an empty box is allowed. */
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** True while the bar has mouse hover or visible focus. */
  onHighlightChange?: (highlighted: boolean) => void;
};

export function PromptBar({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder,
  maxLength,
  onHighlightChange,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const highlighted = hovered || focused;
  const empty = !value.trim();
  useEffect(
    () => onHighlightChange?.(highlighted),
    [highlighted, onHighlightChange],
  );

  // Grow with the text, then scroll.
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const max = LINE_HEIGHT * MAX_ROWS;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, max)}px`;
    input.style.overflowY = input.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  const send = () => {
    if (!disabled) onSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div
      data-highlighted={highlighted || undefined}
      className="flex w-full cursor-text items-end gap-2 rounded-3xl border border-violet-200/15 bg-violet-950/30 py-2 pr-2 pl-5 shadow-[0_0_40px_-8px_#A855F7] backdrop-blur-md transition data-highlighted:border-violet-200/30 data-highlighted:bg-violet-900/40 data-highlighted:shadow-[0_0_48px_-4px_#A855F7]"
      onClick={() => inputRef.current?.focus({ preventScroll: true })}
      // Mouse hover and visible focus only: tapping a button must not leave
      // the light on (the text box always shows focus, so it keeps it).
      onPointerEnter={(event) =>
        event.pointerType === "mouse" && setHovered(true)
      }
      onPointerLeave={() => setHovered(false)}
      onFocus={(event) => setFocused(event.target.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label="Your question"
        // 16px on touch screens stops iOS from zooming in on focus. The
        // scrollbar is a thin violet thumb with no track; the ::-webkit
        // rules cover Safari, which ignores scrollbar-color.
        className="my-[5px] block min-w-0 flex-1 resize-none bg-transparent text-sm leading-[22px] text-violet-50 outline-none [overflow-wrap:anywhere] [scrollbar-color:color-mix(in_oklab,var(--color-violet-300)_45%,transparent)_transparent] [scrollbar-width:thin] placeholder:text-violet-200/40 placeholder:text-ellipsis placeholder:whitespace-nowrap pointer-coarse:text-base [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-300/45 [&::-webkit-scrollbar-track]:bg-transparent"
      />
      {/* With nothing typed it reads "Or go random"; the label folds away on typing. */}
      <button
        type="button"
        onClick={send}
        disabled={disabled}
        aria-label={empty ? "Or go random" : "Ask the ball"}
        data-empty={empty || undefined}
        className="group flex h-8 flex-none cursor-pointer items-center rounded-full bg-violet-50 px-2 text-violet-950 shadow-[0_0_20px_-4px_#A855F7] transition hover:bg-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:bg-violet-200/15 disabled:text-violet-200/40 disabled:shadow-none motion-reduce:active:scale-100"
      >
        <span
          aria-hidden="true"
          className="max-w-0 overflow-hidden text-xs font-semibold tracking-[0.12em] whitespace-nowrap sm:tracking-[0.2em] uppercase opacity-0 transition-all duration-300 group-data-empty:max-w-36 group-data-empty:pr-2 group-data-empty:pl-2 group-data-empty:opacity-100 motion-reduce:transition-none max-[22rem]:text-[11px] max-[22rem]:tracking-[0.05em] max-[22rem]:group-data-empty:pr-1 max-[22rem]:group-data-empty:pl-1"
        >
          Or go random
        </span>
        <svg
          viewBox="0 0 24 24"
          className="size-4 flex-none"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M12 4.5 18.5 11h-4.25v8.5h-4.5V11H5.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
