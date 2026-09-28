"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

export const QUALITY_LEVELS = ["low", "medium", "high"] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];
export type QualityPreference = "auto" | QualityLevel;

const STORAGE_KEY = "graphics-quality";
const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

// Changes made in this tab; the storage event only covers other tabs.
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

const isPreference = (value: unknown): value is QualityPreference =>
  value === "auto" || QUALITY_LEVELS.includes(value as QualityLevel);

const readPreference = (): QualityPreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : "auto";
  } catch {
    return "auto";
  }
};

const writePreference = (preference: QualityPreference) => {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is closed.
  }
  listeners.forEach((listener) => listener());
};

/**
 * A first guess from the hardware. deviceMemory is Chromium only and Safari
 * caps hardwareConcurrency, so unknown values count as capable: the
 * performance monitor lowers the level if the guess was wrong.
 */
const detectLevel = (): QualityLevel => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (window.matchMedia(TOUCH_QUERY).matches) {
    return (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 2)
      ? "low"
      : "medium";
  }
  return (memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)
    ? "medium"
    : "high";
};

const noSubscription = () => () => {};

const lower = (level: QualityLevel, steps = 1): QualityLevel =>
  QUALITY_LEVELS[Math.max(0, QUALITY_LEVELS.indexOf(level) - steps)];

export type PerformanceChange = "decline" | "incline" | "fallback";

/**
 * The player's choice (saved) and the level in use. On "auto" the level
 * starts from the hardware and follows `reportPerformance`, never above
 * the hardware guess.
 */
export function useGraphicsQuality() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "auto" as const);
  // "high" on the server; the client picks its level before the scene mounts.
  const detected = useSyncExternalStore(noSubscription, detectLevel, () => "high" as const);
  // How many levels below the hardware guess the monitor has taken "auto",
  // the most it has, and whether it stopped adapting.
  const [adaptive, setAdaptive] = useState({ drop: 0, worst: 0, pinned: false });

  const autoLevel = lower(detected, adaptive.drop);
  const level = preference === "auto" ? autoLevel : preference;

  const reportPerformance = useCallback(
    (change: PerformanceChange) =>
      setAdaptive((state) => {
        if (state.pinned) return state;
        if (change === "fallback") {
          // Flip-flopping: settle on the lowest level it went down to.
          return { ...state, drop: state.worst, pinned: true };
        }
        const floor = QUALITY_LEVELS.indexOf(detected);
        const drop = Math.max(0, Math.min(state.drop + (change === "decline" ? 1 : -1), floor));
        return { ...state, drop, worst: Math.max(state.worst, drop) };
      }),
    [detected],
  );

  const setPreference = useCallback((next: QualityPreference) => {
    writePreference(next);
    // A fresh start for "auto".
    setAdaptive({ drop: 0, worst: 0, pinned: false });
  }, []);

  return {
    preference,
    setPreference,
    level,
    /** The level "auto" is using, to show next to the option. */
    autoLevel,
    /** Set only while "auto" is adapting; the scene monitors its frame rate when given. */
    reportPerformance: preference === "auto" && !adaptive.pinned ? reportPerformance : undefined,
  };
}
