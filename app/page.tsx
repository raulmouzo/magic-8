"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { classifyQuestion } from "@/app/actions";
import AeroShards, { type AeroShardsHandle, type AeroShardsProps } from "@/components/aero-shards";
import {
  MagicEightBall,
  type MagicEightBallHandle,
  useIsTouch,
  useMotionAccess,
  useShake,
} from "@/components/magic-eight-ball/MagicEightBall";
import { MotionPermissionPrompt, useMotionPromptSeen } from "@/components/motion-permission-prompt";

// AeroShards speed: default 1, max 2.
const IDLE_SPEED = 0.3;
const THINKING_SPEED = 1.6;
// AeroShards' own click ripple is 1.
const PULSE_STRENGTH = 0.8;
// The ball enters after the background; don't wait longer than this for it.
const BACKGROUND_TIMEOUT_MS = 3000;

type Screen = "mobile" | "tablet" | "desktop";

// Big spinning shards read as the whole background rotating, so narrow
// screens turn spin off. Phones also use fewer, larger shards.
const BACKGROUND: Record<Screen, Partial<AeroShardsProps>> = {
  // Laid out landscape and turned 90° on phones (see the wrapper below).
  mobile: { placement: "full", spin: 0, scale: 1.6, density: 0.5, detail: "bold" },
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
  useShake(useCallback(() => ballRef.current?.ask(), []), canShake);

  useEffect(() => {
    const timeout = setTimeout(handleBackgroundReady, BACKGROUND_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [handleBackgroundReady]);

  // The background only reacts to the ball, never to the user directly.
  const handleAsk = useCallback(() => {
    shardsRef.current?.pulse([0.5, 0.5], PULSE_STRENGTH);
    setThinking(true);
  }, []);
  const handleRest = useCallback(() => setThinking(false), []);

  // Jev picks the answer category. An empty question gets a random answer;
  // a failed call gets an "unsure" one, never a joke that could land badly.
  const [question, setQuestion] = useState("");
  const [classifying, setClassifying] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) {
      ballRef.current?.ask();
      return;
    }
    setClassifying(true);
    setThinking(true);
    const category = await classifyQuestion(question).catch(() => null);
    setClassifying(false);
    if (ballRef.current?.ask({ category: category ?? "unsure" })) {
      setQuestion("");
    } else {
      setThinking(false);
    }
  };

  return (
    <>
      {/* lvh keeps the background's size fixed while mobile browser bars come
          and go. On phones it is laid out landscape and turned 90°, so the
          shards stream along the long side. */}
      <div className="fixed inset-x-0 top-0 -z-10 h-lvh overflow-hidden">
        <div className="absolute inset-0 max-md:inset-auto max-md:top-1/2 max-md:left-1/2 max-md:h-[100vw] max-md:w-lvh max-md:-translate-1/2 max-md:rotate-90">
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
      <main className="relative h-dvh w-full overflow-hidden">
        <MagicEightBall
          ref={ballRef}
          canStart={backgroundReady}
          buttonHighlighted={buttonHighlighted && !busy}
          onBusyChange={setBusy}
          onAsk={handleAsk}
          onRest={handleRest}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <form
            onSubmit={handleSubmit}
            className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3"
          >
            <input
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              placeholder="Ask a yes or no question"
              aria-label="Your question"
              className="w-full rounded-full border border-violet-200/15 bg-violet-950/30 px-5 py-3 text-center text-sm text-violet-50 placeholder:text-violet-200/40 backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
            />
            <button
              type="submit"
              disabled={busy || classifying}
              // Mouse hover and keyboard focus only: a tap must not leave the light on.
              onPointerEnter={(event) => event.pointerType === "mouse" && setButtonHighlighted(true)}
              onPointerLeave={() => setButtonHighlighted(false)}
              onFocus={(event) => setButtonHighlighted(event.currentTarget.matches(":focus-visible"))}
              onBlur={() => setButtonHighlighted(false)}
              className="pointer-events-auto rounded-full border border-violet-200/15 bg-violet-950/30 px-8 py-3 text-sm font-semibold tracking-[0.25em] text-violet-50 uppercase shadow-[0_0_40px_-8px_#A855F7] backdrop-blur-md transition hover:border-violet-200/30 hover:bg-violet-900/40 hover:shadow-[0_0_48px_-4px_#A855F7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              Ask the ball
            </button>
          </form>
          <p className="text-xs tracking-[0.2em] text-violet-200/50 uppercase select-none">
            {canShake ? "or shake your phone" : "or tap it"}
          </p>
        </div>
      </main>

      {showMotionPrompt && <MotionPermissionPrompt onAccept={motion.requestAccess} />}
    </>
  );
}
