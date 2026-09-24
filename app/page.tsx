"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { classifyQuestion } from "@/app/actions";
import { type AnswerCategory, randomAnswer } from "@/components/magic-eight-ball/answers";
import AeroShards, { type AeroShardsHandle, type AeroShardsProps } from "@/components/aero-shards";
import {
  MagicEightBall,
  type MagicEightBallHandle,
  useIsTouch,
  useMotionAccess,
  useShake,
} from "@/components/magic-eight-ball/MagicEightBall";
import { MotionPermissionPrompt, useMotionPromptSeen } from "@/components/motion-permission-prompt";
import { PromptBar } from "@/components/prompt-bar";
import { type LogEntry, QuestionLog } from "@/components/question-log";
import { useKeyboardViewport } from "@/components/use-keyboard-viewport";

// AeroShards speed: default 1, max 2.
const IDLE_SPEED = 0.3;
const THINKING_SPEED = 1.6;
// AeroShards' own click ripple is 1.
const PULSE_STRENGTH = 0.8;
// The ball enters after the background; don't wait longer than this for it.
const BACKGROUND_TIMEOUT_MS = 3000;
// How long the question stays up after the ball settles, and how many past
// answers are kept.
const ARCHIVE_DELAY_MS = 800;
const HISTORY_SIZE = 3;

type Screen = "mobile" | "tablet" | "desktop";

// Big spinning shards read as the whole background rotating, so narrow
// screens turn spin off.
const BACKGROUND: Record<Screen, Partial<AeroShardsProps>> = {
  // A minimal band across the top of the screen (see the wrapper below),
  // as cheap as it gets: a small canvas at 1x and 30 fps, few large shards,
  // and none of the post effects.
  mobile: {
    placement: "full",
    spin: 0,
    scale: 3,
    density: 0.25,
    detail: "bold",
    bloom: 0,
    grain: 0,
    chromaticAberration: 0,
    maxDpr: 1,
    maxFps: 30,
  },
  tablet: { placement: "left", spin: 0, scale: 1.2 },
  desktop: { placement: "full" },
};

// Tailwind's md and lg breakpoints.
const TABLET_QUERY = "(width >= 48rem)";
const DESKTOP_QUERY = "(width >= 64rem)";
const subscribeToScreen = (onChange: () => void) => {
  const queries = [TABLET_QUERY, DESKTOP_QUERY].map((q) => window.matchMedia(q));
  queries.forEach((q) => q.addEventListener("change", onChange));
  return () => queries.forEach((q) => q.removeEventListener("change", onChange));
};
const getScreen = (): Screen =>
  window.matchMedia(DESKTOP_QUERY).matches
    ? "desktop"
    : window.matchMedia(TABLET_QUERY).matches
      ? "tablet"
      : "mobile";

export default function Home() {
  const screen = useSyncExternalStore(subscribeToScreen, getScreen, () => "desktop" as const);
  const ballRef = useRef<MagicEightBallHandle>(null);
  const shardsRef = useRef<AeroShardsHandle>(null);
  const [busy, setBusy] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [buttonHighlighted, setButtonHighlighted] = useState(false);
  const [backgroundReady, setBackgroundReady] = useState(false);
  // With the on-screen keyboard open, the scene shrinks into what's left
  // above it and the ball sits in the space above the controls.
  const keyboard = useKeyboardViewport();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [controlsHeight, setControlsHeight] = useState(0);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const observer = new ResizeObserver(() => setControlsHeight(controls.offsetHeight));
    observer.observe(controls);
    return () => observer.disconnect();
  }, []);
  const handleBackgroundReady = useCallback(() => setBackgroundReady(true), []);

  // On touch screens, shaking the phone asks (once motion access is granted).
  // Phones that need permission get a one-time explanation first; after
  // that, the system prompt opens on the first tap.
  const touch = useIsTouch();
  const promptSeen = useMotionPromptSeen();
  const motion = useMotionAccess(touch, { askOnFirstTap: promptSeen });
  const canShake = touch && motion.access === "granted";
  const showMotionPrompt =
    motion.needsPermission && motion.access === "pending" && !promptSeen && backgroundReady;

  useEffect(() => {
    const timeout = setTimeout(handleBackgroundReady, BACKGROUND_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [handleBackgroundReady]);

  // The background only reacts to the ball, never to the user directly.
  const handleAsk = useCallback(() => {
    // From the ball: the middle of the screen, or just below the phone band.
    shardsRef.current?.pulse(screen === "mobile" ? [0.5, 1] : [0.5, 0.5], PULSE_STRENGTH);
    setThinking(true);
  }, [screen]);

  // The question in progress, shown above the ball until a little after the
  // answer; then it joins the recent answers. Mirrored in a ref for the
  // ball's callbacks.
  const [current, setCurrent] = useState<LogEntry | null>(null);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const currentRef = useRef<LogEntry | null>(null);
  const nextId = useRef(0);
  const archiveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setCurrentEntry = useCallback((entry: LogEntry | null) => {
    currentRef.current = entry;
    setCurrent(entry);
  }, []);
  const archive = useCallback(() => {
    clearTimeout(archiveTimer.current);
    const done = currentRef.current;
    if (done?.answer) setHistory((entries) => [done, ...entries].slice(0, HISTORY_SIZE));
    setCurrentEntry(null);
  }, [setCurrentEntry]);
  useEffect(() => () => clearTimeout(archiveTimer.current), []);

  const handleReveal = useCallback(
    (answer: string) =>
      setCurrentEntry({ ...(currentRef.current ?? { id: nextId.current++, question: null }), answer }),
    [setCurrentEntry],
  );
  const handleRest = useCallback(() => {
    setThinking(false);
    archiveTimer.current = setTimeout(archive, ARCHIVE_DELAY_MS);
  }, [archive]);

  // Jev picks the answer category. An empty question gets a random answer;
  // a failed call gets an "unsure" one, never a joke that could land badly.
  const [question, setQuestion] = useState("");
  const [classifying, setClassifying] = useState(false);
  // The player can turn off the "maybe" and rude answers.
  const [noMaybe, setNoMaybe] = useState(false);
  const [noRude, setNoRude] = useState(false);
  const excluded: AnswerCategory[] = [
    ...(noMaybe ? (["unsure"] as const) : []),
    ...(noRude ? (["rude"] as const) : []),
  ];
  const handleSend = async () => {
    // Shaking and tapping the ball get here too, past the disabled button.
    console.log("[m8] send", { busy, classifying, question });
    if (busy || classifying) return;
    // A new question moves the last one into the history straight away.
    archive();
    const entry: LogEntry = { id: nextId.current++, question: question.trim() || null };
    if (!entry.question) {
      if (ballRef.current?.ask(randomAnswer(undefined, excluded))) setCurrentEntry(entry);
      return;
    }
    setCurrentEntry(entry);
    setClassifying(true);
    setThinking(true);
    console.log("[m8] calling classifyQuestion");
    const category = await classifyQuestion(entry.question, excluded).catch((error) => {
      console.error("[m8] classifyQuestion failed", error);
      return null;
    });
    console.log("[m8] category", category);
    setClassifying(false);
    // Without "maybe", a failed call gets a plain yes or no instead.
    const fallback = noMaybe ? randomAnswer(undefined, ["unsure", "rude"]) : { category: "unsure" as const };
    if (ballRef.current?.ask(category ? { category } : fallback)) {
      setQuestion("");
    } else {
      setCurrentEntry(null);
      setThinking(false);
    }
  };
  // Shaking the phone or tapping the ball asks what's typed, like sending.
  useShake(handleSend, canShake);

  return (
    <>
      {/* lvh keeps the background's size fixed while mobile browser bars come
          and go. On phones it's a band across the top that fades out
          towards the ball. */}
      <div className="fixed inset-x-0 top-0 -z-10 h-lvh overflow-hidden">
        <div className="absolute inset-0 max-md:bottom-auto max-md:h-[32lvh] max-md:[mask-image:linear-gradient(to_bottom,black_40%,transparent)]">
          <AeroShards
            ref={shardsRef}
            interaction="none"
            onReady={handleBackgroundReady}
            onError={handleBackgroundReady}
            {...BACKGROUND[screen]}
            speed={thinking ? THINKING_SPEED : IDLE_SPEED}
          />
        </div>
      </div>
      {/* Fixed to the visible area while the keyboard is open: offsetTop
          undoes the pan Safari applies to bring the text box into view. */}
      <main
        className="relative h-dvh w-full overflow-hidden"
        style={
          keyboard
            ? {
                position: "fixed",
                inset: "0 0 auto 0",
                height: keyboard.height,
                transform: `translateY(${keyboard.offsetTop}px)`,
              }
            : undefined
        }
      >
        <div
          className="absolute inset-0"
          style={keyboard ? { bottom: controlsHeight } : undefined}
        >
          <MagicEightBall
            ref={ballRef}
            canStart={backgroundReady}
            buttonHighlighted={buttonHighlighted && !busy}
            onBusyChange={setBusy}
            onAsk={handleAsk}
            onReveal={handleReveal}
            onRest={handleRest}
            onBallClick={handleSend}
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] md:px-8 md:pt-10">
          <QuestionLog current={current} history={history} compact={Boolean(keyboard)} />
        </div>

        {/* The keyboard covers the safe area, so less padding while it's open. */}
        <div
          ref={controlsRef}
          className="group pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] data-keyboard:pt-2 data-keyboard:pb-3 md:px-8"
          data-keyboard={keyboard ? true : undefined}
        >
          <div className="pointer-events-auto w-full max-w-sm">
            <PromptBar
              value={question}
              onChange={setQuestion}
              onSend={handleSend}
              disabled={busy || classifying}
              maxLength={200}
              placeholder="Ask something"
              onHighlightChange={setButtonHighlighted}
            />
          </div>
          <div className="pointer-events-auto flex gap-2 group-data-keyboard:hidden">
            <AnswerToggle label="No maybes" checked={noMaybe} onChange={setNoMaybe} />
            <AnswerToggle label="No rude answers" checked={noRude} onChange={setNoRude} />
          </div>
          <p className="text-xs tracking-[0.2em] text-violet-200/50 uppercase select-none group-data-keyboard:hidden">
            {canShake ? "or shake your phone" : "or tap it"}
          </p>
        </div>

        {!keyboard && (
          <p className="pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] text-[9px] tracking-[0.2em] text-violet-200/30 uppercase select-none">
            Powered by Jev ·{" "}
            <a
              href="https://github.com/raulmouzo/magic-8"
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto transition hover:text-violet-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              GitHub
            </a>
          </p>
        )}
      </main>

      {showMotionPrompt && <MotionPermissionPrompt onAccept={motion.requestAccess} />}
    </>
  );
}

function AnswerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-full border border-violet-200/15 bg-violet-950/30 px-3 py-1.5 text-[11px] tracking-[0.15em] text-violet-200/60 uppercase backdrop-blur-md transition select-none hover:border-violet-200/30 hover:text-violet-100 has-checked:border-violet-200/40 has-checked:text-violet-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-violet-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 cursor-pointer accent-violet-400 outline-none"
      />
      {label}
    </label>
  );
}
