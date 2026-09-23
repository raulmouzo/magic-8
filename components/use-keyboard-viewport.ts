"use client";

import { useEffect, useState } from "react";

// Less than this is browser chrome (URL bar) coming and going, not a keyboard.
const MIN_KEYBOARD_HEIGHT = 120;

export type KeyboardViewport = { height: number; offsetTop: number };

/**
 * The area left visible above the on-screen keyboard, or null when it's closed.
 *
 * Mobile Safari (and Chrome by default) lays the keyboard over the page and
 * may pan the page up, instead of resizing it. The visual viewport is what
 * the user actually sees; offsetTop is how far the page has been panned.
 */
export function useKeyboardViewport(): KeyboardViewport | null {
  const [viewport, setViewport] = useState<KeyboardViewport | null>(null);

  useEffect(() => {
    const visual = window.visualViewport;
    if (!visual) return;
    const update = () => {
      const covered = window.innerHeight - visual.height - visual.offsetTop;
      // Pinch zoom also shrinks the visual viewport; that isn't a keyboard.
      const open = covered > MIN_KEYBOARD_HEIGHT && Math.abs(visual.scale - 1) < 0.01;
      setViewport((current) => {
        if (!open) return null;
        const height = Math.round(visual.height);
        const offsetTop = Math.round(visual.offsetTop);
        return current?.height === height && current.offsetTop === offsetTop
          ? current
          : { height, offsetTop };
      });
    };
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, []);

  return viewport;
}
