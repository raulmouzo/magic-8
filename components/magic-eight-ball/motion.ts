"use client";

import { type RefObject, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

const subscribeToTouch = (onChange: () => void) => {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** True on touch-first devices (no hover, coarse pointer). */
export const useIsTouch = () =>
  useSyncExternalStore(subscribeToTouch, () => window.matchMedia(TOUCH_QUERY).matches, () => false);

export type MotionAccess = "pending" | "granted" | "denied" | "unsupported";

type PermissionRequester = { requestPermission?: () => Promise<"granted" | "denied"> };

type Capability = "unsupported" | "granted" | "needs-permission";

const noSubscription = () => () => {};

const getCapability = (): Capability => {
  if (!window.isSecureContext || typeof DeviceMotionEvent === "undefined") return "unsupported";
  const motion = DeviceMotionEvent as unknown as PermissionRequester;
  return typeof motion.requestPermission === "function" ? "needs-permission" : "granted";
};

const requestPermission = async (): Promise<MotionAccess> => {
  try {
    const [result] = await Promise.all([
      (DeviceMotionEvent as unknown as PermissionRequester).requestPermission!(),
      (DeviceOrientationEvent as unknown as PermissionRequester).requestPermission?.(),
    ]);
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
};

/**
 * Motion sensors need a secure context everywhere and, on some phones, a
 * permission prompt that may only be opened from a user gesture. Call
 * `requestAccess` from a click handler, or let `askOnFirstTap` ask on the
 * first tap anywhere.
 */
export function useMotionAccess(enabled: boolean, { askOnFirstTap = true } = {}) {
  const capability = useSyncExternalStore(noSubscription, getCapability, () => null);
  const [permission, setPermission] = useState<MotionAccess>("pending");
  const needsPermission = enabled && capability === "needs-permission";

  const requestAccess = useCallback(() => {
    requestPermission().then(setPermission);
  }, []);

  useEffect(() => {
    if (!needsPermission || !askOnFirstTap || permission !== "pending") return;
    window.addEventListener("click", requestAccess, { once: true });
    return () => window.removeEventListener("click", requestAccess);
  }, [needsPermission, askOnFirstTap, permission, requestAccess]);

  const access: MotionAccess =
    !enabled || capability === null
      ? "pending"
      : capability === "needs-permission"
        ? permission
        : capability;
  return { access, needsPermission, requestAccess };
}

// A shake is several sharp changes in acceleration within a short window.
const SHAKE = { threshold: 20, hits: 3, windowMs: 600, cooldownMs: 1500 }; // m/s², count, ms, ms

/** Calls `onShake` when the device is shaken. */
export function useShake(onShake: () => void, enabled: boolean) {
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;
    let last: { x: number; y: number; z: number } | null = null;
    let hits: number[] = [];
    let cooldownUntil = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (a?.x == null || a.y == null || a.z == null) return;
      const current = { x: a.x, y: a.y, z: a.z };
      const now = event.timeStamp;
      if (last) {
        const change =
          Math.abs(current.x - last.x) + Math.abs(current.y - last.y) + Math.abs(current.z - last.z);
        if (change > SHAKE.threshold && now > cooldownUntil) {
          hits = [...hits.filter((t) => now - t < SHAKE.windowMs), now];
          if (hits.length >= SHAKE.hits) {
            hits = [];
            cooldownUntil = now + SHAKE.cooldownMs;
            onShakeRef.current();
          }
        }
      }
      last = current;
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [enabled]);
}

// Degrees of tilt away from the resting angle that map to a full lean.
const TILT_RANGE = 25;

/**
 * Device tilt as a pointer-like value in -1…1, written into `target`. The
 * resting angle slowly follows how the phone is held, so any grip is centre.
 */
export function useDeviceTilt(target: RefObject<{ x: number; y: number }>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const tilt = target.current;
    let restingBeta: number | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return;
      restingBeta = restingBeta == null ? event.beta : restingBeta + (event.beta - restingBeta) * 0.02;
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      tilt.x = clamp(event.gamma / TILT_RANGE);
      tilt.y = clamp((event.beta - restingBeta) / TILT_RANGE);
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      tilt.x = 0;
      tilt.y = 0;
    };
  }, [enabled, target]);
}
