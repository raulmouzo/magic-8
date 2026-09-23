"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import AeroShards, { type AeroShardsHandle, type AeroShardsProps } from "@/components/aero-shards";
import {
  MagicEightBall,
  type MagicEightBallHandle,
} from "@/components/magic-eight-ball/MagicEightBall";

// AeroShards speed: default 1, max 2.
const IDLE_SPEED = 0.3;
const THINKING_SPEED = 1.6;
// AeroShards' own click ripple is 1.
const PULSE_STRENGTH = 0.8;

type Screen = "mobile" | "tablet" | "desktop";

// Big spinning shards read as the whole background rotating, so narrow
// screens turn spin off. Phones also use fewer, larger shards.
const BACKGROUND: Record<Screen, Partial<AeroShardsProps>> = {
  mobile: { placement: "left", spin: 0, scale: 1.6, density: 0.5, detail: "bold" },
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

  // The background only reacts to the ball, never to the user directly.
  const handleAsk = useCallback(() => {
    shardsRef.current?.pulse([0.5, 0.5], PULSE_STRENGTH);
    setThinking(true);
  }, []);
  const handleRest = useCallback(() => setThinking(false), []);

  return (
    <>
      {/* lvh keeps the background's size fixed while mobile browser bars come and go. */}
      <div className="fixed inset-x-0 top-0 -z-10 h-lvh">
        <AeroShards
          ref={shardsRef}
          interaction="none"
          {...BACKGROUND[screen]}
          speed={thinking ? THINKING_SPEED : IDLE_SPEED}
        />
      </div>
      <main className="relative h-dvh w-full overflow-hidden">
        <MagicEightBall
          ref={ballRef}
          buttonHighlighted={buttonHighlighted && !busy}
          onBusyChange={setBusy}
          onAsk={handleAsk}
          onRest={handleRest}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => ballRef.current?.ask()}
            disabled={busy}
            onPointerEnter={() => setButtonHighlighted(true)}
            onPointerLeave={() => setButtonHighlighted(false)}
            onFocus={() => setButtonHighlighted(true)}
            onBlur={() => setButtonHighlighted(false)}
            className="pointer-events-auto rounded-full border border-violet-200/15 bg-violet-950/30 px-8 py-3 text-sm font-semibold tracking-[0.25em] text-violet-50 uppercase shadow-[0_0_40px_-8px_#A855F7] backdrop-blur-md transition hover:border-violet-200/30 hover:bg-violet-900/40 hover:shadow-[0_0_48px_-4px_#A855F7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Ask the ball
          </button>
          <p className="text-xs tracking-[0.2em] text-violet-200/50 uppercase select-none">
            or tap it
          </p>
        </div>
      </main>
    </>
  );
}
