"use client";

import { useState, useSyncExternalStore } from "react";

const SEEN_KEY = "motion-permission-prompt-seen";

const noSubscription = () => () => {};

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
};

const markSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Private mode or blocked storage: the prompt may show again next visit.
  }
};

/** Whether the prompt was already shown on an earlier visit (true on the server, so it never flashes). */
export const useMotionPromptSeen = () =>
  useSyncExternalStore(noSubscription, readSeen, () => true);

type Props = {
  /** Called from the OK click, so the browser accepts it as a user gesture. */
  onAccept: () => void;
};

/** One-time explanation shown before the system motion-permission prompt. */
export function MotionPermissionPrompt({ onAccept }: Props) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const accept = () => {
    markSeen();
    setOpen(false);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="motion-prompt-title"
        className="w-full max-w-xs rounded-3xl border border-violet-200/15 bg-violet-950/60 p-6 text-center text-violet-50 shadow-[0_0_60px_-12px_#A855F7] backdrop-blur-md"
      >
        <h2
          id="motion-prompt-title"
          className="text-sm font-semibold tracking-[0.25em] uppercase"
        >
          Shake to ask
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-violet-100/80">
          Some phones need your permission to use their motion sensors. Allow it
          and you can shake your phone to ask the ball.
        </p>
        <button
          type="button"
          onClick={accept}
          autoFocus
          className="mt-5 rounded-full border border-violet-200/20 bg-violet-900/50 px-8 py-2.5 text-sm font-semibold tracking-[0.25em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
        >
          OK
        </button>
      </div>
    </div>
  );
}
