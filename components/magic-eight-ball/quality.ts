import type { QualityLevel } from "../graphics-quality";
import type { ShaderQuality } from "./materials";

export type BallQuality = ShaderQuality & {
  /** Cap on the canvas pixel ratio. */
  maxDpr: number;
  /** Cap on how often the ball is drawn; animations still advance every frame. */
  maxFps: number;
  /** Real refraction through the lens, or reflections only (no second scene render). */
  refraction: boolean;
};

// "high" is the original look and "medium" keeps every effect of it, only at
// a lower pixel ratio and frame rate: the answer is read through the lens,
// so a lower-resolution refraction blurs it. "low" swaps the refraction for
// reflections only (the text is then drawn directly, so it stays sharp) and
// drops the finest shell details.
export const BALL_QUALITY: Record<QualityLevel, BallQuality> = {
  high: {
    maxDpr: 2,
    maxFps: Infinity,
    noiseOctaves: 6,
    surfaceWear: true,
    refraction: true,
  },
  medium: {
    maxDpr: 1.5,
    maxFps: 60,
    noiseOctaves: 6,
    surfaceWear: true,
    refraction: true,
  },
  low: {
    maxDpr: 1,
    maxFps: 30,
    noiseOctaves: 3,
    surfaceWear: false,
    refraction: false,
  },
};
