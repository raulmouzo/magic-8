"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from "react";

const SEEN_KEY = "site-notice-seen";
/** Upward drag (px) that dismisses on release. */
const SWIPE_DISTANCE = 32;
/** Upward speed (px/ms) that dismisses on release, however short the drag. */
const FLICK = 0.3;
/** How far a downward drag can stretch the card. */
const RESIST_PX = 24;
/** Matches the closing `duration-300`, plus a frame of slack. */
const EXIT_MS = 320;

// Inline Markdown only: **bold**, *italic* or _italic_, `code`, [text](url)
// and line breaks (a newline, or two or more spaces as in Markdown). Builds React elements, never HTML, so the text can't inject markup.
const INLINE = /(\*\*.+?\*\*|\*.+?\*|_.+?_|`.+?`|\[.+?\]\(\S+?\))/;
const LINK = /^\[(.+?)\]\((\S+?)\)$/;
const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;

const renderInline = (text: string): ReactNode[] =>
  text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="font-semibold text-white">{renderInline(part.slice(2, -2))}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-white/10 px-1 py-px font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = LINK.exec(part);
    if (link) {
      const [, label, href] = link;
      if (!SAFE_HREF.test(href)) return label;
      const external = /^https?:/i.test(href);
      return (
        <a
          key={i}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white"
        >
          {renderInline(label)}
        </a>
      );
    }
    if (/^([*_]).+\1$/.test(part) && part.length > 2) return <em key={i}>{renderInline(part.slice(1, -1))}</em>;
    return part;
  });

const renderMarkdown = (text: string) =>
  text.split(/ {2,}|\r?\n/).map((line, i) => (
    <p key={i}>{renderInline(line)}</p>
  ));

const noSubscription = () => () => {};

// Keyed by message, so a new notice shows even in a session that saw the old one.
const readSeen = (message: string) => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === message;
  } catch {
    return false;
  }
};

const markSeen = (message: string) => {
  try {
    sessionStorage.setItem(SEEN_KEY, message);
  } catch {
    // Private mode or blocked storage: the notice may show again on reload.
  }
};

/** Holds the fuse while `held` or the tab is in the background; resumes it otherwise. */
const syncFuse = (a: Animation | null, held: boolean) => {
  if (!a) return;
  if (held || document.hidden) a.pause();
  else if (a.playState === "paused") a.play();
};

type Drag = { id: number; startY: number; lastY: number; lastT: number; v: number };

type Props = {
  /** Inline Markdown: **bold**, *italic*, `code`, [links](https://…); two spaces or a newline break the line. */
  message: string;
  /** Milliseconds before it hides itself. */
  duration: number;
  /** Show on every page load instead of once per session. */
  always: boolean;
  /** Accessible name of the close button. */
  closeLabel?: string;
};

/**
 * A notice at the top of the page, shown once per session (or always).
 * Hides itself after `duration`, paused while hovered; close it with the
 * button or by swiping up.
 */
export function SiteNotice({ message, duration, always, closeLabel = "Close" }: Props) {
  // True on the server, so it never flashes before storage is read.
  const seen = useSyncExternalStore(
    noSubscription,
    () => !always && readSeen(message),
    () => true,
  );
  const [phase, setPhase] = useState<"open" | "closing" | "gone">("open");
  const cardRef = useRef<HTMLDivElement>(null);
  const fuseRef = useRef<HTMLElement>(null);
  const fuse = useRef<Animation | null>(null);
  const drag = useRef<Drag | null>(null);
  const hover = useRef(false);

  useEffect(() => {
    if (seen || !fuseRef.current) return;
    const a = fuseRef.current.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration,
      easing: "linear",
      fill: "forwards",
    });
    a.onfinish = () => setPhase("closing");
    fuse.current = a;

    // Don't run out while the tab is in the background.
    const onVisibility = () => syncFuse(a, hover.current || drag.current !== null);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      a.cancel();
    };
  }, [seen, duration]);

  // A timer rather than transitionend, which never fires if the transition is
  // interrupted or skipped.
  useEffect(() => {
    if (phase !== "closing") return;
    const t = setTimeout(() => {
      if (!always) markSeen(message);
      setPhase("gone");
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [phase, always, message]);

  if (seen || phase === "gone") return null;

  const close = () => {
    fuse.current?.pause();
    setPhase("closing");
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (e.button !== 0 || drag.current || phase !== "open" || !card) return;
    if ((e.target as Element).closest("button, a")) return;
    card.setPointerCapture(e.pointerId);
    card.style.transition = "none";
    drag.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    syncFuse(fuse.current, true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !cardRef.current) return;
    const dy = e.clientY - d.startY;
    const offset = dy < 0 ? dy : dy / (1 + dy / RESIST_PX);
    cardRef.current.style.transform = `translateY(${offset}px)`;
    if (e.timeStamp > d.lastT) d.v = (e.clientY - d.lastY) / (e.timeStamp - d.lastT);
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const card = cardRef.current;
    if (!d || d.id !== e.pointerId || !card) return;
    drag.current = null;
    card.style.transition = "";
    const dy = e.clientY - d.startY;
    if (dy < -SWIPE_DISTANCE || d.v < -FLICK) {
      // Leave the drag offset in place; the closing translate carries on from it.
      close();
    } else {
      card.style.transform = "";
      syncFuse(fuse.current, hover.current);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+16px)] z-[9999] flex justify-center px-4">
      <div
        ref={cardRef}
        role="alert"
        data-phase={phase}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          hover.current = true;
          syncFuse(fuse.current, true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          hover.current = false;
          syncFuse(fuse.current, drag.current !== null);
        }}
        className="pointer-events-auto relative flex w-fit max-w-lg min-h-14 cursor-grab touch-none items-start gap-3 overflow-hidden rounded-2xl border border-amber-400/20 bg-neutral-900/80 py-3.5 pr-3 pl-4 text-sm leading-relaxed text-neutral-300 shadow-[0_1px_2px_rgb(0_0_0/0.1),0_8px_24px_rgb(0_0_0/0.18)] backdrop-blur-xl backdrop-saturate-150 transition-[translate,transform,opacity] duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] select-none active:cursor-grabbing starting:-translate-y-[calc(100%+24px)] starting:opacity-0 data-[phase=closing]:-translate-y-[calc(100%+24px)] data-[phase=closing]:opacity-0 data-[phase=closing]:duration-300 motion-reduce:translate-none! motion-reduce:transform-none!"
      >
        <svg
          viewBox="0 0 20 20"
          className="mt-px size-5 shrink-0 text-amber-400"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.49 2.87a1.75 1.75 0 0 1 3.02 0l6.28 10.9A1.75 1.75 0 0 1 16.28 16.4H3.72a1.75 1.75 0 0 1-1.51-2.63l6.28-10.9ZM10 6.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6.5Zm0 7.75a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0 flex-1 space-y-1.5 text-pretty">{renderMarkdown(message)}</div>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={close}
          className="-mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-neutral-400 transition-colors hover:bg-white/10 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-white/60"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <i
          ref={fuseRef}
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber-400/70"
        />
      </div>
    </div>
  );
}
